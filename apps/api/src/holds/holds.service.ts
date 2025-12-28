/**
 * HoldsService
 *
 * holds（預約/保留）在學校圖書館情境很常見：
 * - 當想借的書目前都借出時，讀者可以先排隊（queued）
 * - 當有冊可供取書時，館員把它標記為 ready（並指派某一冊）
 * - 讀者到館取書後，館員執行 fulfill：建立借閱（loan）並把 hold 標記 fulfilled
 *
 * 我們在 MVP 先落地「最小但可用」的流程：
 * - create：建立 hold，若有可借冊則立即指派並轉 ready
 * - list：查詢 holds（支援常用 filter）
 * - cancel：取消 queued/ready hold；若是 ready 且已指派冊，會把冊釋放或轉給下一位 queued
 * - fulfill：完成取書借出（館員動作）
 *
 * 重要約束（policy-driven）：
 * - max_holds：同時可排隊/保留的上限（依 borrower.role 的 policy）
 * - max_loans：fulfill 時仍要檢查借閱上限
 * - queued holds 存在時，renew 會被阻擋（已在 CirculationService 實作）
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { assertBorrowingAllowedByOverdue } from '../common/borrowing-block';
import { decodeCursorV1, encodeCursorV1, normalizeSortToIso, type CursorPage } from '../common/cursor';
import { DbService } from '../db/db.service';
import type {
  CancelHoldInput,
  CreateHoldInput,
  ExpireReadyHoldsInput,
  FulfillHoldInput,
  ListHoldsQuery,
} from './holds.schemas';

// 與 db/schema.sql enum 對齊（用 string union 表示即可）。
type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

type ItemStatus = 'available' | 'checked_out' | 'on_hold' | 'lost' | 'withdrawn' | 'repair';
type HoldStatus = 'queued' | 'ready' | 'cancelled' | 'fulfilled' | 'expired';
type LoanStatus = 'open' | 'closed';

// borrow role：MVP 先支持 student/teacher。
const BORROWER_ROLES: UserRole[] = ['student', 'teacher'];

// staff role：館員/管理者。
const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

// 若找不到政策的 hold_pickup_days，先用這個保底（與 circulation service 同概念）。
const DEFAULT_HOLD_PICKUP_DAYS = 3;

type UserRow = { id: string; external_id: string; name: string; role: UserRole; status: UserStatus };

type PolicyRow = {
  id: string;
  audience_role: UserRole;
  loan_days: number;
  max_loans: number;
  max_holds: number;
  max_renewals: number;
  hold_pickup_days: number;
  overdue_block_days: number;
};

type BibRow = { id: string; title: string };

type LocationRow = { id: string; code: string; name: string; status: 'active' | 'inactive' };

type HoldRow = {
  id: string;
  organization_id: string;
  bibliographic_id: string;
  user_id: string;
  pickup_location_id: string;
  placed_at: string;
  status: HoldStatus;
  assigned_item_id: string | null;
  ready_at: string | null;
  ready_until: string | null;
  cancelled_at: string | null;
  fulfilled_at: string | null;
};

// list/create 回傳給前端的「可顯示」資料：hold + user + bib + pickup location + assigned item barcode
export type HoldWithDetailsRow = HoldRow & {
  user_external_id: string;
  user_name: string;
  user_role: UserRole;

  bibliographic_title: string;

  pickup_location_code: string;
  pickup_location_name: string;

  assigned_item_barcode: string | null;
  assigned_item_status: ItemStatus | null;
};

/**
 * Holds 到期處理（ready_until → expired）
 *
 * Preview 與 Apply 的回傳 shape：
 * - preview：回傳「會被處理的清單」與摘要
 * - apply：回傳「實際處理結果」與摘要
 *
 * 注意：回傳的資料量可能很大，因此兩者都會受 limit 控制（預設 200）
 */
export type ExpireReadyHoldsPreviewResult = {
  mode: 'preview';
  as_of: string;
  limit: number;
  candidates_total: number;
  holds: HoldWithDetailsRow[];
};

export type ExpireReadyHoldsApplyRow = {
  hold_id: string;
  assigned_item_id: string | null;
  assigned_item_barcode: string | null;
  item_status_before: ItemStatus | null;
  item_status_after: ItemStatus | null;
  transferred_to_hold_id: string | null;
  audit_event_id: string;
};

export type ExpireReadyHoldsApplyResult = {
  mode: 'apply';
  as_of: string;
  limit: number;
  summary: {
    candidates_total: number;
    processed: number;
    transferred: number;
    released: number;
    skipped_item_action: number;
  };
  results: ExpireReadyHoldsApplyRow[];
};

export type ExpireReadyHoldsResult = ExpireReadyHoldsPreviewResult | ExpireReadyHoldsApplyResult;

type HoldForUpdateRow = {
  id: string;
  user_id: string;
  bibliographic_id: string;
  pickup_location_id: string;
  status: HoldStatus;
  assigned_item_id: string | null;
  ready_until: string | null;
};

type ItemForUpdateRow = {
  id: string;
  bibliographic_id: string;
  barcode: string;
  status: ItemStatus;
};

type LoanRow = {
  id: string;
  user_id: string;
  item_id: string;
  due_at: string;
  status: LoanStatus;
};

type ExpiredReadyHoldCandidateRow = {
  id: string;
  user_id: string;
  bibliographic_id: string;
  assigned_item_id: string | null;
  ready_until: string;
};

@Injectable()
export class HoldsService {
  constructor(private readonly db: DbService) {}

  async list(orgId: string, query: ListHoldsQuery): Promise<CursorPage<HoldWithDetailsRow>> {
    const status = query.status ?? 'all';
    const pageSize = query.limit ?? 200;
    const queryLimit = pageSize + 1;

    const whereClauses: string[] = ['h.organization_id = $1'];
    const params: unknown[] = [orgId];

    if (status !== 'all') {
      params.push(status);
      whereClauses.push(`h.status = $${params.length}::hold_status`);
    }

    if (query.user_external_id) {
      params.push(query.user_external_id);
      whereClauses.push(`u.external_id = $${params.length}`);
    }

    if (query.bibliographic_id) {
      params.push(query.bibliographic_id);
      whereClauses.push(`h.bibliographic_id = $${params.length}::uuid`);
    }

    if (query.pickup_location_id) {
      params.push(query.pickup_location_id);
      whereClauses.push(`h.pickup_location_id = $${params.length}::uuid`);
    }

    if (query.item_barcode) {
      params.push(query.item_barcode);
      whereClauses.push(`ai.barcode = $${params.length}`);
    }

    // cursor pagination（keyset）
    //
    // holds 的「合理排序」會隨 status 而不同：
    // - ready：館員要優先處理「越早 ready 的越先取書」 → ready_at ASC
    // - queued：公平排隊（placed_at 越早越先） → placed_at ASC
    // - 其他/全部：偏向查詢/追溯（最近的先看） → placed_at DESC
    //
    // 重點：
    // - cursor.sort 的語意會隨 status 改變，但前端不需要理解，只要把 next_cursor 帶回即可
    // - next page 條件：
    //   - ASC： (sort, id) > (cursor.sort, cursor.id)
    //   - DESC：(sort, id) < (cursor.sort, cursor.id)

    const order =
      status === 'ready'
        ? { column: 'h.ready_at', direction: 'ASC' as const }
        : status === 'queued'
          ? { column: 'h.placed_at', direction: 'ASC' as const }
          : { column: 'h.placed_at', direction: 'DESC' as const };

    if (query.cursor) {
      try {
        const cursor = decodeCursorV1(query.cursor);
        params.push(cursor.sort, cursor.id);
        const sortParam = `$${params.length - 1}`;
        const idParam = `$${params.length}`;
        whereClauses.push(
          order.direction === 'ASC'
            ? `(${order.column}, h.id) > (${sortParam}::timestamptz, ${idParam}::uuid)`
            : `(${order.column}, h.id) < (${sortParam}::timestamptz, ${idParam}::uuid)`,
        );
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

    params.push(queryLimit);
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
      ORDER BY ${order.column} ${order.direction}, h.id ${order.direction}
      LIMIT ${limitParam}
      `,
      params,
    );

    const rows = result.rows;
    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;

    const last = items.at(-1) ?? null;
    const sortValue =
      !last
        ? null
        : status === 'ready'
          ? // ready_at 理論上不會是 NULL；這裡用 placed_at 做保險 fallback
            (last.ready_at ?? last.placed_at)
          : last.placed_at;

    const next_cursor =
      hasMore && last && sortValue
        ? encodeCursorV1({ sort: normalizeSortToIso(sortValue), id: last.id })
        : null;

    return { items, next_cursor };
  }

  async create(orgId: string, input: CreateHoldInput): Promise<HoldWithDetailsRow> {
    try {
      return await this.db.transaction(async (client) => {
        // 1) borrower：以 external_id 找到讀者，並驗證 role/status。
        const borrower = await this.requireBorrowerByExternalId(
          client,
          orgId,
          input.user_external_id,
        );

        // 2) actor：若有傳 actor_user_id，視為「代辦/館員操作」；否則視為 borrower 本人操作（OPAC 自助）。
        const actor = input.actor_user_id
          ? await this.requireUserById(client, orgId, input.actor_user_id)
          : borrower;

        if (actor.status !== 'active') {
          throw new ConflictException({
            error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
          });
        }

        // 3) 權限（MVP）：
        // - staff（admin/librarian）可以替任何 borrower 建立 hold
        // - borrower 自助只能替自己建立（actor 必須等於 borrower）
        const actorIsStaff = STAFF_ROLES.includes(actor.role);
        if (!actorIsStaff && actor.id !== borrower.id) {
          throw new ForbiddenException({
            error: { code: 'FORBIDDEN', message: 'Actor is not allowed to place hold for this user' },
          });
        }

        // 4) 確認 bib 與 pickup location 都屬於 org，且 pickup location 必須是 active。
        await this.assertBibliographicExists(client, orgId, input.bibliographic_id);
        await this.assertPickupLocationActive(client, orgId, input.pickup_location_id);

        // 5) 取得 borrower 的 policy（用來限制 max_holds 與決定 hold_pickup_days）。
        const policy = await this.getPolicyForRole(client, orgId, borrower.role);
        if (!policy) {
          throw new NotFoundException({
            error: { code: 'POLICY_NOT_FOUND', message: 'Circulation policy not found' },
          });
        }

        // 6) 逾期停權（政策）：若逾期達 X 天，禁止新增預約（避免堆積、也避免繞過 checkout 限制）。
        await assertBorrowingAllowedByOverdue(client, orgId, borrower.id, policy.overdue_block_days);

        // 7) 檢查同時 holds 上限（只計 queued/ready）。
        const activeHoldCount = await this.countActiveHoldsForUser(client, orgId, borrower.id);
        if (activeHoldCount >= policy.max_holds) {
          throw new ConflictException({
            error: { code: 'HOLD_LIMIT_REACHED', message: 'User has reached max holds' },
          });
        }

        // 8) 避免同一書目重複排隊（同 user + bib 的 active hold 只能有一筆）。
        const alreadyActive = await this.hasActiveHoldForUserAndBib(
          client,
          orgId,
          borrower.id,
          input.bibliographic_id,
        );
        if (alreadyActive) {
          throw new ConflictException({
            error: { code: 'HOLD_ALREADY_EXISTS', message: 'User already has an active hold for this title' },
          });
        }

        // 9) 建立 hold（預設 queued）。
        const insert = await client.query<HoldRow>(
          `
          INSERT INTO holds (
            organization_id,
            bibliographic_id,
            user_id,
            pickup_location_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            organization_id,
            bibliographic_id,
            user_id,
            pickup_location_id,
            placed_at,
            status,
            assigned_item_id,
            ready_at,
            ready_until,
            cancelled_at,
            fulfilled_at
          `,
          [orgId, input.bibliographic_id, borrower.id, input.pickup_location_id],
        );

        const hold = insert.rows[0]!;

        // 10) 盡量把可借冊「立即指派」給隊首 queued hold（公平性）：
        // - 若這個 bib 已經有更早的 queued holds，那應該先讓更早的拿到冊
        // - 所以我們不是「直接把冊給新建立的 hold」，而是嘗試把冊給「placed_at 最早的 queued」
        await this.tryAssignAvailableItemToNextQueuedHold(
          client,
          orgId,
          input.bibliographic_id,
        );

        // 10) 寫 audit（誰建立了 hold，替誰建立，目標是什麼書目）。
        await client.query(
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
          `,
          [
            orgId,
            actor.id,
            'hold.create',
            'hold',
            hold.id,
            JSON.stringify({
              user_id: borrower.id,
              user_external_id: borrower.external_id,
              bibliographic_id: input.bibliographic_id,
              pickup_location_id: input.pickup_location_id,
            }),
          ],
        );

        // 11) 回傳最新狀態（可能已被指派成 ready，也可能仍 queued）。
        return await this.getHoldWithDetailsById(client, orgId, hold.id);
      });
    } catch (error: any) {
      // 23505 = unique_violation：如果 DB 有加 unique index（例如 active hold 唯一），可用這裡轉成 409。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'HOLD_ALREADY_EXISTS', message: 'User already has an active hold for this title' },
        });
      }
      // 23503 = foreign_key_violation：引用不存在（保險；正常應該已驗證）。
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Referenced record not found' },
        });
      }
      // 22P02 = invalid_text_representation：UUID 格式錯誤等（保險）。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  async cancel(orgId: string, holdId: string, input: CancelHoldInput) {
    try {
      return await this.db.transaction(async (client) => {
        // 1) 鎖住 hold（FOR UPDATE）：避免同一筆 hold 同時被 fulfill/cancel。
        const hold = await this.requireHoldForUpdate(client, orgId, holdId);

        // queued/ready 才能取消；其他狀態視為不可取消（避免資料被回溯改寫）。
        if (hold.status !== 'queued' && hold.status !== 'ready') {
          throw new ConflictException({
            error: { code: 'HOLD_NOT_CANCELLABLE', message: 'Hold is not cancellable' },
          });
        }

        // 2) 決定 actor：
        // - 若傳 actor_user_id：使用該 user 作為 actor（可能是 staff）
        // - 否則：視為 borrower 本人取消（OPAC 自助）
        const actor = input.actor_user_id
          ? await this.requireUserById(client, orgId, input.actor_user_id)
          : await this.requireUserById(client, orgId, hold.user_id);

        if (actor.status !== 'active') {
          throw new ConflictException({
            error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
          });
        }

        const actorIsStaff = STAFF_ROLES.includes(actor.role);
        const actorIsOwner = actor.id === hold.user_id;

        if (!actorIsStaff && !actorIsOwner) {
          throw new ForbiddenException({
            error: { code: 'FORBIDDEN', message: 'Actor is not allowed to cancel this hold' },
          });
        }

        // 3) 取消 hold：寫 status=cancelled + cancelled_at。
        await client.query(
          `
          UPDATE holds
          SET status = 'cancelled',
              cancelled_at = now()
          WHERE organization_id = $1
            AND id = $2
          `,
          [orgId, hold.id],
        );

        // 4) 若 hold 是 ready 且有指派冊，我們需要處理「釋放冊」或「轉給下一位 queued」。
        if (hold.status === 'ready' && hold.assigned_item_id) {
          const item = await this.requireItemByIdForUpdate(client, orgId, hold.assigned_item_id);

          // 只有 item.status=on_hold 時才需要處理釋放/轉讓；
          // - 如果 item 已 checked_out，代表已被借走（理論上 hold 不會是 ready）
          // - 如果 item 已 available，代表已被釋放（可能是資料修正），不再重複處理
          if (item.status === 'on_hold') {
            const next = await this.findNextQueuedHold(client, orgId, hold.bibliographic_id);

            if (next) {
              // 4.1 若有下一位 queued：把同一冊轉給隊首，並更新 ready_until。
              const pickupDays = next.hold_pickup_days ?? DEFAULT_HOLD_PICKUP_DAYS;

              await client.query(
                `
                UPDATE holds
                SET status = 'ready',
                    assigned_item_id = $1,
                    ready_at = now(),
                    ready_until = now() + ($2::int * interval '1 day')
                WHERE organization_id = $3
                  AND id = $4
                `,
                [item.id, pickupDays, orgId, next.id],
              );

              // item.status 維持 on_hold（因為仍有 ready hold 指派）。
            } else {
              // 4.2 沒有 queued：把冊釋放回 available。
              await client.query(
                `
                UPDATE item_copies
                SET status = 'available', updated_at = now()
                WHERE organization_id = $1
                  AND id = $2
                `,
                [orgId, item.id],
              );
            }
          }
        }

        // 5) 寫 audit
        await client.query(
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
          `,
          [
            orgId,
            actor.id,
            'hold.cancel',
            'hold',
            hold.id,
            JSON.stringify({
              assigned_item_id: hold.assigned_item_id,
              previous_status: hold.status,
            }),
          ],
        );

        // 6) 回傳更新後的 hold（含顯示資訊）。
        return await this.getHoldWithDetailsById(client, orgId, hold.id);
      });
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Referenced record not found' },
        });
      }
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  async fulfill(orgId: string, holdId: string, input: FulfillHoldInput) {
    try {
      return await this.db.transaction(async (client) => {
        // 1) actor 必須是 staff（館員/管理者）
        const actor = await this.requireUserById(client, orgId, input.actor_user_id);

        if (actor.status !== 'active') {
          throw new ConflictException({
            error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
          });
        }

        if (!STAFF_ROLES.includes(actor.role)) {
          throw new ForbiddenException({
            error: { code: 'FORBIDDEN', message: 'Actor is not allowed to fulfill holds' },
          });
        }

        // 2) 鎖住 hold
        const hold = await this.requireHoldForUpdate(client, orgId, holdId);

        if (hold.status !== 'ready') {
          throw new ConflictException({
            error: { code: 'HOLD_NOT_READY', message: 'Hold is not ready to fulfill' },
          });
        }

        if (!hold.assigned_item_id) {
          throw new ConflictException({
            error: { code: 'HOLD_NO_ASSIGNED_ITEM', message: 'Hold has no assigned item' },
          });
        }

        // 若 ready_until 已過期，視為不可 fulfill（MVP 先用 conflict 告知）。
        // - 未來可改成：自動將 hold 標記 expired，並把冊轉給下一位 queued
        if (hold.ready_until) {
          const expired = await this.isReadyUntilExpired(client, hold.ready_until);
          if (expired) {
            throw new ConflictException({
              error: { code: 'HOLD_EXPIRED', message: 'Hold pickup window has expired' },
            });
          }
        }

        // 3) 鎖住 item（避免同冊同時被借出/改狀態）
        const item = await this.requireItemByIdForUpdate(client, orgId, hold.assigned_item_id);

        if (item.bibliographic_id !== hold.bibliographic_id) {
          throw new ConflictException({
            error: { code: 'HOLD_ITEM_MISMATCH', message: 'Assigned item does not match hold bibliographic_id' },
          });
        }

        // 必須是 on_hold 才能 fulfill（否則代表冊已被借走或被釋放）。
        if (item.status !== 'on_hold') {
          throw new ConflictException({
            error: { code: 'ITEM_NOT_ON_HOLD', message: 'Item is not on hold' },
          });
        }

        // 4) borrower：用 hold.user_id 找到借閱者，並驗證角色與狀態。
        const borrower = await this.requireBorrowerById(client, orgId, hold.user_id);

        // 5) 取得 policy：用來算 due_at 與檢查借閱上限（max_loans）。
        const policy = await this.getPolicyForRole(client, orgId, borrower.role);
        if (!policy) {
          throw new NotFoundException({
            error: { code: 'POLICY_NOT_FOUND', message: 'Circulation policy not found' },
          });
        }

        // 6) 逾期停權（政策）：若逾期達 X 天，禁止取書借出（因為會建立 loan，屬於新增借閱）。
        await assertBorrowingAllowedByOverdue(client, orgId, borrower.id, policy.overdue_block_days);

        // 7) 借閱上限：在建立 loan 前先檢查。
        const openLoanCount = await this.countOpenLoansForUser(client, orgId, borrower.id);
        if (openLoanCount >= policy.max_loans) {
          throw new ConflictException({
            error: { code: 'LOAN_LIMIT_REACHED', message: 'User has reached max loans' },
          });
        }

        // 8) 建立 loan
        const loanResult = await client.query<LoanRow>(
          `
          INSERT INTO loans (organization_id, item_id, user_id, due_at)
          VALUES ($1, $2, $3, now() + ($4::int * interval '1 day'))
          RETURNING id, user_id, item_id, due_at, status
          `,
          [orgId, item.id, borrower.id, policy.loan_days],
        );
        const loan = loanResult.rows[0]!;

        // 9) 更新 item：on_hold → checked_out
        await client.query(
          `
          UPDATE item_copies
          SET status = 'checked_out', updated_at = now()
          WHERE organization_id = $1
            AND id = $2
          `,
          [orgId, item.id],
        );

        // 10) 更新 hold：ready → fulfilled
        await client.query(
          `
          UPDATE holds
          SET status = 'fulfilled',
              fulfilled_at = now()
          WHERE organization_id = $1
            AND id = $2
          `,
          [orgId, hold.id],
        );

        // 11) 寫 audit：同時記錄 hold.fulfill 與 loan.checkout（方便之後查稽核）
        await client.query(
          `
          INSERT INTO audit_events (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
          VALUES
            ($1, $2, $3, $4, $5, $6::jsonb),
            ($1, $2, $7, $8, $9, $10::jsonb)
          `,
          [
            orgId,
            actor.id,
            'hold.fulfill',
            'hold',
            hold.id,
            JSON.stringify({
              loan_id: loan.id,
              item_id: item.id,
              user_id: borrower.id,
              item_barcode: item.barcode,
            }),
            'loan.checkout',
            'loan',
            loan.id,
            JSON.stringify({
              item_id: item.id,
              user_id: borrower.id,
              item_barcode: item.barcode,
              hold_id: hold.id,
            }),
          ],
        );

        // 12) 回傳結果（給 UI 顯示）
        return {
          hold_id: hold.id,
          loan_id: loan.id,
          item_id: item.id,
          item_barcode: item.barcode,
          user_id: borrower.id,
          due_at: loan.due_at,
        };
      });
    } catch (error: any) {
      // 23505：同冊只能有一筆未歸還借閱（partial unique index）
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'ITEM_ALREADY_CHECKED_OUT', message: 'Item already checked out' },
        });
      }
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Referenced record not found' },
        });
      }
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  /**
   * expireReady（Holds 到期處理）
   *
   * - 把 status=ready 且 ready_until < as_of 的 hold 標記為 expired
   * - 若該 hold 有指派冊：
   *   - 若有下一位 queued：把同冊轉派給隊首（queued → ready）
   *   - 若沒有 queued：把冊釋放回 available
   *
   * 為什麼要做成「館員動作端點」？
   * - ready_until 過期是「需要每日處理」的現場工作（到書未取）
   * - 沒有這步，冊會長期卡在 on_hold，降低可借率
   * - MVP 沒有排程器/背景工作者，因此先做成可手動觸發的端點（後續可接 cron）
   */
  async expireReady(orgId: string, input: ExpireReadyHoldsInput): Promise<ExpireReadyHoldsResult> {
    try {
      return await this.db.transaction(async (client) => {
        // 1) actor 必須是 staff（館員/管理者）
        const actor = await this.requireUserById(client, orgId, input.actor_user_id);

        if (actor.status !== 'active') {
          throw new ConflictException({
            error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
          });
        }

        if (!STAFF_ROLES.includes(actor.role)) {
          throw new ForbiddenException({
            error: { code: 'FORBIDDEN', message: 'Actor is not allowed to expire holds' },
          });
        }

        // 2) as_of：若未提供，使用 DB now()（避免 API server 與 DB 時鐘差異）
        const asOf = await this.resolveAsOf(client, input.as_of);

        // 3) limit：一次最多處理/預覽多少筆（避免鎖太久）
        const limit = input.limit ?? 200;

        // 4) candidates_total：先算「總共有多少筆 ready hold 已過期」
        // - 這能讓 UI 顯示「你是否需要調大 limit 或分批處理」
        const countResult = await client.query<{ count: string }>(
          `
          SELECT COUNT(*)::text AS count
          FROM holds
          WHERE organization_id = $1
            AND status = 'ready'
            AND ready_until IS NOT NULL
            AND ready_until < $2::timestamptz
          `,
          [orgId, asOf],
        );
        const candidatesTotal = Number.parseInt(countResult.rows[0]?.count ?? '0', 10);

        // 5) preview：只列出「會被處理」的清單（不寫 DB）
        if (input.mode === 'preview') {
          const holds = await this.listExpiredReadyHoldsWithDetails(client, orgId, asOf, limit);

          return {
            mode: 'preview',
            as_of: asOf,
            limit,
            candidates_total: candidatesTotal,
            holds,
          };
        }

        // 6) apply：鎖住要處理的 holds（SKIP LOCKED 避免卡住 fulfill/取消）
        const candidates = await client.query<ExpiredReadyHoldCandidateRow>(
          `
          SELECT id, user_id, bibliographic_id, assigned_item_id, ready_until
          FROM holds
          WHERE organization_id = $1
            AND status = 'ready'
            AND ready_until IS NOT NULL
            AND ready_until < $2::timestamptz
          ORDER BY ready_until ASC
          LIMIT $3
          FOR UPDATE SKIP LOCKED
          `,
          [orgId, asOf, limit],
        );

        const results: ExpireReadyHoldsApplyRow[] = [];
        let transferred = 0;
        let released = 0;
        let skippedItemAction = 0;

        // 7) 逐筆處理（同一個 transaction 內）
        for (const hold of candidates.rows) {
          // 7.1 先把 hold 標記 expired（此時仍保留 assigned_item_id，作為歷史資訊）
          await client.query(
            `
            UPDATE holds
            SET status = 'expired'
            WHERE organization_id = $1
              AND id = $2
            `,
            [orgId, hold.id],
          );

          let assignedItemBarcode: string | null = null;
          let itemStatusBefore: ItemStatus | null = null;
          let itemStatusAfter: ItemStatus | null = null;
          let transferredToHoldId: string | null = null;

          // 7.2 若有指派冊：決定要「轉派」還是「釋放」
          // - 沒有指派冊：代表資料不一致（理論上 ready 一定有 assigned item）
          //   但我們仍可把它標記 expired，避免 UI 卡著一筆無法 fulfill 的 ready hold
          if (!hold.assigned_item_id) {
            skippedItemAction += 1;
          } else {
            // 鎖住 item（與 cancel/fulfill 同樣：hold → item 的鎖順序）
            const item = await this.requireItemByIdForUpdate(client, orgId, hold.assigned_item_id);

            assignedItemBarcode = item.barcode;
            itemStatusBefore = item.status;
            itemStatusAfter = item.status;

            // 保險：如果 item 其實不是同一本書目的冊，代表資料有問題；不要擅自改 item
            if (item.bibliographic_id !== hold.bibliographic_id) {
              skippedItemAction += 1;
            } else if (item.status === 'on_hold' || item.status === 'available') {
              // 正常情境：ready hold 的 item 應該是 on_hold
              // - 但若曾被手動釋放成 available，我們仍可以把它轉派給下一位 queued hold

              const next = await this.findNextQueuedHold(client, orgId, hold.bibliographic_id);

              if (next) {
                // 轉派：把 item 指派給下一位 queued hold
                const pickupDays = next.hold_pickup_days ?? DEFAULT_HOLD_PICKUP_DAYS;

                // 若 item 目前是 available，需要先轉回 on_hold（避免被 checkout）
                if (item.status !== 'on_hold') {
                  await client.query(
                    `
                    UPDATE item_copies
                    SET status = 'on_hold', updated_at = now()
                    WHERE organization_id = $1
                      AND id = $2
                    `,
                    [orgId, item.id],
                  );
                }

                await client.query(
                  `
                  UPDATE holds
                  SET status = 'ready',
                      assigned_item_id = $1,
                      ready_at = now(),
                      ready_until = now() + ($2::int * interval '1 day')
                  WHERE organization_id = $3
                    AND id = $4
                  `,
                  [item.id, pickupDays, orgId, next.id],
                );

                transferredToHoldId = next.id;
                transferred += 1;
                itemStatusAfter = 'on_hold';
              } else {
                // 釋放：沒有 queued holds，就把冊釋放回 available
                await client.query(
                  `
                  UPDATE item_copies
                  SET status = 'available', updated_at = now()
                  WHERE organization_id = $1
                    AND id = $2
                  `,
                  [orgId, item.id],
                );

                released += 1;
                itemStatusAfter = 'available';
              }
            } else {
              // item 狀態不在 on_hold/available：
              // - 例如 checked_out（代表已被借走）、lost/withdrawn/repair
              // - 這些都不應該在這個 job 裡擅自改動，因此只標記 hold expired，item 不動
              skippedItemAction += 1;
            }
          }

          // 7.3 寫 audit（每筆 hold 一個事件，方便用 entity_id=holdId 追溯）
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
              'hold.expire',
              'hold',
              hold.id,
              JSON.stringify({
                as_of: asOf,
                note: input.note ?? null,
                previous_status: 'ready',
                ready_until: hold.ready_until,
                assigned_item_id: hold.assigned_item_id,
                assigned_item_barcode: assignedItemBarcode,
                item_status_before: itemStatusBefore,
                item_status_after: itemStatusAfter,
                transferred_to_hold_id: transferredToHoldId,
              }),
            ],
          );

          results.push({
            hold_id: hold.id,
            assigned_item_id: hold.assigned_item_id,
            assigned_item_barcode: assignedItemBarcode,
            item_status_before: itemStatusBefore,
            item_status_after: itemStatusAfter,
            transferred_to_hold_id: transferredToHoldId,
            audit_event_id: auditInsert.rows[0]!.id,
          });
        }

        return {
          mode: 'apply',
          as_of: asOf,
          limit,
          summary: {
            candidates_total: candidatesTotal,
            processed: results.length,
            transferred,
            released,
            skipped_item_action: skippedItemAction,
          },
          results,
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
  // helper functions（DB 查詢與業務規則）
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

  private async requireBorrowerByExternalId(client: PoolClient, orgId: string, externalId: string) {
    const result = await client.query<UserRow>(
      `
      SELECT id, external_id, name, role, status
      FROM users
      WHERE organization_id = $1
        AND external_id = $2
      `,
      [orgId, externalId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Borrower not found' },
      });
    }

    const user = result.rows[0]!;

    if (user.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'Borrower is inactive' },
      });
    }

    if (!BORROWER_ROLES.includes(user.role)) {
      throw new BadRequestException({
        error: { code: 'UNSUPPORTED_ROLE', message: 'Borrower role is not supported' },
      });
    }

    return user;
  }

  private async requireBorrowerById(client: PoolClient, orgId: string, borrowerUserId: string) {
    const user = await this.requireUserById(client, orgId, borrowerUserId);

    if (user.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'Borrower is inactive' },
      });
    }

    if (!BORROWER_ROLES.includes(user.role)) {
      throw new BadRequestException({
        error: { code: 'UNSUPPORTED_ROLE', message: 'Borrower role is not supported' },
      });
    }

    return user;
  }

  private async assertBibliographicExists(client: PoolClient, orgId: string, bibId: string) {
    const result = await client.query<BibRow>(
      `
      SELECT id, title
      FROM bibliographic_records
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, bibId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Bibliographic record not found' },
      });
    }
  }

  /**
   * assertPickupLocationActive：驗證「取書地點」存在且為 active
   *
   * 需求（US-001 + OPAC UX）：
   * - locations.status=inactive 代表「已停用館別/位置」
   * - 停用的 location 不應再被用作「新建立預約的取書地點」（避免讀者選到關閉的分館）
   *
   * 注意：
   * - 這個檢查只影響「新建立 hold」；既有 holds 仍可被查詢/取消/fulfill
   * - 若未來需要「更改 pickup location」，可在 holds PATCH 時重用這個檢查
   */
  private async assertPickupLocationActive(client: PoolClient, orgId: string, locationId: string) {
    const result = await client.query<LocationRow>(
      `
      SELECT id, code, name, status
      FROM locations
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, locationId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Location not found' },
      });
    }

    const location = result.rows[0]!;
    if (location.status !== 'active') {
      throw new ConflictException({
        error: { code: 'LOCATION_INACTIVE', message: 'Pickup location is inactive' },
      });
    }
  }

  private async getPolicyForRole(client: PoolClient, orgId: string, role: UserRole) {
    const result = await client.query<PolicyRow>(
      `
      SELECT
        id,
        audience_role,
        loan_days,
        max_loans,
        max_holds,
        max_renewals,
        hold_pickup_days,
        overdue_block_days
      FROM circulation_policies
      WHERE organization_id = $1
        AND audience_role = $2::user_role
        AND is_active = true
      LIMIT 1
      `,
      [orgId, role],
    );

    return result.rows[0] ?? null;
  }

  private async countActiveHoldsForUser(client: PoolClient, orgId: string, userId: string) {
    const result = await client.query<{ count: number }>(
      `
      SELECT COUNT(*)::int AS count
      FROM holds
      WHERE organization_id = $1
        AND user_id = $2
        AND status IN ('queued'::hold_status, 'ready'::hold_status)
      `,
      [orgId, userId],
    );

    return result.rows[0]?.count ?? 0;
  }

  private async hasActiveHoldForUserAndBib(
    client: PoolClient,
    orgId: string,
    userId: string,
    bibId: string,
  ) {
    const result = await client.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM holds
        WHERE organization_id = $1
          AND user_id = $2
          AND bibliographic_id = $3
          AND status IN ('queued'::hold_status, 'ready'::hold_status)
      ) AS exists
      `,
      [orgId, userId, bibId],
    );

    return result.rows[0]?.exists ?? false;
  }

  private async requireHoldForUpdate(client: PoolClient, orgId: string, holdId: string) {
    const result = await client.query<HoldForUpdateRow>(
      `
      SELECT id, user_id, bibliographic_id, pickup_location_id, status, assigned_item_id, ready_until
      FROM holds
      WHERE organization_id = $1
        AND id = $2
      FOR UPDATE
      `,
      [orgId, holdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Hold not found' },
      });
    }

    return result.rows[0]!;
  }

  private async requireItemByIdForUpdate(client: PoolClient, orgId: string, itemId: string) {
    const result = await client.query<ItemForUpdateRow>(
      `
      SELECT id, bibliographic_id, barcode, status
      FROM item_copies
      WHERE organization_id = $1
        AND id = $2
      FOR UPDATE
      `,
      [orgId, itemId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Item not found' },
      });
    }

    return result.rows[0]!;
  }

  /**
   * findNextQueuedHold：找同書目的隊首 queued hold（並鎖住它）
   *
   * 我們需要 hold_pickup_days：
   * - holds 表本身沒有這欄
   * - 必須依 queued hold 的 user.role 找 policy
   */
  private async findNextQueuedHold(
    client: PoolClient,
    orgId: string,
    bibId: string,
  ): Promise<{ id: string; hold_pickup_days: number | null } | null> {
    const result = await client.query<{ id: string; hold_pickup_days: number | null }>(
      `
      SELECT
        h.id,
        p.hold_pickup_days
      FROM holds h
      JOIN users u
        ON u.id = h.user_id
       AND u.organization_id = h.organization_id
      -- policy（取「有效政策」）：
      -- - circulation_policies 允許同 role 多筆（可保留歷史版本）
      -- - 但每個 role 同時只允許一筆 is_active=true（由 DB partial unique index 保證）
      -- - 用 LATERAL subquery 讓每筆 queued hold 都能拿到對應的 hold_pickup_days
      LEFT JOIN LATERAL (
        SELECT cp.hold_pickup_days
        FROM circulation_policies cp
        WHERE cp.organization_id = h.organization_id
          AND cp.audience_role = u.role
          AND cp.is_active = true
        LIMIT 1
      ) p ON true
      WHERE h.organization_id = $1
        AND h.bibliographic_id = $2
        AND h.status = 'queued'
      ORDER BY h.placed_at ASC
      LIMIT 1
      -- 只鎖 holds 的隊首那一筆，避免不必要鎖住 users/policies 造成等待
      FOR UPDATE OF h
      `,
      [orgId, bibId],
    );

    return result.rows[0] ?? null;
  }

  /**
   * 嘗試把「可借冊」指派給「隊首 queued hold」
   *
   * 設計說明：
   * - 這個函式一次只做「最多一筆指派」
   * - 目的是：當有人建立 hold 時，如果剛好有 available item，可以立刻轉成 ready
   * - 公平性：永遠指派給 placed_at 最早的 queued hold，而不是最新建立者
   */
  private async tryAssignAvailableItemToNextQueuedHold(
    client: PoolClient,
    orgId: string,
    bibId: string,
  ) {
    // 1) 找隊首 queued hold（鎖住）
    const nextHold = await this.findNextQueuedHold(client, orgId, bibId);
    if (!nextHold) return;

    // 2) 找一冊 available item（鎖住 item；SKIP LOCKED 避免多交易搶同一冊）
    const itemResult = await client.query<{ id: string; barcode: string }>(
      `
      SELECT id, barcode
      FROM item_copies
      WHERE organization_id = $1
        AND bibliographic_id = $2
        AND status = 'available'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
      `,
      [orgId, bibId],
    );

    const item = itemResult.rows[0];
    if (!item) return;

    // 3) 先把 item 標記為 on_hold（避免被一般 checkout 借走）
    await client.query(
      `
      UPDATE item_copies
      SET status = 'on_hold', updated_at = now()
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, item.id],
    );

    // 4) 把 hold 轉成 ready 並指派 item
    const pickupDays = nextHold.hold_pickup_days ?? DEFAULT_HOLD_PICKUP_DAYS;

    await client.query(
      `
      UPDATE holds
      SET status = 'ready',
          assigned_item_id = $1,
          ready_at = now(),
          ready_until = now() + ($2::int * interval '1 day')
      WHERE organization_id = $3
        AND id = $4
      `,
      [item.id, pickupDays, orgId, nextHold.id],
    );
  }

  private async countOpenLoansForUser(client: PoolClient, orgId: string, userId: string) {
    const result = await client.query<{ count: number }>(
      `
      SELECT COUNT(*)::int AS count
      FROM loans
      WHERE organization_id = $1
        AND user_id = $2
        AND returned_at IS NULL
      `,
      [orgId, userId],
    );

    return result.rows[0]?.count ?? 0;
  }

  private async getHoldWithDetailsById(client: PoolClient, orgId: string, holdId: string) {
    const result = await client.query<HoldWithDetailsRow>(
      `
      SELECT
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
        u.external_id AS user_external_id,
        u.name AS user_name,
        u.role AS user_role,
        b.title AS bibliographic_title,
        pl.code AS pickup_location_code,
        pl.name AS pickup_location_name,
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
      WHERE h.organization_id = $1
        AND h.id = $2
      `,
      [orgId, holdId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Hold not found' },
      });
    }
    return row;
  }

  /**
   * 判斷 ready_until 是否已過期（在 DB 端比較 now()）
   *
   * 為什麼用 DB now()？
   * - API server 與 DB 的時鐘可能有些微誤差
   * - 用 DB now() 做比較，能與其他查詢（overdue 推導）保持一致
   */
  private async isReadyUntilExpired(client: PoolClient, readyUntil: string) {
    const result = await client.query<{ expired: boolean }>(
      `
      SELECT ($1::timestamptz < now()) AS expired
      `,
      [readyUntil],
    );
    return result.rows[0]?.expired ?? false;
  }

  private async resolveAsOf(client: PoolClient, asOfRaw: string | undefined) {
    const trimmed = asOfRaw?.trim() ? asOfRaw.trim() : null;

    if (trimmed) return trimmed;

    // 由 DB 取得 now()：
    // - 這樣「比較 ready_until 是否過期」與「本次操作的 as_of」使用同一個時間來源
    const result = await client.query<{ now: string }>(`SELECT now()::timestamptz::text AS now`);
    return result.rows[0]?.now ?? new Date().toISOString();
  }

  /**
   * 查詢「已過期的 ready holds」（含顯示欄位）
   *
   * - 這個查詢是給 preview 用：不鎖資料
   * - apply 則會用另一個 FOR UPDATE SKIP LOCKED 查詢（避免卡住）
   */
  private async listExpiredReadyHoldsWithDetails(
    client: PoolClient,
    orgId: string,
    asOf: string,
    limit: number,
  ): Promise<HoldWithDetailsRow[]> {
    const result = await client.query<HoldWithDetailsRow>(
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
      WHERE h.organization_id = $1
        AND h.status = 'ready'
        AND h.ready_until IS NOT NULL
        AND h.ready_until < $2::timestamptz
      ORDER BY h.ready_until ASC
      LIMIT $3
      `,
      [orgId, asOf, limit],
    );

    return result.rows;
  }
}
