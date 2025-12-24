/**
 * MeService（登入後的讀者自助資料）
 *
 * Me（/me）端點的核心目的：
 * - 「不再用 user_external_id 當身份」：由 token 推導 user_id
 * - 讓 OPAC 的「我的借閱 / 我的預約」變成真正安全可用
 *
 * 實作策略：
 * - listMyLoans/listMyHolds：直接用 SQL 以 user_id 篩選（最清楚、也避免外部傳入篩選條件）
 * - place/cancel hold：重用 HoldsService 的商業規則（排隊、指派、釋放、audit）
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { HoldsService } from '../holds/holds.service';
import type { HoldWithDetailsRow } from '../holds/holds.service';
import type { LoanWithDetailsRow } from '../loans/loans.service';
import type { ListMyHoldsQuery, ListMyLoansQuery, PlaceMyHoldInput } from './me.schemas';

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

type MeUserRow = {
  id: string;
  organization_id: string;
  external_id: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

@Injectable()
export class MeService {
  constructor(
    private readonly db: DbService,
    private readonly holds: HoldsService,
  ) {}

  async getMe(orgId: string, userId: string): Promise<MeUserRow> {
    const result = await this.db.query<MeUserRow>(
      `
      SELECT id, organization_id, external_id, name, role, status
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

  /**
   * 我的借閱（loans）
   *
   * - 只回傳該 user 的資料
   * - 回傳 shape 與 staff /loans 一致，方便前端共用 UI 元件
   */
  async listMyLoans(orgId: string, userId: string, query: ListMyLoansQuery): Promise<LoanWithDetailsRow[]> {
    const status = query.status ?? 'open';
    const limit = query.limit ?? 200;

    const whereClauses: string[] = ['l.organization_id = $1', 'l.user_id = $2'];
    const params: unknown[] = [orgId, userId];

    if (status === 'open') whereClauses.push('l.returned_at IS NULL');
    if (status === 'closed') whereClauses.push('l.returned_at IS NOT NULL');

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

  /**
   * 我的預約（holds）
   *
   * - 只回傳該 user 的資料
   * - 回傳 shape 與 /holds 一致（HoldWithDetailsRow）
   */
  async listMyHolds(orgId: string, userId: string, query: ListMyHoldsQuery): Promise<HoldWithDetailsRow[]> {
    const status = query.status ?? 'all';
    const limit = query.limit ?? 200;

    const whereClauses: string[] = ['h.organization_id = $1', 'h.user_id = $2'];
    const params: unknown[] = [orgId, userId];

    if (status !== 'all') {
      params.push(status);
      whereClauses.push(`h.status = $${params.length}::hold_status`);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const result = await this.db.query<HoldWithDetailsRow>(
      `
      SELECT
        -- hold
        h.id,
        h.organization_id,
        h.bibliographic_id,
        h.user_id,
        h.pickup_location_id,
        h.placed_at,
        h.status,
        h.assigned_item_id,
        h.ready_at,
        h.ready_until,
        h.cancelled_at,
        h.fulfilled_at,

        -- borrower
        u.external_id AS user_external_id,
        u.name AS user_name,
        u.role AS user_role,

        -- bib
        b.title AS bibliographic_title,

        -- pickup location
        pl.code AS pickup_location_code,
        pl.name AS pickup_location_name,

        -- assigned item（可能為 NULL）
        ai.barcode AS assigned_item_barcode,
        ai.status AS assigned_item_status
      FROM holds h
      JOIN users u
        ON u.id = h.user_id
       AND u.organization_id = h.organization_id
      JOIN bibliographic_records b
        ON b.id = h.bibliographic_id
       AND b.organization_id = h.organization_id
      JOIN locations pl
        ON pl.id = h.pickup_location_id
       AND pl.organization_id = h.organization_id
      LEFT JOIN item_copies ai
        ON ai.id = h.assigned_item_id
       AND ai.organization_id = h.organization_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY
        CASE h.status
          WHEN 'ready' THEN 0
          WHEN 'queued' THEN 1
          ELSE 2
        END,
        CASE
          WHEN h.status = 'ready' THEN h.ready_at
          ELSE h.placed_at
        END ASC
      LIMIT ${limitParam}
      `,
      params,
    );

    return result.rows;
  }

  /**
   * placeHold：替「本人」建立預約
   *
   * 注意：
   * - 我們重用 HoldsService.create 的商業規則（max_holds、重複 hold、防呆）
   * - 但一定要帶 actor_user_id（= token user），避免 HoldsService 在無 actor_user_id 時「視為 owner」造成授權漏洞
   */
  async placeHold(orgId: string, userId: string, input: PlaceMyHoldInput) {
    // 用 DB 查出 external_id（HoldsService.create 以 external_id 作為 borrower 查詢鍵）
    const me = await this.getMe(orgId, userId);

    return await this.holds.create(orgId, {
      bibliographic_id: input.bibliographic_id,
      pickup_location_id: input.pickup_location_id,
      user_external_id: me.external_id,
      actor_user_id: me.id,
    });
  }

  /**
   * cancelHold：取消「本人」的 hold
   *
   * 注意：一定要帶 actor_user_id（= token user），讓 HoldsService 做 owner 檢查
   */
  async cancelHold(orgId: string, userId: string, holdId: string) {
    return await this.holds.cancel(orgId, holdId, { actor_user_id: userId });
  }

  /**
   * resolveAsOf：未來若要支援「以某個時間點」查詢，可在此統一處理（先留擴充點）
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async resolveAsOf(_client: PoolClient, _asOf?: string) {
    return null;
  }
}

