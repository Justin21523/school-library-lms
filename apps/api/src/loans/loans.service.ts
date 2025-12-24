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

import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { ListLoansQuery } from './loans.schemas';

// 與 db/schema.sql 對齊的 enum 值（用 string union 描述即可）。
type LoanStatus = 'open' | 'closed';
type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';
type ItemStatus = 'available' | 'checked_out' | 'on_hold' | 'lost' | 'withdrawn' | 'repair';

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

@Injectable()
export class LoansService {
  constructor(private readonly db: DbService) {}

  async list(orgId: string, query: ListLoansQuery): Promise<LoanWithDetailsRow[]> {
    // status 預設 open：符合館員最常見情境（先看「目前借出」）。
    const status = query.status ?? 'open';

    // limit 預設 200，避免一次拉太多資料。
    const limit = query.limit ?? 200;

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

    // LIMIT 也用參數化，避免拼字串造成 SQL injection 風險。
    params.push(limit);
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
      ORDER BY l.checked_out_at DESC
      LIMIT ${limitParam}
      `,
      params,
    );

    return result.rows;
  }
}

