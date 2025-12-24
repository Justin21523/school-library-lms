/**
 * InventoryService（盤點 domain）
 *
 * 盤點的 MVP 工作流（對齊 MVP-SPEC.md）：
 * 1) 開始盤點：選 location → 建立 inventory_session
 * 2) 掃描冊條碼：每掃一次就記錄到 inventory_scans，並更新 item_copies.last_inventory_at
 * 3) 結束盤點：關閉 session（寫 audit），並用 session_id 產出差異清單（missing/unexpected）
 *
 * 設計原則：
 * - 盤點是「高頻操作」：掃描可能 1000 次/天，因此不要每次掃描都寫 audit_events（會爆表）
 * - 但盤點同時又是「需要可追溯」的作業：因此我們在 session start/close 寫 audit
 * - 差異清單與 CSV 匯出，則走 /reports/inventory-diff（同一套報表/匯出基礎架構）
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
import type {
  CloseInventorySessionInput,
  CreateInventorySessionInput,
  ListInventorySessionsQuery,
  ScanInventoryItemInput,
} from './inventory.schemas';

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

type ItemStatus = 'available' | 'checked_out' | 'on_hold' | 'lost' | 'withdrawn' | 'repair';

// 盤點屬於 staff 作業：只允許 admin/librarian。
const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

type ActorRow = {
  id: string;
  external_id: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

type LocationRow = {
  id: string;
  code: string;
  name: string;
  status: UserStatus;
};

type InventorySessionRow = {
  id: string;
  organization_id: string;
  location_id: string;
  actor_user_id: string;
  note: string | null;
  started_at: string;
  closed_at: string | null;
};

export type InventorySessionWithDetails = InventorySessionRow & {
  location_code: string;
  location_name: string;
  actor_external_id: string;
  actor_name: string;

  // stats：方便前端顯示進度
  scanned_count: number;
  unexpected_count: number;
};

type ItemByBarcodeRow = {
  id: string;
  barcode: string;
  call_number: string;
  status: ItemStatus;
  location_id: string;
  location_code: string;
  location_name: string;
  bibliographic_id: string;
  bibliographic_title: string;
  last_inventory_at: string | null;
};

export type InventoryScanResult = {
  scan_id: string;
  session_id: string;
  scanned_at: string;

  flags: {
    // location_mismatch：掃到的冊，其系統 location 與盤點 location 不一致
    location_mismatch: boolean;
    // status_unexpected：掃到的冊，其系統狀態不是 available（理論上不該在架）
    status_unexpected: boolean;
  };

  item: ItemByBarcodeRow;

  // session_location：讓前端可以顯示「本次盤點預期 location」
  session_location: {
    id: string;
    code: string;
    name: string;
  };
};

export type CloseInventorySessionResult = {
  ok: true;
  session: InventorySessionRow & { closed_at: string };
  summary: {
    expected_available_count: number;
    scanned_count: number;
    missing_count: number;
    unexpected_count: number;
  };
  audit_event_id: string;
};

@Injectable()
export class InventoryService {
  constructor(private readonly db: DbService) {}

  /**
   * 建立盤點 session
   *
   * POST /api/v1/orgs/:orgId/inventory/sessions
   */
  async createSession(orgId: string, input: CreateInventorySessionInput): Promise<InventorySessionWithDetails> {
    return await this.db.transaction(async (client) => {
      // 1) 驗證 actor：必須是 active 的 admin/librarian
      const actor = await this.requireStaffActor(client, orgId, input.actor_user_id);

      // 2) 驗證 location：必須存在且 active
      const location = await this.requireActiveLocation(client, orgId, input.location_id);

      // 3) 建立 session
      const result = await client.query<InventorySessionRow>(
        `
        INSERT INTO inventory_sessions (organization_id, location_id, actor_user_id, note)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          organization_id,
          location_id,
          actor_user_id,
          note,
          started_at::text,
          closed_at::text
        `,
        [orgId, location.id, actor.id, input.note ?? null],
      );

      const session = result.rows[0]!;

      // 4) 寫 audit（只在「開始/結束」寫，不在每次掃描寫）
      const audit = await client.query<{ id: string }>(
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
          'inventory.session_started',
          'inventory_session',
          session.id,
          JSON.stringify({
            location_id: location.id,
            location_code: location.code,
            location_name: location.name,
            note: input.note ?? null,
          }),
        ],
      );

      // 5) 回傳 session（含 location/actor/stats）：方便前端直接顯示
      return {
        ...session,
        location_code: location.code,
        location_name: location.name,
        actor_external_id: actor.external_id,
        actor_name: actor.name,
        scanned_count: 0,
        unexpected_count: 0,
        // 在前端你若需要 audit_event_id，可在此擴充；MVP 先不回傳避免 UI 過度依賴
        // audit_event_id: audit.rows[0]!.id,
      };
    });
  }

  /**
   * 列出盤點 sessions（最近 N 筆）
   *
   * GET /api/v1/orgs/:orgId/inventory/sessions
   *
   * 這個端點的用途：
   * - 讓前端可以「回看」舊的 session（例如：昨天盤點做到一半、今天要接著看差異清單）
   * - 也讓報表頁能提供「選擇 session」的 UI
   */
  async listSessions(orgId: string, query: ListInventorySessionsQuery): Promise<InventorySessionWithDetails[]> {
    const whereClauses: string[] = ['s.organization_id = $1'];
    const params: unknown[] = [orgId];

    if (query.location_id) {
      params.push(query.location_id);
      whereClauses.push(`s.location_id = $${params.length}::uuid`);
    }

    const statusFilter = query.status ?? 'all';
    if (statusFilter === 'open') whereClauses.push('s.closed_at IS NULL');
    if (statusFilter === 'closed') whereClauses.push('s.closed_at IS NOT NULL');

    const limit = query.limit ?? 50;
    params.push(limit);
    const limitParam = `$${params.length}`;

    const result = await this.db.query<InventorySessionWithDetails>(
      `
      WITH scan_stats AS (
        SELECT
          sc.session_id,
          COUNT(*)::int AS scanned_count,
          SUM(
            CASE
              -- unexpected：status != available 或 location != session.location
              WHEN i.status <> 'available'::item_status OR i.location_id <> s.location_id THEN 1
              ELSE 0
            END
          )::int AS unexpected_count
        FROM inventory_scans sc
        JOIN inventory_sessions s
          ON s.id = sc.session_id
         AND s.organization_id = sc.organization_id
        JOIN item_copies i
          ON i.id = sc.item_id
         AND i.organization_id = sc.organization_id
        WHERE sc.organization_id = $1
        GROUP BY 1
      )
      SELECT
        s.id,
        s.organization_id,
        s.location_id,
        s.actor_user_id,
        s.note,
        s.started_at::text,
        s.closed_at::text,

        l.code AS location_code,
        l.name AS location_name,

        u.external_id AS actor_external_id,
        u.name AS actor_name,

        COALESCE(st.scanned_count, 0)::int AS scanned_count,
        COALESCE(st.unexpected_count, 0)::int AS unexpected_count
      FROM inventory_sessions s
      JOIN locations l
        ON l.id = s.location_id
       AND l.organization_id = s.organization_id
      JOIN users u
        ON u.id = s.actor_user_id
       AND u.organization_id = s.organization_id
      LEFT JOIN scan_stats st
        ON st.session_id = s.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY s.started_at DESC
      LIMIT ${limitParam}
      `,
      params,
    );

    return result.rows;
  }

  /**
   * 掃描冊條碼（寫入 inventory_scans + 更新 item.last_inventory_at）
   *
   * POST /api/v1/orgs/:orgId/inventory/sessions/:sessionId/scan
   */
  async scanItem(
    orgId: string,
    sessionId: string,
    input: ScanInventoryItemInput,
  ): Promise<InventoryScanResult> {
    return await this.db.transaction(async (client) => {
      // 1) 驗證 actor
      await this.requireStaffActor(client, orgId, input.actor_user_id);

      // 2) 鎖 session：避免同時 close 與 scan 造成「關閉後仍能掃」的不一致
      const session = await this.requireSessionForUpdate(client, orgId, sessionId);
      if (session.closed_at) {
        throw new ConflictException({
          error: { code: 'INVENTORY_SESSION_CLOSED', message: 'Inventory session is already closed' },
        });
      }

      // 3) 依條碼找 item（同 org 內 barcode 唯一）
      const item = await this.requireItemByBarcode(client, orgId, input.item_barcode);

      // 4) 以 DB now() 作為 scanned_at（避免 API server 時鐘飄移）
      const scannedAt = await this.dbNowText(client);

      // 5) upsert scan（同 session 同 item 只保留一筆，避免重複掃造成資料暴增）
      const scanResult = await client.query<{ id: string; scanned_at: string }>(
        `
        INSERT INTO inventory_scans (
          organization_id,
          session_id,
          location_id,
          item_id,
          actor_user_id,
          scanned_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
        ON CONFLICT (session_id, item_id)
        DO UPDATE SET
          location_id = EXCLUDED.location_id,
          actor_user_id = EXCLUDED.actor_user_id,
          scanned_at = EXCLUDED.scanned_at
        RETURNING id, scanned_at::text
        `,
        [orgId, session.id, session.location_id, item.id, input.actor_user_id, scannedAt],
      );

      const scan = scanResult.rows[0]!;

      // 6) 更新 item.last_inventory_at：把「單冊最後盤點時間」落地到 item 本體
      await client.query(
        `
        UPDATE item_copies
        SET
          last_inventory_at = $3::timestamptz,
          updated_at = now()
        WHERE organization_id = $1
          AND id = $2
        `,
        [orgId, item.id, scannedAt],
      );

      // 7) 推導差異旗標（讓前端即時顯示「這本是不是怪怪的」）
      const locationMismatch = item.location_id !== session.location_id;
      const statusUnexpected = item.status !== 'available';

      return {
        scan_id: scan.id,
        session_id: session.id,
        scanned_at: scan.scanned_at,
        flags: { location_mismatch: locationMismatch, status_unexpected: statusUnexpected },
        item,
        session_location: {
          id: session.location_id,
          code: session.location_code,
          name: session.location_name,
        },
      };
    });
  }

  /**
   * 關閉盤點 session（寫 audit）
   *
   * POST /api/v1/orgs/:orgId/inventory/sessions/:sessionId/close
   */
  async closeSession(orgId: string, sessionId: string, input: CloseInventorySessionInput): Promise<CloseInventorySessionResult> {
    return await this.db.transaction(async (client) => {
      // 1) 驗證 actor
      const actor = await this.requireStaffActor(client, orgId, input.actor_user_id);

      // 2) 鎖 session
      const session = await this.requireSessionForUpdate(client, orgId, sessionId);
      if (session.closed_at) {
        throw new ConflictException({
          error: { code: 'INVENTORY_SESSION_CLOSED', message: 'Inventory session is already closed' },
        });
      }

      // 3) 關閉時間採 DB now()（與 scan 一致）
      const closedAt = await this.dbNowText(client);

      const update = await client.query<InventorySessionRow>(
        `
        UPDATE inventory_sessions
        SET closed_at = $3::timestamptz
        WHERE organization_id = $1
          AND id = $2
          AND closed_at IS NULL
        RETURNING
          id,
          organization_id,
          location_id,
          actor_user_id,
          note,
          started_at::text,
          closed_at::text
        `,
        [orgId, session.id, closedAt],
      );

      if (update.rowCount === 0) {
        // 理論上不會發生（因為我們已 FOR UPDATE 且 closed_at IS NULL），但保留防呆
        throw new ConflictException({
          error: { code: 'INVENTORY_SESSION_CLOSED', message: 'Inventory session is already closed' },
        });
      }

      const closedSession = update.rows[0]!;

      // 4) 產出摘要（MVP：供 audit 與 UI 顯示）
      const summary = await this.computeSessionSummary(client, orgId, closedSession.id);

      // 5) 寫 audit（關閉 session）
      const audit = await client.query<{ id: string }>(
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
          'inventory.session_closed',
          'inventory_session',
          closedSession.id,
          JSON.stringify({
            location_id: session.location_id,
            location_code: session.location_code,
            location_name: session.location_name,
            note: input.note ?? null,
            closed_at: closedAt,
            summary,
          }),
        ],
      );

      return {
        ok: true,
        session: { ...closedSession, closed_at: closedSession.closed_at ?? closedAt },
        summary,
        audit_event_id: audit.rows[0]!.id,
      };
    });
  }

  // ----------------------------
  // helpers（RBAC / require / summary）
  // ----------------------------

  /**
   * requireStaffActor：驗證操作者為 active admin/librarian
   *
   * 雖然 controller 已套用 StaffAuthGuard，但 service 仍保留 RBAC：
   * - 原因 1：把錯誤碼/訊息集中在 domain 層（避免 guard 改動時行為飄移）
   * - 原因 2：未來若某些 endpoint 改為「批次任務/排程」不走 guard，仍可沿用
   */
  private async requireStaffActor(client: PoolClient, orgId: string, actorUserId: string): Promise<ActorRow> {
    const result = await client.query<ActorRow>(
      `
      SELECT id, external_id, name, role, status
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
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to perform inventory actions' },
      });
    }

    return actor;
  }

  private async requireActiveLocation(client: PoolClient, orgId: string, locationId: string): Promise<LocationRow> {
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
        error: { code: 'LOCATION_INACTIVE', message: 'Location is inactive' },
      });
    }

    return location;
  }

  private async requireSessionForUpdate(
    client: PoolClient,
    orgId: string,
    sessionId: string,
  ): Promise<InventorySessionWithDetails> {
    const result = await client.query<InventorySessionWithDetails>(
      `
      SELECT
        s.id,
        s.organization_id,
        s.location_id,
        s.actor_user_id,
        s.note,
        s.started_at::text,
        s.closed_at::text,

        l.code AS location_code,
        l.name AS location_name,

        u.external_id AS actor_external_id,
        u.name AS actor_name,

        -- stats：FOR UPDATE 只鎖 session，不鎖 scans（避免掃描高頻造成長鎖）
        0::int AS scanned_count,
        0::int AS unexpected_count
      FROM inventory_sessions s
      JOIN locations l
        ON l.id = s.location_id
       AND l.organization_id = s.organization_id
      JOIN users u
        ON u.id = s.actor_user_id
       AND u.organization_id = s.organization_id
      WHERE s.organization_id = $1
        AND s.id = $2
      FOR UPDATE
      `,
      [orgId, sessionId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Inventory session not found' },
      });
    }

    return result.rows[0]!;
  }

  private async requireItemByBarcode(client: PoolClient, orgId: string, barcode: string): Promise<ItemByBarcodeRow> {
    const trimmed = barcode.trim();
    if (!trimmed) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'item_barcode is required' },
      });
    }

    const result = await client.query<ItemByBarcodeRow>(
      `
      SELECT
        i.id,
        i.barcode,
        i.call_number,
        i.status,
        i.location_id,
        loc.code AS location_code,
        loc.name AS location_name,
        b.id AS bibliographic_id,
        b.title AS bibliographic_title,
        i.last_inventory_at::text AS last_inventory_at
      FROM item_copies i
      JOIN locations loc
        ON loc.id = i.location_id
       AND loc.organization_id = i.organization_id
      JOIN bibliographic_records b
        ON b.id = i.bibliographic_id
       AND b.organization_id = i.organization_id
      WHERE i.organization_id = $1
        AND i.barcode = $2
      `,
      [orgId, trimmed],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Item not found' },
      });
    }

    return result.rows[0]!;
  }

  /**
   * computeSessionSummary：計算差異摘要（給 closeSession audit / UI）
   *
   * 注意：
   * - 這裡的定義與 /reports/inventory-diff 會一致
   * - expected_available_count：location 內 status=available 的冊（理論上應在架）
   * - missing_count：expected 中「未被本 session 掃到」的冊
   * - unexpected_count：本 session 掃到，但其 item.status != available 或 item.location_id != session.location_id
   */
  private async computeSessionSummary(client: PoolClient, orgId: string, sessionId: string) {
    const result = await client.query<{
      expected_available_count: number;
      scanned_count: number;
      missing_count: number;
      unexpected_count: number;
    }>(
      `
      WITH sess AS (
        SELECT id, organization_id, location_id
        FROM inventory_sessions
        WHERE organization_id = $1
          AND id = $2
      ),
      expected AS (
        SELECT COUNT(*)::int AS expected_available_count
        FROM item_copies i
        JOIN sess s
          ON s.organization_id = i.organization_id
         AND s.location_id = i.location_id
        WHERE i.organization_id = $1
          AND i.status = 'available'::item_status
      ),
      scanned AS (
        SELECT COUNT(*)::int AS scanned_count
        FROM inventory_scans sc
        WHERE sc.organization_id = $1
          AND sc.session_id = $2
      ),
      missing AS (
        SELECT COUNT(*)::int AS missing_count
        FROM item_copies i
        JOIN sess s
          ON s.organization_id = i.organization_id
         AND s.location_id = i.location_id
        WHERE i.organization_id = $1
          AND i.status = 'available'::item_status
          AND NOT EXISTS (
            SELECT 1
            FROM inventory_scans sc
            WHERE sc.organization_id = i.organization_id
              AND sc.session_id = s.id
              AND sc.item_id = i.id
          )
      ),
      unexpected AS (
        SELECT COUNT(*)::int AS unexpected_count
        FROM inventory_scans sc
        JOIN inventory_sessions s
          ON s.id = sc.session_id
         AND s.organization_id = sc.organization_id
        JOIN item_copies i
          ON i.id = sc.item_id
         AND i.organization_id = sc.organization_id
        WHERE sc.organization_id = $1
          AND sc.session_id = $2
          AND (
            i.status <> 'available'::item_status
            OR i.location_id <> s.location_id
          )
      )
      SELECT
        (SELECT expected_available_count FROM expected) AS expected_available_count,
        (SELECT scanned_count FROM scanned) AS scanned_count,
        (SELECT missing_count FROM missing) AS missing_count,
        (SELECT unexpected_count FROM unexpected) AS unexpected_count
      `,
      [orgId, sessionId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Inventory session not found' },
      });
    }

    return result.rows[0]!;
  }

  /**
   * dbNowText：用 DB now() 取得「同一個 transaction」內一致的時間字串
   */
  private async dbNowText(client: PoolClient) {
    const result = await client.query<{ now: string }>(`SELECT now()::timestamptz::text AS now`);
    return result.rows[0]!.now;
  }
}

