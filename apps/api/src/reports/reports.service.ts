/**
 * ReportsService
 *
 * 報表（reports）的核心目標是：
 * - 把「館員每天會做的查詢」做成可重複、可匯出的結果（JSON + CSV）
 * - 盡量在 DB 用「推導」而不是寫死狀態（例如逾期用 due_at < as_of 推導）
 *
 * 本檔案先落地 MVP 第一個報表：逾期清單（Overdue List）。
 *
 * Overdue List 的定義（MVP）：
 * - loans.returned_at IS NULL（仍未歸還）
 * - loans.due_at < as_of（到期日早於基準時間）
 *
 * 重要取捨：
 * - 我們要求 actor_user_id（admin/librarian）才能查詢/匯出
 * - CSV 會加上 UTF-8 BOM（\ufeff），讓 Excel 在中文環境較容易正確顯示
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import type { OverdueReportQuery } from './reports.schemas';

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

type ItemStatus = 'available' | 'checked_out' | 'on_hold' | 'lost' | 'withdrawn' | 'repair';

// 報表屬於館員用途：只允許 admin/librarian。
const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

type ActorRow = { id: string; role: UserRole; status: UserStatus };

/**
 * OverdueReportRow（回傳給前端顯示/匯出）
 *
 * 注意：欄位採 snake_case（對齊目前 API：直接回傳 SQL row）
 */
export type OverdueReportRow = {
  // loan
  loan_id: string;
  checked_out_at: string;
  due_at: string;
  days_overdue: number;

  // borrower
  user_id: string;
  user_external_id: string;
  user_name: string;
  user_role: UserRole;
  user_org_unit: string | null;

  // item
  item_id: string;
  item_barcode: string;
  item_call_number: string;
  item_status: ItemStatus;
  item_location_id: string;
  item_location_code: string;
  item_location_name: string;

  // bib
  bibliographic_id: string;
  bibliographic_title: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly db: DbService) {}

  /**
   * listOverdue：查詢逾期清單（JSON 用）
   *
   * - 這是一個「讀取型」查詢：不需要 transaction
   * - 但仍需驗證 actor（避免敏感資料外洩）
   */
  async listOverdue(orgId: string, query: OverdueReportQuery): Promise<OverdueReportRow[]> {
    // 1) 驗證 actor（館員/管理者）
    await this.db.transaction(async (client) => {
      // 用 transaction 的理由：
      // - 這裡主要是「重用 requireStaffActor 的查詢邏輯」
      // - 讀取也可不開 transaction；但這樣寫能讓未來若要寫 audit 事件更容易擴充
      await this.requireStaffActor(client, orgId, query.actor_user_id);
    });

    // 2) as_of：未提供就用「現在」
    // - 這裡用 API server 的時間作為基準，確保一次請求內比較一致
    // - 若未來需要更嚴謹，可改成「先 SELECT now()」取得 DB 時間
    const asOf = query.as_of?.trim() ? query.as_of.trim() : new Date().toISOString();

    // 3) limit：未提供時給一個合理預設（避免一次撈爆）
    const limit = query.limit ?? 500;

    const whereClauses: string[] = [
      'l.organization_id = $1',
      'l.returned_at IS NULL',
      'l.due_at < $2::timestamptz',
    ];

    const params: unknown[] = [orgId, asOf];

    if (query.org_unit) {
      params.push(query.org_unit);
      whereClauses.push(`u.org_unit = $${params.length}`);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    try {
      const result = await this.db.query<OverdueReportRow>(
        `
        SELECT
          -- loan
          l.id AS loan_id,
          l.checked_out_at,
          l.due_at,
          -- days_overdue：用 as_of - due_at 推導（整天數）
          FLOOR(EXTRACT(EPOCH FROM ($2::timestamptz - l.due_at)) / 86400)::int AS days_overdue,

          -- borrower
          u.id AS user_id,
          u.external_id AS user_external_id,
          u.name AS user_name,
          u.role AS user_role,
          u.org_unit AS user_org_unit,

          -- item
          i.id AS item_id,
          i.barcode AS item_barcode,
          i.call_number AS item_call_number,
          i.status AS item_status,
          i.location_id AS item_location_id,
          loc.code AS item_location_code,
          loc.name AS item_location_name,

          -- bibliographic
          b.id AS bibliographic_id,
          b.title AS bibliographic_title
        FROM loans l
        JOIN users u
          ON u.id = l.user_id
         AND u.organization_id = l.organization_id
        JOIN item_copies i
          ON i.id = l.item_id
         AND i.organization_id = l.organization_id
        JOIN bibliographic_records b
          ON b.id = i.bibliographic_id
         AND b.organization_id = l.organization_id
        JOIN locations loc
          ON loc.id = i.location_id
         AND loc.organization_id = l.organization_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY l.due_at ASC
        LIMIT ${limitParam}
        `,
        params,
      );

      return result.rows;
    } catch (error: any) {
      // 22P02 = invalid_text_representation：timestamptz/uuid 轉型失敗（例如 as_of 格式錯）
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query format' },
        });
      }
      throw error;
    }
  }

  /**
   * buildOverdueCsv：把逾期清單 rows 轉成 CSV 字串（給 controller 回傳）
   *
   * CSV 欄位順序（建議）：
   * - 先放「現場最需要」的欄位（讀者、班級、書名、條碼、到期日、逾期天數）
   * - 再放 ID 欄位（方便系統對帳/二次處理）
   */
  buildOverdueCsv(rows: OverdueReportRow[]) {
    // 1) 欄位定義（header）
    const headers: Array<{ key: keyof OverdueReportRow; label: string }> = [
      { key: 'user_external_id', label: 'user_external_id' },
      { key: 'user_name', label: 'user_name' },
      { key: 'user_role', label: 'user_role' },
      { key: 'user_org_unit', label: 'org_unit' },
      { key: 'bibliographic_title', label: 'title' },
      { key: 'item_barcode', label: 'item_barcode' },
      { key: 'item_call_number', label: 'call_number' },
      { key: 'item_location_code', label: 'location_code' },
      { key: 'item_location_name', label: 'location_name' },
      { key: 'checked_out_at', label: 'checked_out_at' },
      { key: 'due_at', label: 'due_at' },
      { key: 'days_overdue', label: 'days_overdue' },
      // IDs（放最後）
      { key: 'loan_id', label: 'loan_id' },
      { key: 'user_id', label: 'user_id' },
      { key: 'item_id', label: 'item_id' },
      { key: 'bibliographic_id', label: 'bibliographic_id' },
    ];

    // 2) header row
    const headerLine = headers.map((h) => escapeCsvCell(h.label)).join(',');

    // 3) data rows
    const dataLines = rows.map((row) =>
      headers
        .map((h) => {
          const value = row[h.key];
          return escapeCsvCell(value);
        })
        .join(','),
    );

    // 4) 組合 CSV（加 BOM 讓 Excel 更容易正確顯示 UTF-8）
    // - \ufeff 是 UTF-8 BOM
    // - 使用 \r\n 以提高 Excel/Windows 相容性
    return `\ufeff${[headerLine, ...dataLines].join('\r\n')}\r\n`;
  }

  // ----------------------------
  // helpers
  // ----------------------------

  /**
   * requireStaffActor：驗證查詢者是同 org 的 admin/librarian
   *
   * 這是「MVP 的最小權限控管」：
   * - 沒有登入時，actor_user_id 仍可能被冒用
   * - 但至少能避免「完全不帶任何身份」就拿到敏感資料
   */
  private async requireStaffActor(client: PoolClient, orgId: string, actorUserId: string) {
    const result = await client.query<ActorRow>(
      `
      SELECT id, role, status
      FROM users
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, actorUserId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Actor user not found' },
      });
    }

    const actor = result.rows[0]!;

    if (actor.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
      });
    }

    if (!STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to view reports' },
      });
    }

    return actor;
  }
}

/**
 * escapeCsvCell：把任意值安全轉成 CSV cell
 *
 * CSV 規則（RFC 4180 常見實務）：
 * - 若 cell 含有 `"`、`,`、`\n`、`\r`，就必須用雙引號包起來
 * - 內部的 `"` 需要變成 `""`
 */
function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);

  const mustQuote =
    text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r');

  if (!mustQuote) return text;

  // 把 " 變成 ""（CSV 的 escape 規則）
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

