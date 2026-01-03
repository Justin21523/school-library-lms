/**
 * PatronAuthGuard（NestJS Guard）
 *
 * 目的：
 * - 提供 OPAC Account（讀者端）登入後的保護層
 * - 讓「我的借閱 / 我的預約」等端點真正只回自己的資料
 *
 * 行為（與 StaffAuthGuard 同概念）：
 * 1) 解析 Authorization: Bearer <token>
 * 2) 驗證 token（簽章、過期）
 * 3) 驗證 token.org 與路徑 orgId 一致（多租戶隔離）
 * 4) 查 DB：確認 user 仍存在且 active
 * 5) 驗證 user.role 必須是 patron（student/teacher）
 * 6) 若 request body/query 有 actor_user_id，必須等於 token.sub（避免冒用）
 *
 * 注意：
 * - 這個 guard 不等於「完整的讀者權限模型」；它只是 MVP 最小可用的 authentication
 * - 後續若要整合 SSO/LDAP、或支援家長帳號/班級帳號，可再擴充 allowed roles
 */

import { CanActivate, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AuthService } from './auth.service';

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

// patron roles：允許使用 OPAC Account 的角色（MVP：student/teacher）
const PATRON_ROLES: UserRole[] = ['student', 'teacher'];

type ActorRow = { id: string; role: UserRole; status: UserStatus };

@Injectable()
export class PatronAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DbService,
  ) {}

  async canActivate(context: any): Promise<boolean> {
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
    // - 讓「需要 actor_user_id 的動作端點」在 patron 情境也能安全使用
    const actorUserIdFromRequest = extractActorUserIdFromRequest(req);
    if (actorUserIdFromRequest && actorUserIdFromRequest !== payload.sub) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'actor_user_id does not match authenticated user' },
      });
    }

    // 查 DB：確認 user 仍存在且 active（避免 token 簽發後被停用仍可用）
    const user = await this.requirePatron(orgId, payload.sub);

    // 將已驗證的使用者資訊掛在 request 上（給 me controller 使用）
    req.patron_user = { id: user.id, role: user.role, org_id: orgId };

    return true;
  }

  private async requirePatron(orgId: string, userId: string) {
    const result = await this.db.query<ActorRow>(
      `
      SELECT id, role, status
      FROM users
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, userId],
      { orgId },
    );

    if (result.rowCount === 0) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    const user = result.rows[0]!;
    if (user.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'User is inactive' },
      });
    }

    if (!PATRON_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'User is not allowed to access patron endpoints' },
      });
    }

    return user;
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
