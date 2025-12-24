/**
 * AuditService
 *
 * 本服務提供「稽核事件（audit_events）」查詢。
 *
 * 設計原則：
 * 1) 多租戶隔離：永遠以 orgId 作為查詢邊界
 * 2) 推導優先：audit_events 是 append-only，查詢不修改資料
 * 3) 可用性優先：回傳 join 後的可顯示資訊（actor external_id/name/role），讓前端不需要 N+1 查詢
 * 4) 最小權限控管：MVP 無 auth，先要求 actor_user_id 並驗證 admin/librarian
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
import type { ListAuditEventsQuery } from './audit.schemas';

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

// viewer 允許的角色：MVP 先允許 staff（admin/librarian）
// - 若未來要更嚴格（只允許 admin），可在這裡收緊
const AUDIT_VIEWER_ROLES: UserRole[] = ['admin', 'librarian'];

type ViewerRow = { id: string; role: UserRole; status: UserStatus };

/**
 * AuditEventRow：回傳給前端顯示的 shape（snake_case）
 *
 * 注意：
 * - metadata 是 jsonb：在 pg driver 會被 parse 成 object（unknown）
 * - entity_id 在 DB 是 text：可能是 uuid，也可能是其他識別字串
 */
export type AuditEventRow = {
  id: string;
  organization_id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: unknown | null;
  created_at: string;

  // actor（事件操作者）的可顯示資訊（join users）
  actor_external_id: string;
  actor_name: string;
  actor_role: UserRole;
  actor_status: UserStatus;
};

@Injectable()
export class AuditService {
  constructor(private readonly db: DbService) {}

  async list(orgId: string, query: ListAuditEventsQuery): Promise<AuditEventRow[]> {
    // 1) 權限控管（MVP）：查詢者必須是 staff
    await this.db.transaction(async (client) => {
      await this.requireAuditViewer(client, orgId, query.actor_user_id);
    });

    // 2) 組 where clauses（只拼有提供的 filter）
    const whereClauses: string[] = ['ae.organization_id = $1'];
    const params: unknown[] = [orgId];

    if (query.from) {
      params.push(query.from);
      whereClauses.push(`ae.created_at >= $${params.length}::timestamptz`);
    }

    if (query.to) {
      params.push(query.to);
      whereClauses.push(`ae.created_at <= $${params.length}::timestamptz`);
    }

    if (query.action) {
      params.push(query.action);
      whereClauses.push(`ae.action = $${params.length}`);
    }

    if (query.entity_type) {
      params.push(query.entity_type);
      whereClauses.push(`ae.entity_type = $${params.length}`);
    }

    if (query.entity_id) {
      params.push(query.entity_id);
      whereClauses.push(`ae.entity_id = $${params.length}`);
    }

    if (query.actor_query) {
      // actor_query 用 ILIKE 做模糊查詢（external_id 或 name 含字串）
      params.push(`%${query.actor_query}%`);
      const p = `$${params.length}`;
      whereClauses.push(`(u.external_id ILIKE ${p} OR u.name ILIKE ${p})`);
    }

    const limit = query.limit ?? 200;
    params.push(limit);
    const limitParam = `$${params.length}`;

    try {
      const result = await this.db.query<AuditEventRow>(
        `
        SELECT
          ae.id,
          ae.organization_id,
          ae.actor_user_id,
          ae.action,
          ae.entity_type,
          ae.entity_id,
          ae.metadata,
          ae.created_at,
          u.external_id AS actor_external_id,
          u.name AS actor_name,
          u.role AS actor_role,
          u.status AS actor_status
        FROM audit_events ae
        JOIN users u
          ON u.id = ae.actor_user_id
         AND u.organization_id = ae.organization_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ae.created_at DESC
        LIMIT ${limitParam}
        `,
        params,
      );

      return result.rows;
    } catch (error: any) {
      // 22P02/22007：timestamptz 解析失敗（from/to 格式錯）
      if (error?.code === '22P02' || error?.code === '22007') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query format' },
        });
      }
      throw error;
    }
  }

  // ----------------------------
  // helpers
  // ----------------------------

  private async requireAuditViewer(client: PoolClient, orgId: string, actorUserId: string) {
    const result = await client.query<ViewerRow>(
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

    if (!AUDIT_VIEWER_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to view audit events' },
      });
    }

    return actor;
  }
}

