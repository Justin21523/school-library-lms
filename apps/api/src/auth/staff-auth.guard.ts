/**
 * StaffAuthGuard（NestJS Guard）
 *
 * 目的：
 * - 把「誰真的就是誰」的驗證（authentication）加到 staff 端點上
 * - 並把 actor_user_id 從「前端隨便填/隨便選」收斂成「必須等於登入 token 的使用者」
 *
 * 使用方式（在 controller 上）：
 * - @UseGuards(StaffAuthGuard)
 *
 * 行為：
 * 1) 解析 Authorization: Bearer <token>
 * 2) 驗證 token（簽章、過期）
 * 3) 驗證 token.org 與路徑 orgId 一致（多租戶隔離）
 * 4) 驗證 token.sub 對應的 user 存在且 active
 * 5) 驗證 user.role 必須是 staff（admin/librarian）
 * 6) 若 request body/query 有 actor_user_id，必須等於 token.sub
 *
 * 注意：
 * - 這個 guard 是「MVP 的最小可用 staff auth」：
 *   - 仍未做到完整的 session revocation、refresh token、rate limit
 *   - 但能讓 Web Console 不再需要人工選 actor_user_id，避免冒用
 */

import { CanActivate, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AuthService } from './auth.service';

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

type ActorRow = { id: string; role: UserRole; status: UserStatus };

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DbService,
  ) {}

  async canActivate(context: any): Promise<boolean> {
    // NestJS + Fastify：context.switchToHttp().getRequest() 會拿到 Fastify request
    const req = context.switchToHttp().getRequest() as any;

    const orgId = req?.params?.orgId;
    if (!orgId || typeof orgId !== 'string') {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Missing orgId' },
      });
    }

    const headerValue = req.headers?.authorization ?? req.headers?.Authorization;
    if (!headerValue || typeof headerValue !== 'string') {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' },
      });
    }

    const token = parseBearerToken(headerValue);
    if (!token) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Invalid Authorization header' },
      });
    }

    const payload = this.auth.verifyToken(token);

    // 多租戶隔離：token.org 必須等於路徑 orgId
    if (payload.org !== orgId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Token is not valid for this organization' },
      });
    }

    // actor_user_id 一致性：若 request 有 actor_user_id，就必須等於 token.sub
    // - 我們做「寬鬆查找」：body/query 都可能出現 actor_user_id
    // - 讓舊有的 endpoint（actor_user_id 在 query 或 body）都能被同一個 guard 保護
    const actorUserIdFromRequest = extractActorUserIdFromRequest(req);
    if (actorUserIdFromRequest && actorUserIdFromRequest !== payload.sub) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'actor_user_id does not match authenticated user' },
      });
    }

    // 查 DB：確認 user 仍存在且 active（避免 token 簽發後被停用仍可用）
    const actor = await this.requireStaffActor(orgId, payload.sub);

    // 再次確認角色一致（token.role 是方便用，但真正權威仍以 DB 為準）
    if (!STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'User is not allowed to access staff endpoints' },
      });
    }

    // 將已驗證的使用者資訊掛在 request 上，方便未來擴充（目前不強依賴它）
    req.staff_user = { id: actor.id, role: actor.role, org_id: orgId };

    return true;
  }

  private async requireStaffActor(orgId: string, userId: string) {
    const result = await this.db.query<ActorRow>(
      `
      SELECT id, role, status
      FROM users
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, userId],
    );

    if (result.rowCount === 0) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    const actor = result.rows[0]!;
    if (actor.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'User is inactive' },
      });
    }

    if (!STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'User is not staff' },
      });
    }

    return actor;
  }
}

function parseBearerToken(value: string) {
  const trimmed = value.trim();
  const prefix = 'Bearer ';
  if (!trimmed.startsWith(prefix)) return null;
  const token = trimmed.slice(prefix.length).trim();
  return token || null;
}

function extractActorUserIdFromRequest(req: any): string | null {
  const fromBody = req?.body?.actor_user_id;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();

  const fromQuery = req?.query?.actor_user_id;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();

  return null;
}

