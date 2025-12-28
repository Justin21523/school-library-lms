/**
 * ItemsService
 *
 * 冊（item_copies）的資料存取與查詢邏輯。
 * - list：依 barcode/status/location/bibliographic_id 篩選
 * - create：在某書目底下新增冊
 * - getById：取得單一冊
 * - update：更新位置/狀態/備註等
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
import { itemStatusValues } from './items.schemas';
import type { CreateItemInput, ListItemsQuery, UpdateItemInput } from './items.schemas';
import type {
  MarkItemLostInput,
  MarkItemRepairInput,
  MarkItemWithdrawnInput,
} from './items.schemas';

type ItemStatus = (typeof itemStatusValues)[number];

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

// staff role：館員/管理者（能做異常狀態標記）
const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

// ItemRow：對應 item_copies 欄位。
type ItemRow = {
  id: string;
  organization_id: string;
  bibliographic_id: string;
  barcode: string;
  call_number: string;
  location_id: string;
  status: ItemStatus;
  acquired_at: string | null;
  last_inventory_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * ItemDetailResult（Item detail 組合狀態）
 *
 * 需求背景：
 * - scale seed 下，館員常會點進「冊詳情」確認：
 *   1) 這冊目前是不是被借走？（open loan）
 *   2) 這冊是否已被指派給某位讀者取書？（ready hold + assigned_item_id）
 *
 * 因此我們把 item 本體 + 流通狀態一起回傳，避免前端為了顯示一頁而打 2~3 個 API。
 */
type ItemDetailResult = {
  item: ItemRow;
  current_loan: null | {
    id: string;
    user_id: string;
    user_external_id: string;
    user_name: string;
    checked_out_at: string;
    due_at: string;
  };
  assigned_hold: null | {
    id: string;
    user_id: string;
    user_external_id: string;
    user_name: string;
    bibliographic_id: string;
    pickup_location_id: string;
    placed_at: string;
    ready_at: string | null;
    ready_until: string | null;
  };
};

type ActorRow = { id: string; role: UserRole; status: UserStatus };

type OpenLoanRow = { id: string; user_id: string; due_at: string };

type ReadyHoldRow = { id: string; user_id: string; bibliographic_id: string; ready_until: string | null };

@Injectable()
export class ItemsService {
  constructor(private readonly db: DbService) {}

  async list(
    orgId: string,
    query: ListItemsQuery,
  ): Promise<CursorPage<ItemRow>> {
    // items list 在 scale seed 下可能非常大，因此採用 cursor pagination（keyset）。
    // - 排序鍵：created_at DESC, id DESC
    // - next page 條件：(created_at, id) < (cursor.sort, cursor.id)

    const whereClauses: string[] = ['organization_id = $1'];
    const params: unknown[] = [orgId];

    if (query.barcode) {
      params.push(`%${query.barcode}%`);
      whereClauses.push(`barcode ILIKE $${params.length}`);
    }

    if (query.status) {
      // schema 已保證 status 是合法 enum；這裡仍 cast 一次讓 SQL 更明確。
      params.push(query.status);
      whereClauses.push(`status = $${params.length}::item_status`);
    }

    if (query.location_id) {
      params.push(query.location_id);
      whereClauses.push(`location_id = $${params.length}::uuid`);
    }

    if (query.bibliographic_id) {
      params.push(query.bibliographic_id);
      whereClauses.push(`bibliographic_id = $${params.length}::uuid`);
    }

    if (query.cursor) {
      try {
        const cursor = decodeCursorV1(query.cursor);
        params.push(cursor.sort, cursor.id);
        const sortParam = `$${params.length - 1}`;
        const idParam = `$${params.length}`;
        whereClauses.push(`(created_at, id) < (${sortParam}::timestamptz, ${idParam}::uuid)`);
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

    const pageSize = query.limit ?? 200;
    const queryLimit = pageSize + 1;
    params.push(queryLimit);
    const limitParam = `$${params.length}`;

    const result = await this.db.query<ItemRow>(
      `
      SELECT
        id,
        organization_id,
        bibliographic_id,
        barcode,
        call_number,
        location_id,
        status,
        acquired_at,
        last_inventory_at,
        notes,
        created_at,
        updated_at
      FROM item_copies
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limitParam}
      `,
      params,
    );

    const rows = result.rows;
    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;

    const last = items.at(-1) ?? null;
    const next_cursor =
      hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.id }) : null;

    return { items, next_cursor };
  }

  async create(orgId: string, bibId: string, input: CreateItemInput): Promise<ItemRow> {
    // 防止跨 org 亂接：先確認 bibliographic/location 都屬於同一 org。
    await this.assertBibliographicExists(orgId, bibId);
    await this.assertLocationActive(orgId, input.location_id);

    try {
      const result = await this.db.query<ItemRow>(
        `
        INSERT INTO item_copies (
          organization_id,
          bibliographic_id,
          barcode,
          call_number,
          location_id,
          status,
          acquired_at,
          last_inventory_at,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          organization_id,
          bibliographic_id,
          barcode,
          call_number,
          location_id,
          status,
          acquired_at,
          last_inventory_at,
          notes,
          created_at,
          updated_at
        `,
        [
          orgId,
          bibId,
          input.barcode,
          input.call_number,
          input.location_id,
          input.status ?? 'available',
          input.acquired_at ?? null,
          input.last_inventory_at ?? null,
          input.notes ?? null,
        ],
      );
      return result.rows[0]!;
    } catch (error: any) {
      // 23505 = unique_violation：barcode 在同 org 內重複。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'Barcode already exists in this organization' },
        });
      }
      // 23503 = foreign_key_violation：bib/location 不存在（保險）。
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Referenced record not found' },
        });
      }
      // 22P02 = invalid_text_representation：UUID/enum 格式錯誤。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  async getById(orgId: string, itemId: string): Promise<ItemDetailResult> {
    // 這裡使用 LATERAL subquery 的原因：
    // - open loan / ready hold 都應該「最多一筆」（由 constraint/流程保證，但仍可能因資料不一致而多筆）
    // - LATERAL + LIMIT 1 能保證 item detail 回傳固定 1 row，避免 join 造成 row 爆炸
    type ItemDetailQueryRow = ItemRow & {
      loan_id: string | null;
      loan_user_id: string | null;
      loan_checked_out_at: string | null;
      loan_due_at: string | null;
      loan_user_external_id: string | null;
      loan_user_name: string | null;

      hold_id: string | null;
      hold_user_id: string | null;
      hold_bibliographic_id: string | null;
      hold_pickup_location_id: string | null;
      hold_placed_at: string | null;
      hold_ready_at: string | null;
      hold_ready_until: string | null;
      hold_user_external_id: string | null;
      hold_user_name: string | null;
    };

    const result = await this.db.query<ItemDetailQueryRow>(
      `
      SELECT
        -- item 本體
        i.id,
        i.organization_id,
        i.bibliographic_id,
        i.barcode,
        i.call_number,
        i.location_id,
        i.status,
        i.acquired_at,
        i.last_inventory_at,
        i.notes,
        i.created_at,
        i.updated_at,

        -- current open loan（可能為 NULL）
        l.id AS loan_id,
        l.user_id AS loan_user_id,
        l.checked_out_at AS loan_checked_out_at,
        l.due_at AS loan_due_at,
        lu.external_id AS loan_user_external_id,
        lu.name AS loan_user_name,

        -- assigned ready hold（可能為 NULL）
        h.id AS hold_id,
        h.user_id AS hold_user_id,
        h.bibliographic_id AS hold_bibliographic_id,
        h.pickup_location_id AS hold_pickup_location_id,
        h.placed_at AS hold_placed_at,
        h.ready_at AS hold_ready_at,
        h.ready_until AS hold_ready_until,
        hu.external_id AS hold_user_external_id,
        hu.name AS hold_user_name
      FROM item_copies i
      -- open loan：returned_at IS NULL
      LEFT JOIN LATERAL (
        SELECT id, user_id, checked_out_at, due_at
        FROM loans
        WHERE organization_id = i.organization_id
          AND item_id = i.id
          AND returned_at IS NULL
        LIMIT 1
      ) l ON true
      LEFT JOIN users lu
        ON lu.id = l.user_id
       AND lu.organization_id = i.organization_id
      -- ready hold：status='ready' AND assigned_item_id = itemId
      LEFT JOIN LATERAL (
        SELECT
          id,
          user_id,
          bibliographic_id,
          pickup_location_id,
          placed_at,
          ready_at,
          ready_until
        FROM holds
        WHERE organization_id = i.organization_id
          AND assigned_item_id = i.id
          AND status = 'ready'
        ORDER BY ready_at ASC NULLS LAST, placed_at ASC
        LIMIT 1
      ) h ON true
      LEFT JOIN users hu
        ON hu.id = h.user_id
       AND hu.organization_id = i.organization_id
      WHERE i.organization_id = $1
        AND i.id = $2
      `,
      [orgId, itemId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Item not found' },
      });
    }

    const row = result.rows[0]!;

    const item: ItemRow = {
      id: row.id,
      organization_id: row.organization_id,
      bibliographic_id: row.bibliographic_id,
      barcode: row.barcode,
      call_number: row.call_number,
      location_id: row.location_id,
      status: row.status,
      acquired_at: row.acquired_at,
      last_inventory_at: row.last_inventory_at,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const current_loan = row.loan_id
      ? {
          id: row.loan_id,
          user_id: row.loan_user_id!,
          user_external_id: row.loan_user_external_id ?? '(unknown)',
          user_name: row.loan_user_name ?? '(unknown)',
          checked_out_at: row.loan_checked_out_at!,
          due_at: row.loan_due_at!,
        }
      : null;

    const assigned_hold = row.hold_id
      ? {
          id: row.hold_id,
          user_id: row.hold_user_id!,
          user_external_id: row.hold_user_external_id ?? '(unknown)',
          user_name: row.hold_user_name ?? '(unknown)',
          bibliographic_id: row.hold_bibliographic_id!,
          pickup_location_id: row.hold_pickup_location_id!,
          placed_at: row.hold_placed_at!,
          ready_at: row.hold_ready_at,
          ready_until: row.hold_ready_until,
        }
      : null;

    return { item, current_loan, assigned_hold };
  }

  async update(orgId: string, itemId: string, input: UpdateItemInput): Promise<ItemRow> {
    const setClauses: string[] = [];
    const params: unknown[] = [orgId, itemId];

    const addClause = (column: string, value: unknown) => {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    };

    if (input.barcode !== undefined) addClause('barcode', input.barcode);
    if (input.call_number !== undefined) addClause('call_number', input.call_number);

    if (input.location_id !== undefined) {
      // 更新 location 前先確認它屬於同 org，且必須是 active（避免把冊掛到停用館別）。
      await this.assertLocationActive(orgId, input.location_id);
      addClause('location_id', input.location_id);
    }

    // 注意：status 不允許走一般 PATCH（避免沒有 actor/audit，也避免不合理轉換）。
    // - 狀態異動請用 ItemsController 的 action endpoints（mark-lost/mark-repair/mark-withdrawn）
    if (input.acquired_at !== undefined) addClause('acquired_at', input.acquired_at);
    if (input.last_inventory_at !== undefined)
      addClause('last_inventory_at', input.last_inventory_at);
    if (input.notes !== undefined) addClause('notes', input.notes);

    if (setClauses.length === 0) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
      });
    }

    setClauses.push('updated_at = now()');

    try {
      const result = await this.db.query<ItemRow>(
        `
        UPDATE item_copies
        SET ${setClauses.join(', ')}
        WHERE organization_id = $1
          AND id = $2
        RETURNING
          id,
          organization_id,
          bibliographic_id,
          barcode,
          call_number,
          location_id,
          status,
          acquired_at,
          last_inventory_at,
          notes,
          created_at,
          updated_at
        `,
        params,
      );

      if (result.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        });
      }

      return result.rows[0]!;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;

      // 23505 = unique_violation：barcode 重複。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'Barcode already exists in this organization' },
        });
      }
      // 22P02 = invalid_text_representation：UUID/enum 格式錯誤。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  /**
   * markLost：標記冊為 lost（遺失）
   *
   * 允許的來源狀態（MVP）：
   * - available：館員盤點發現遺失
   * - checked_out：借出後遺失（例如學生遺失）
   *
   * 不允許（避免破壞流程/造成不一致）：
   * - on_hold：代表此冊已指派給 ready hold；若要處理遺失，應先處理該 hold（取消/改指派）
   * - repair/withdrawn/lost：重複標記沒有意義（或應走其他流程）
   */
  async markLost(orgId: string, itemId: string, input: MarkItemLostInput): Promise<ItemRow> {
    try {
      return await this.db.transaction(async (client) => {
        // 1) 驗證 actor（館員/管理者）
        const actor = await this.requireStaffActor(client, orgId, input.actor_user_id);

        // 2) 鎖住 item，避免同一冊同時被 checkin/更新
        const item = await this.requireItemByIdForUpdate(client, orgId, itemId);

        const oldStatus = item.status;
        const newStatus: ItemStatus = 'lost';

        if (oldStatus === newStatus) {
          throw new ConflictException({
            error: { code: 'ITEM_ALREADY_IN_STATUS', message: 'Item is already lost' },
          });
        }

        // 3) 不合理狀態轉換防呆
        if (oldStatus === 'on_hold') {
          const readyHold = await this.findReadyHoldByAssignedItem(client, orgId, item.id);
          throw new ConflictException({
            error: {
              code: 'ITEM_ASSIGNED_TO_HOLD',
              message: 'Item is on hold; resolve the hold before marking lost',
              details: { hold_id: readyHold?.id ?? null },
            },
          });
        }

        if (oldStatus !== 'available' && oldStatus !== 'checked_out') {
          throw new ConflictException({
            error: {
              code: 'ITEM_STATUS_TRANSITION_NOT_ALLOWED',
              message: 'Cannot mark item as lost from current status',
              details: { from: oldStatus, to: newStatus },
            },
          });
        }

        // 4) 若來源是 checked_out，合理預期會存在 open loan（用於 audit metadata）
        const openLoan = await this.findOpenLoanForItem(client, orgId, item.id);

        if (oldStatus === 'checked_out' && !openLoan) {
          throw new ConflictException({
            error: {
              code: 'DATA_INCONSISTENT',
              message: 'Item is checked_out but no open loan exists',
            },
          });
        }

        if (oldStatus === 'available' && openLoan) {
          throw new ConflictException({
            error: {
              code: 'DATA_INCONSISTENT',
              message: 'Item is available but an open loan exists',
              details: { loan_id: openLoan.id },
            },
          });
        }

        // 5) 更新 item 狀態
        const updatedItem = await this.updateItemStatus(client, orgId, item.id, newStatus);

        // 6) 寫 audit（記錄 from/to + 基本識別）
        await client.query(
          `
          INSERT INTO audit_events (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            orgId,
            actor.id,
            'item.mark_lost',
            'item',
            item.id,
            JSON.stringify({
              item_id: item.id,
              item_barcode: item.barcode,
              bibliographic_id: item.bibliographic_id,
              from_status: oldStatus,
              to_status: newStatus,
              note: input.note ?? null,
              open_loan_id: openLoan?.id ?? null,
              open_loan_user_id: openLoan?.user_id ?? null,
              open_loan_due_at: openLoan?.due_at ?? null,
            }),
          ],
        );

        return updatedItem;
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;

      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  /**
   * markRepair：標記冊為 repair（修復中）
   *
   * 允許的來源狀態（MVP）：
   * - available：冊在館內，發現需要修復，暫時下架
   *
   * 不允許：
   * - checked_out：冊不在館內，應先處理借閱/歸還
   * - on_hold：冊已被指派給預約取書
   * - lost/withdrawn：語意不合理
   */
  async markRepair(orgId: string, itemId: string, input: MarkItemRepairInput): Promise<ItemRow> {
    try {
      return await this.db.transaction(async (client) => {
        const actor = await this.requireStaffActor(client, orgId, input.actor_user_id);
        const item = await this.requireItemByIdForUpdate(client, orgId, itemId);

        const oldStatus = item.status;
        const newStatus: ItemStatus = 'repair';

        if (oldStatus === newStatus) {
          throw new ConflictException({
            error: { code: 'ITEM_ALREADY_IN_STATUS', message: 'Item is already in repair' },
          });
        }

        if (oldStatus !== 'available') {
          throw new ConflictException({
            error: {
              code: 'ITEM_STATUS_TRANSITION_NOT_ALLOWED',
              message: 'Cannot mark item as repair from current status',
              details: { from: oldStatus, to: newStatus },
            },
          });
        }

        // available 的冊理論上不應有 open loan / assigned ready hold；這裡做保險檢查，避免資料不一致擴大
        const openLoan = await this.findOpenLoanForItem(client, orgId, item.id);
        if (openLoan) {
          throw new ConflictException({
            error: {
              code: 'DATA_INCONSISTENT',
              message: 'Item is available but an open loan exists',
              details: { loan_id: openLoan.id },
            },
          });
        }

        const readyHold = await this.findReadyHoldByAssignedItem(client, orgId, item.id);
        if (readyHold) {
          throw new ConflictException({
            error: {
              code: 'ITEM_ASSIGNED_TO_HOLD',
              message: 'Item is assigned to a ready hold; cannot mark repair',
              details: { hold_id: readyHold.id },
            },
          });
        }

        const updatedItem = await this.updateItemStatus(client, orgId, item.id, newStatus);

        await client.query(
          `
          INSERT INTO audit_events (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            orgId,
            actor.id,
            'item.mark_repair',
            'item',
            item.id,
            JSON.stringify({
              item_id: item.id,
              item_barcode: item.barcode,
              bibliographic_id: item.bibliographic_id,
              from_status: oldStatus,
              to_status: newStatus,
              note: input.note ?? null,
            }),
          ],
        );

        return updatedItem;
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;

      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  /**
   * markWithdrawn：標記冊為 withdrawn（報廢/下架，不再流通）
   *
   * 允許的來源狀態（MVP）：
   * - available：直接下架（例如淘汰、毀損）
   * - repair：修復後判定不值得再修，直接報廢
   * - lost：長期未找回，決定報廢（但前提是沒有 open loan）
   *
   * 不允許：
   * - checked_out：仍在借出中（有 open loan），不應直接報廢
   * - on_hold：已被指派給預約取書
   * - withdrawn：重複標記沒有意義
   */
  async markWithdrawn(orgId: string, itemId: string, input: MarkItemWithdrawnInput): Promise<ItemRow> {
    try {
      return await this.db.transaction(async (client) => {
        const actor = await this.requireStaffActor(client, orgId, input.actor_user_id);
        const item = await this.requireItemByIdForUpdate(client, orgId, itemId);

        const oldStatus = item.status;
        const newStatus: ItemStatus = 'withdrawn';

        if (oldStatus === newStatus) {
          throw new ConflictException({
            error: { code: 'ITEM_ALREADY_IN_STATUS', message: 'Item is already withdrawn' },
          });
        }

        if (oldStatus === 'checked_out') {
          throw new ConflictException({
            error: { code: 'ITEM_HAS_OPEN_LOAN', message: 'Item is checked out; cannot withdraw' },
          });
        }

        if (oldStatus === 'on_hold') {
          const readyHold = await this.findReadyHoldByAssignedItem(client, orgId, item.id);
          throw new ConflictException({
            error: {
              code: 'ITEM_ASSIGNED_TO_HOLD',
              message: 'Item is on hold; resolve the hold before withdrawing',
              details: { hold_id: readyHold?.id ?? null },
            },
          });
        }

        if (oldStatus !== 'available' && oldStatus !== 'repair' && oldStatus !== 'lost') {
          throw new ConflictException({
            error: {
              code: 'ITEM_STATUS_TRANSITION_NOT_ALLOWED',
              message: 'Cannot withdraw item from current status',
              details: { from: oldStatus, to: newStatus },
            },
          });
        }

        // withdrawn 前確保沒有 open loan（避免 loan/checkin 流程產生不一致）
        const openLoan = await this.findOpenLoanForItem(client, orgId, item.id);
        if (openLoan) {
          throw new ConflictException({
            error: {
              code: 'ITEM_HAS_OPEN_LOAN',
              message: 'Item has an open loan; cannot withdraw',
              details: { loan_id: openLoan.id, user_id: openLoan.user_id },
            },
          });
        }

        const readyHold = await this.findReadyHoldByAssignedItem(client, orgId, item.id);
        if (readyHold) {
          throw new ConflictException({
            error: {
              code: 'ITEM_ASSIGNED_TO_HOLD',
              message: 'Item is assigned to a ready hold; cannot withdraw',
              details: { hold_id: readyHold.id },
            },
          });
        }

        const updatedItem = await this.updateItemStatus(client, orgId, item.id, newStatus);

        await client.query(
          `
          INSERT INTO audit_events (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            orgId,
            actor.id,
            'item.mark_withdrawn',
            'item',
            item.id,
            JSON.stringify({
              item_id: item.id,
              item_barcode: item.barcode,
              bibliographic_id: item.bibliographic_id,
              from_status: oldStatus,
              to_status: newStatus,
              note: input.note ?? null,
            }),
          ],
        );

        return updatedItem;
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof ForbiddenException) throw error;

      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  // ----------------------------
  // helpers
  // ----------------------------

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
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to update item status' },
      });
    }

    return actor;
  }

  /**
   * requireItemByIdForUpdate：鎖定 item row（FOR UPDATE）
   *
   * 為什麼需要鎖？
   * - item.status 會被 checkout/checkin/hold 指派流程更新
   * - 若不鎖，可能出現「前一秒看到 available，下一秒就被借走」的競態
   */
  private async requireItemByIdForUpdate(client: PoolClient, orgId: string, itemId: string) {
    const result = await client.query<Pick<ItemRow, 'id' | 'bibliographic_id' | 'barcode' | 'status'>>(
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

  private async findOpenLoanForItem(client: PoolClient, orgId: string, itemId: string): Promise<OpenLoanRow | null> {
    const result = await client.query<OpenLoanRow>(
      `
      SELECT id, user_id, due_at
      FROM loans
      WHERE organization_id = $1
        AND item_id = $2
        AND returned_at IS NULL
      LIMIT 1
      `,
      [orgId, itemId],
    );
    return result.rows[0] ?? null;
  }

  private async findReadyHoldByAssignedItem(
    client: PoolClient,
    orgId: string,
    itemId: string,
  ): Promise<ReadyHoldRow | null> {
    const result = await client.query<ReadyHoldRow>(
      `
      SELECT id, user_id, bibliographic_id, ready_until
      FROM holds
      WHERE organization_id = $1
        AND assigned_item_id = $2
        AND status = 'ready'
      LIMIT 1
      `,
      [orgId, itemId],
    );
    return result.rows[0] ?? null;
  }

  /**
   * updateItemStatus：更新 item.status 並回傳完整 row
   *
   * - 把「更新 SQL + RETURNING」集中在一起，避免三個 action endpoints 重複寫一大段
   */
  private async updateItemStatus(
    client: PoolClient,
    orgId: string,
    itemId: string,
    status: ItemStatus,
  ) {
    const result = await client.query<ItemRow>(
      `
      UPDATE item_copies
      SET status = $1::item_status,
          updated_at = now()
      WHERE organization_id = $2
        AND id = $3
      RETURNING
        id,
        organization_id,
        bibliographic_id,
        barcode,
        call_number,
        location_id,
        status,
        acquired_at,
        last_inventory_at,
        notes,
        created_at,
        updated_at
      `,
      [status, orgId, itemId],
    );

    // item 已被鎖定且存在，因此 rowCount 理論上不會是 0；這裡保險處理
    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Item not found' },
      });
    }

    return result.rows[0]!;
  }

  private async assertBibliographicExists(orgId: string, bibId: string) {
    const result = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM bibliographic_records
      WHERE id = $1
        AND organization_id = $2
      `,
      [bibId, orgId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Bibliographic record not found' },
      });
    }
  }

  /**
   * assertLocationActive：驗證 location 存在且為 active
   *
   * 為什麼要檢查 active？
   * - locations.status=inactive 代表「已停用/不可再使用」
   * - 需求：停用 location 不可再被用於「新增冊/更新冊位置」（避免資料越用越亂）
   *
   * 注意：
   * - 我們只在「會寫入/變更 location_id」的操作做這個檢查
   * - 查詢（list/getById）仍允許回傳既有資料（即使它指向 inactive location）
   */
  private async assertLocationActive(orgId: string, locationId: string) {
    const result = await this.db.query<{ id: string; status: 'active' | 'inactive' }>(
      `
      SELECT id, status
      FROM locations
      WHERE id = $1
        AND organization_id = $2
      `,
      [locationId, orgId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Location not found' },
      });
    }

    const location = result.rows[0]!;
    if (location.status !== 'active') {
      throw new ConflictException({
        error: { code: 'LOCATION_INACTIVE', message: 'Location is inactive' },
      });
    }
  }
}
