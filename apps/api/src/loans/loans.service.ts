/**
 * LoansService
 *
 * 借閱查詢（loans list）通常是館員最常用的查詢之一：
 * - 查某位讀者目前借了哪些書（open loans）
 * - 查某個條碼目前借給誰、何時到期
 * - 列出逾期清單（可用 is_overdue 推導）
 *
 * 這裡的設計重點：
 * - 多租戶隔離：所有查詢都必須以 organization_id 作為邊界
 * - 回傳「可用於 UI 顯示」的資料：loan + user + item + bib title
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { decodeCursorV1, encodeCursorV1, normalizeSortToIso, type CursorPage } from '../common/cursor';
import { DbService } from '../db/db.service';
import type { ListLoansQuery, PurgeLoanHistoryInput } from './loans.schemas';

// 與 db/schema.sql 對齊的 enum 值（用 string union 描述即可）。
type LoanStatus = 'open' | 'closed';
type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';
type ItemStatus = 'available' | 'checked_out' | 'on_hold' | 'lost' | 'withdrawn' | 'repair';

// US-061 屬於高風險維運動作：只允許 admin（系統管理者）。
const ADMIN_ROLES: UserRole[] = ['admin'];

// 回傳給前端的「loan + details」row shape。
// 注意：目前 API 直接回傳 SQL 欄位，因此欄位命名採 snake_case（與 DB 一致）。
export type LoanWithDetailsRow = {
  // loan 本體
  id: string;
  organization_id: string;
  item_id: string;
  user_id: string;
  checked_out_at: string;
  due_at: string;
  returned_at: string | null;
  renewed_count: number;
  status: LoanStatus;

  // 推導欄位：是否逾期（returned_at IS NULL 且 due_at < now()）
  is_overdue: boolean;

  // borrower（user）
  user_external_id: string;
  user_name: string;
  user_role: UserRole;
  user_status: UserStatus;

  // item
  item_barcode: string;
  item_status: ItemStatus;
  item_call_number: string;
  item_location_id: string;

  // bib（方便 UI 顯示書名）
  bibliographic_id: string;
  bibliographic_title: string;
};

/**
 * US-061：借閱歷史保存期限（Purge loan history）
 *
 * Preview 與 Apply 的回傳 shape：
 * - preview：回傳候選清單與摘要（不寫 DB）
 * - apply：實際刪除（寫 DB + 寫 audit）
 */
export type PurgeLoanHistoryPreviewRow = {
  loan_id: string;
  checked_out_at: string;
  returned_at: string;
  user_external_id: string;
  user_name: string;
  user_role: UserRole;
  user_org_unit: string | null;
  item_barcode: string;
  bibliographic_title: string;
};

export type PurgeLoanHistoryPreviewResult = {
  mode: 'preview';
  as_of: string;
  retention_days: number;
  cutoff: string;
  limit: number;
  include_audit_events: boolean;
  candidates_total: number;
  loans: PurgeLoanHistoryPreviewRow[];
};

export type PurgeLoanHistoryApplyResult = {
  mode: 'apply';
  as_of: string;
  retention_days: number;
  cutoff: string;
  limit: number;
  include_audit_events: boolean;
  summary: {
    candidates_total: number;
    deleted_loans: number;
    deleted_audit_events: number;
  };
  audit_event_id: string | null;
  deleted_loan_ids: string[];
};

export type PurgeLoanHistoryResult = PurgeLoanHistoryPreviewResult | PurgeLoanHistoryApplyResult;

type UserRow = { id: string; external_id: string; name: string; role: UserRole; status: UserStatus };

type LoanIdRow = { id: string };

@Injectable()
export class LoansService {
  constructor(private readonly db: DbService) {}

  async list(orgId: string, query: ListLoansQuery): Promise<CursorPage<LoanWithDetailsRow>> {
    // status 預設 open：符合館員最常見情境（先看「目前借出」）。
    const status = query.status ?? 'open';

    // limit 預設 200，避免一次拉太多資料。
    const pageSize = query.limit ?? 200;
    const queryLimit = pageSize + 1;

    // 動態組 WHERE 條件（安全：只插入固定字串片段，值仍用參數化）。
    const whereClauses: string[] = ['l.organization_id = $1'];
    const params: unknown[] = [orgId];

    if (query.user_external_id) {
      params.push(query.user_external_id);
      whereClauses.push(`u.external_id = $${params.length}`);
    }

    if (query.item_barcode) {
      params.push(query.item_barcode);
      whereClauses.push(`i.barcode = $${params.length}`);
    }

    // 以 returned_at 判斷 open/closed，避免依賴 status 欄位的正確性（更穩）。
    if (status === 'open') whereClauses.push('l.returned_at IS NULL');
    if (status === 'closed') whereClauses.push('l.returned_at IS NOT NULL');
    // status === 'all' 則不加條件

    // cursor pagination（keyset）：
    // - loans 的排序鍵：checked_out_at DESC, id DESC
    // - next page 條件：(checked_out_at, id) < (cursor.sort, cursor.id)
    if (query.cursor) {
      try {
        const cursor = decodeCursorV1(query.cursor);
        params.push(cursor.sort, cursor.id);
        const sortParam = `$${params.length - 1}`;
        const idParam = `$${params.length}`;
        whereClauses.push(`(l.checked_out_at, l.id) < (${sortParam}::timestamptz, ${idParam}::uuid)`);
      } catch (error: any) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid cursor',
            details: { reason: error?.message ?? String(error) },
          },
        });
      }
    }

    // LIMIT 也用參數化，避免拼字串造成 SQL injection 風險。
    params.push(queryLimit);
    const limitParam = `$${params.length}`;

    const result = await this.db.query<LoanWithDetailsRow>(
      `
      SELECT
        -- loan
        l.id,
        l.organization_id,
        l.item_id,
        l.user_id,
        l.checked_out_at,
        l.due_at,
        l.returned_at,
        l.renewed_count,
        l.status,
        -- derived: overdue
        (l.returned_at IS NULL AND l.due_at < now()) AS is_overdue,

        -- user（borrower）
        u.external_id AS user_external_id,
        u.name AS user_name,
        u.role AS user_role,
        u.status AS user_status,

        -- item
        i.barcode AS item_barcode,
        i.status AS item_status,
        i.call_number AS item_call_number,
        i.location_id AS item_location_id,

        -- bib
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
       AND b.organization_id = i.organization_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY l.checked_out_at DESC, l.id DESC
      LIMIT ${limitParam}
      `,
      params,
    );

    const rows = result.rows;
    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;

    const last = items.at(-1) ?? null;
    const next_cursor =
      hasMore && last
        ? encodeCursorV1({ sort: normalizeSortToIso(last.checked_out_at), id: last.id })
        : null;

    return { items, next_cursor };
  }

  /**
   * US-061：purgeHistory（借閱歷史保存期限）
   *
   * 行為：
   * - 以 `as_of - retention_days` 算出 cutoff
   * - 刪除 `returned_at < cutoff` 的 loans（只刪已歸還；不會動到 open loans）
   * - 可選 include_audit_events：連同該批 loan 的 audit_events（entity_type='loan'）一起刪除
   * - apply 時會寫入一筆 audit_events（action=`loan.purge_history`），便於追溯「誰做了資料清理」
   *
   * 為什麼要做成 preview/apply？
   * - 這是不可逆的刪除操作，預覽能降低誤操作風險
   * - apply 採 limit 分批，避免一次刪太久、也方便你逐步確認
   */
  async purgeHistory(orgId: string, input: PurgeLoanHistoryInput): Promise<PurgeLoanHistoryResult> {
    try {
      return await this.db.transaction(async (client) => {
        // 1) actor：必須是 active admin（US-061 屬於「系統管理」等級）
        const actor = await this.requireUserById(client, orgId, input.actor_user_id);

        if (actor.status !== 'active') {
          throw new ConflictException({
            error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
          });
        }

        if (!ADMIN_ROLES.includes(actor.role)) {
          throw new ForbiddenException({
            error: { code: 'FORBIDDEN', message: 'Actor is not allowed to purge loan history' },
          });
        }

        // 2) as_of：若未提供，使用 DB now()（避免 API server 與 DB 時鐘差異）
        const asOf = await this.resolveAsOf(client, input.as_of);

        // 3) retention_days：保留天數（schema 已保證 int；這裡再轉一次保險）
        const retentionDays = Number(input.retention_days);

        // 4) include_audit_events：預設 false（避免誤刪稽核）
        const includeAuditEvents = input.include_audit_events ?? false;

        // 5) limit：preview/apply 都用 limit 控制資料量（避免一次刪太久）
        const limit = input.limit ?? (input.mode === 'apply' ? 500 : 200);

        // 6) cutoff：as_of - retention_days
        const cutoffResult = await client.query<{ cutoff: string }>(
          `
          SELECT ($1::timestamptz - ($2::int * interval '1 day'))::timestamptz::text AS cutoff
          `,
          [asOf, retentionDays],
        );
        const cutoff = cutoffResult.rows[0]?.cutoff ?? asOf;

        // 7) candidates_total：有多少筆 loans 符合刪除條件（用於 UI 提示「可能需要分批」）
        const countResult = await client.query<{ count: string }>(
          `
          SELECT COUNT(*)::text AS count
          FROM loans
          WHERE organization_id = $1
            AND returned_at IS NOT NULL
            AND returned_at < $2::timestamptz
          `,
          [orgId, cutoff],
        );
        const candidatesTotal = Number.parseInt(countResult.rows[0]?.count ?? '0', 10);

        // 8) preview：列出候選清單（不寫 DB）
        if (input.mode === 'preview') {
          const previewResult = await client.query<PurgeLoanHistoryPreviewRow>(
            `
            SELECT
              l.id AS loan_id,
              l.checked_out_at,
              l.returned_at,
              u.external_id AS user_external_id,
              u.name AS user_name,
              u.role AS user_role,
              u.org_unit AS user_org_unit,
              i.barcode AS item_barcode,
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
             AND b.organization_id = i.organization_id
            WHERE l.organization_id = $1
              AND l.returned_at IS NOT NULL
              AND l.returned_at < $2::timestamptz
            ORDER BY l.returned_at ASC
            LIMIT $3
            `,
            [orgId, cutoff, limit],
          );

          return {
            mode: 'preview',
            as_of: asOf,
            retention_days: retentionDays,
            cutoff,
            limit,
            include_audit_events: includeAuditEvents,
            candidates_total: candidatesTotal,
            loans: previewResult.rows,
          };
        }

        // 9) apply：鎖住要刪除的 loans（SKIP LOCKED 避免多館員同時執行互相卡住）
        const candidates = await client.query<LoanIdRow>(
          `
          SELECT id
          FROM loans
          WHERE organization_id = $1
            AND returned_at IS NOT NULL
            AND returned_at < $2::timestamptz
          ORDER BY returned_at ASC
          LIMIT $3
          FOR UPDATE SKIP LOCKED
          `,
          [orgId, cutoff, limit],
        );
        const loanIds = candidates.rows.map((r) => r.id);

        // 若本次沒有任何可刪：回傳空結果（避免寫一筆無意義的 audit）
        if (loanIds.length === 0) {
          return {
            mode: 'apply',
            as_of: asOf,
            retention_days: retentionDays,
            cutoff,
            limit,
            include_audit_events: includeAuditEvents,
            summary: { candidates_total: candidatesTotal, deleted_loans: 0, deleted_audit_events: 0 },
            audit_event_id: null,
            deleted_loan_ids: [],
          };
        }

        // 10) 先刪 audit_events（若選擇 include_audit_events）
        let deletedAuditEvents = 0;
        if (includeAuditEvents) {
          const auditDelete = await client.query<{ id: string }>(
            `
            DELETE FROM audit_events
            WHERE organization_id = $1
              AND entity_type = 'loan'
              AND entity_id = ANY($2::text[])
            RETURNING id
            `,
            [orgId, loanIds],
          );
          deletedAuditEvents = auditDelete.rowCount ?? 0;
        }

        // 11) 刪 loans（注意：只刪 closed loans；open loans returned_at IS NULL 不會被刪到）
        const loanDelete = await client.query<{ id: string }>(
          `
          DELETE FROM loans
          WHERE organization_id = $1
            AND id = ANY($2::uuid[])
          RETURNING id
          `,
          [orgId, loanIds],
        );
        const deletedLoans = loanDelete.rowCount ?? 0;

        // 12) 寫 audit（單一事件；批次刪除不適合每筆一個事件）
        const sampleIds = loanIds.slice(0, 20);
        const auditInsert = await client.query<{ id: string }>(
          `
          INSERT INTO audit_events (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          RETURNING id
          `,
          [
            orgId,
            actor.id,
            'loan.purge_history',
            'maintenance',
            'loan_history',
            JSON.stringify({
              as_of: asOf,
              retention_days: retentionDays,
              cutoff,
              include_audit_events: includeAuditEvents,
              limit,
              deleted_loans: deletedLoans,
              deleted_audit_events: deletedAuditEvents,
              deleted_loan_ids_sample: sampleIds,
              note: input.note ?? null,
            }),
          ],
        );

        return {
          mode: 'apply',
          as_of: asOf,
          retention_days: retentionDays,
          cutoff,
          limit,
          include_audit_events: includeAuditEvents,
          summary: {
            candidates_total: candidatesTotal,
            deleted_loans: deletedLoans,
            deleted_audit_events: deletedAuditEvents,
          },
          audit_event_id: auditInsert.rows[0]!.id,
          deleted_loan_ids: loanIds,
        };
      });
    } catch (error: any) {
      // 22P02/22007：timestamptz 解析失敗（as_of 格式錯）
      if (error?.code === '22P02' || error?.code === '22007') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query format' },
        });
      }
      throw error;
    }
  }

  // ----------------------------
  // helper functions（DB 查詢與權限/時間處理）
  // ----------------------------

  private async requireUserById(client: PoolClient, orgId: string, userId: string) {
    const result = await client.query<UserRow>(
      `
      SELECT id, external_id, name, role, status
      FROM users
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return result.rows[0]!;
  }

  private async resolveAsOf(client: PoolClient, asOfRaw: string | undefined) {
    const trimmed = asOfRaw?.trim() ? asOfRaw.trim() : null;
    if (trimmed) return trimmed;

    // 由 DB 取得 now()：避免 API server 與 DB 時鐘差
    const result = await client.query<{ now: string }>(`SELECT now()::timestamptz::text AS now`);
    return result.rows[0]?.now ?? new Date().toISOString();
  }
}
