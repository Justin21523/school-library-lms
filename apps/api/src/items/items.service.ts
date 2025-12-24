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
import { DbService } from '../db/db.service';
import { itemStatusValues } from './items.schemas';
import type { CreateItemInput, UpdateItemInput } from './items.schemas';
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

type ActorRow = { id: string; role: UserRole; status: UserStatus };

type OpenLoanRow = { id: string; user_id: string; due_at: string };

type ReadyHoldRow = { id: string; user_id: string; bibliographic_id: string; ready_until: string | null };

@Injectable()
export class ItemsService {
  constructor(private readonly db: DbService) {}

  async list(
    orgId: string,
    filters: {
      barcode?: string;
      status?: string;
      location_id?: string;
      bibliographic_id?: string;
    },
  ): Promise<ItemRow[]> {
    const barcodeSearch = filters.barcode?.trim() ? `%${filters.barcode.trim()}%` : null;
    const status = filters.status?.trim() ? filters.status.trim() : null;
    const locationId = filters.location_id?.trim() ? filters.location_id.trim() : null;
    const bibliographicId = filters.bibliographic_id?.trim()
      ? filters.bibliographic_id.trim()
      : null;

    // status 若給了不合法的 enum 值，直接回 400（避免 DB error）。
    if (status && !itemStatusValues.includes(status as ItemStatus)) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid item status filter' },
      });
    }

    try {
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
        WHERE organization_id = $1
          AND ($2::text IS NULL OR barcode ILIKE $2)
          AND ($3::text IS NULL OR status = $3::item_status)
          AND ($4::uuid IS NULL OR location_id = $4)
          AND ($5::uuid IS NULL OR bibliographic_id = $5)
        ORDER BY created_at DESC
        LIMIT 200
        `,
        [orgId, barcodeSearch, status, locationId, bibliographicId],
      );
      return result.rows;
    } catch (error: any) {
      // 22P02 = invalid_text_representation：UUID/enum 轉型失敗。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid filter format' },
        });
      }
      throw error;
    }
  }

  async create(orgId: string, bibId: string, input: CreateItemInput): Promise<ItemRow> {
    // 防止跨 org 亂接：先確認 bibliographic/location 都屬於同一 org。
    await this.assertBibliographicExists(orgId, bibId);
    await this.assertLocationExists(orgId, input.location_id);

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

  async getById(orgId: string, itemId: string): Promise<ItemRow> {
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
      WHERE organization_id = $1
        AND id = $2
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
      // 更新 location 前先確認它屬於同 org（避免跨租戶亂接）。
      await this.assertLocationExists(orgId, input.location_id);
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

  private async assertLocationExists(orgId: string, locationId: string) {
    const result = await this.db.query<{ id: string }>(
      `
      SELECT id
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
  }
}
