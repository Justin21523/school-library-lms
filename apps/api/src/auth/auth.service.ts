/**
 * AuthService（Staff Auth / 密碼 / Token）
 *
 * 這個 service 提供三件事：
 * 1) Password hashing & verification（密碼雜湊）
 * 2) Staff login（登入：external_id + password → access token）
 * 3) Set password（管理者替 staff 設定/重設密碼；以及 bootstrap 初始化密碼）
 *
 * 為什麼不用套件（passport/jwt）？
 * - 本專案目前希望「依賴最少」且不依賴網路安裝套件（sandbox/network 限制）
 * - Node.js 內建 crypto 就足夠實作 MVP 版的 token（HMAC）與 password hashing（scrypt）
 * - 後續若要整合 SSO/LDAP/JWT 標準，可再替換成成熟方案
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import type { BootstrapSetStaffPasswordInput, SetStaffPasswordInput, StaffLoginInput } from './auth.schemas';

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';

const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

type UserRow = {
  id: string;
  organization_id: string;
  external_id: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

type CredentialRow = {
  user_id: string;
  password_salt: string;
  password_hash: string;
  algorithm: string;
};

type TokenPayloadV1 = {
  v: 1;
  sub: string; // user_id（UUID）
  org: string; // org_id（UUID）
  role: UserRole;
  iat: number; // issued at（epoch seconds）
  exp: number; // expires at（epoch seconds）
};

export type StaffLoginResult = {
  access_token: string;
  expires_at: string;
  user: Pick<UserRow, 'id' | 'organization_id' | 'external_id' | 'name' | 'role' | 'status'>;
};

@Injectable()
export class AuthService {
  constructor(private readonly db: DbService) {}

  /**
   * staffLogin：external_id + password → access token
   *
   * 重要：
   * - 目前只做「Staff（admin/librarian）」登入，因為 Web Console 是 staff 端
   * - 讀者（student/teacher）登入/SSO 屬於後續擴充
   */
  async staffLogin(orgId: string, input: StaffLoginInput): Promise<StaffLoginResult> {
    return await this.db.transaction(async (client) => {
      const user = await this.requireUserByExternalId(client, orgId, input.external_id);

      // 只有 staff 能登入 Web Console
      if (!STAFF_ROLES.includes(user.role)) {
        throw new ForbiddenException({
          error: { code: 'FORBIDDEN', message: 'User is not allowed to login as staff' },
        });
      }

      if (user.status !== 'active') {
        throw new ConflictException({
          error: { code: 'USER_INACTIVE', message: 'User is inactive' },
        });
      }

      const credential = await this.getCredential(client, user.id);
      if (!credential) {
        // 密碼尚未設定：用 409 表示「狀態衝突」（不是不存在）
        throw new ConflictException({
          error: { code: 'PASSWORD_NOT_SET', message: 'Password is not set for this user' },
        });
      }

      const ok = await this.verifyPassword(input.password, credential);
      if (!ok) {
        // 注意：不要回「哪一個欄位錯」以降低暴力破解資訊量
        throw new UnauthorizedException({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        });
      }

      // token 有效期：MVP 先用 12 小時（可再調整）
      const ttlSeconds = 12 * 60 * 60;
      const now = Math.floor(Date.now() / 1000);
      const payload: TokenPayloadV1 = {
        v: 1,
        sub: user.id,
        org: orgId,
        role: user.role,
        iat: now,
        exp: now + ttlSeconds,
      };

      const token = this.issueToken(payload);
      return {
        access_token: token,
        expires_at: new Date(payload.exp * 1000).toISOString(),
        user: {
          id: user.id,
          organization_id: user.organization_id,
          external_id: user.external_id,
          name: user.name,
          role: user.role,
          status: user.status,
        },
      };
    });
  }

  /**
   * setStaffPassword：由 staff（通常是 admin）替目標 staff 設定/重設密碼
   *
   * 設計：
   * - 這是一個「館員/管理者動作」：會寫入 audit_events（action=auth.set_password）
   * - guard 會要求 actor_user_id 必須等於 token user_id，避免 UI 任意選 actor
   */
  async setStaffPassword(orgId: string, input: SetStaffPasswordInput) {
    return await this.db.transaction(async (client) => {
      const actor = await this.requireUserById(client, orgId, input.actor_user_id);
      if (actor.status !== 'active') {
        throw new ConflictException({
          error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
        });
      }
      if (!STAFF_ROLES.includes(actor.role)) {
        throw new ForbiddenException({
          error: { code: 'FORBIDDEN', message: 'Actor is not allowed to set password' },
        });
      }

      const target = await this.requireUserById(client, orgId, input.target_user_id);
      if (!STAFF_ROLES.includes(target.role)) {
        throw new ForbiddenException({
          error: { code: 'FORBIDDEN', message: 'Target user is not staff' },
        });
      }

      const next = await this.hashPassword(input.new_password);

      // upsert：同一 user_id 永遠只有一筆 credential
      await client.query(
        `
        INSERT INTO user_credentials (user_id, password_salt, password_hash, algorithm)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          password_salt = EXCLUDED.password_salt,
          password_hash = EXCLUDED.password_hash,
          algorithm = EXCLUDED.algorithm,
          updated_at = now()
        `,
        [target.id, next.password_salt, next.password_hash, next.algorithm],
      );

      // 寫 audit：讓你在 /audit-events 追溯誰重設了誰的密碼（避免密碼外洩時無法追查）
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
          'auth.set_password',
          'user',
          target.id,
          JSON.stringify({
            target_external_id: target.external_id,
            target_role: target.role,
            note: input.note ?? null,
          }),
        ],
      );

      return { ok: true };
    });
  }

  /**
   * bootstrapSetStaffPassword：第一次設定密碼（需 AUTH_BOOTSTRAP_SECRET）
   *
   * 這個 endpoint 的存在理由：
   * - 第一次導入時，user_credentials 表是空的 → 沒有人能登入 → 也無法用 token 進行管理
   *
   * 安全策略（MVP）：
   * - 需要 environment variable `AUTH_BOOTSTRAP_SECRET`
   * - 若未設定，直接禁止使用（避免 production 誤開）
   */
  async bootstrapSetStaffPassword(orgId: string, input: BootstrapSetStaffPasswordInput) {
    const secret = process.env.AUTH_BOOTSTRAP_SECRET?.trim() || null;
    if (!secret) {
      throw new ForbiddenException({
        error: { code: 'BOOTSTRAP_DISABLED', message: 'AUTH_BOOTSTRAP_SECRET is not configured' },
      });
    }

    if (input.bootstrap_secret !== secret) {
      throw new ForbiddenException({
        error: { code: 'BOOTSTRAP_FORBIDDEN', message: 'Invalid bootstrap secret' },
      });
    }

    return await this.db.transaction(async (client) => {
      const target = await this.requireUserByExternalId(client, orgId, input.target_external_id);
      if (!STAFF_ROLES.includes(target.role)) {
        throw new ForbiddenException({
          error: { code: 'FORBIDDEN', message: 'Target user is not staff' },
        });
      }

      const next = await this.hashPassword(input.new_password);

      await client.query(
        `
        INSERT INTO user_credentials (user_id, password_salt, password_hash, algorithm)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          password_salt = EXCLUDED.password_salt,
          password_hash = EXCLUDED.password_hash,
          algorithm = EXCLUDED.algorithm,
          updated_at = now()
        `,
        [target.id, next.password_salt, next.password_hash, next.algorithm],
      );

      // audit_events 的 actor_user_id 不能為 NULL，因此這裡採用「目標使用者自己」作為 actor：
      // - 意義：可追溯「某位使用者在 bootstrap 流程設定了密碼」
      // - 後續正式上線時，建議改成更嚴謹的初始化流程（例如一次性邀請連結、或 DB migration 時直接寫入）
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
          target.id,
          'auth.bootstrap_set_password',
          'user',
          target.id,
          JSON.stringify({
            note: input.note ?? null,
          }),
        ],
      );

      return { ok: true };
    });
  }

  // ----------------------------
  // Token（HMAC）相關
  // ----------------------------

  /**
   * issueToken：把 payload（JSON）簽成一個簡單的 Bearer token
   *
   * token 格式（簡化版 JWT）：
   * - base64url(payloadJson) + "." + base64url(hmacSha256(payloadBase64url))
   *
   * 注意：
   * - 這不是標準 JWT（沒有 header），但足以用於 MVP 的「可驗證、可過期」token
   * - 後續若要接 SSO / JWT，可替換實作，不影響上層 controller/guard
   */
  issueToken(payload: TokenPayloadV1) {
    const json = JSON.stringify(payload);
    const payloadB64 = Buffer.from(json, 'utf8').toString('base64url');
    const sigB64 = this.hmac(payloadB64);
    return `${payloadB64}.${sigB64}`;
  }

  /**
   * verifyToken：驗證 token 並回傳 payload（若無效則丟出）
   */
  verifyToken(token: string): TokenPayloadV1 {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token format' },
      });
    }

    // TS 小陷阱：
    // - token.split('.') 的型別是 string[]（不是 tuple）
    // - 即使我們已檢查 parts.length === 2，解構後仍會得到 string | undefined
    // 因此這裡用非空斷言（!）把型別收斂成 string。
    const payloadB64 = parts[0]!;
    const sigB64 = parts[1]!;
    const expected = this.hmac(payloadB64);

    // timingSafeEqual：避免以「字串比較」造成的 timing side-channel
    if (!timingSafeEqualBase64Url(sigB64, expected)) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token signature' },
      });
    }

    let payload: unknown;
    try {
      const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
      payload = JSON.parse(json) as unknown;
    } catch {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token payload' },
      });
    }

    if (!isTokenPayloadV1(payload)) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Unsupported token payload' },
      });
    }

    // exp：過期就拒絕
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Token expired' },
      });
    }

    return payload;
  }

  private hmac(payloadB64: string) {
    // secret：MVP 開發環境允許 fallback，避免忘了設就整個系統不能跑
    // - 上 production 時務必設定 AUTH_TOKEN_SECRET
    const secret = process.env.AUTH_TOKEN_SECRET?.trim() || 'dev-insecure-secret';
    return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  }

  // ----------------------------
  // Password（scrypt）相關
  // ----------------------------

  private async hashPassword(password: string): Promise<Pick<CredentialRow, 'password_salt' | 'password_hash' | 'algorithm'>> {
    const salt = crypto.randomBytes(16).toString('base64');
    const hash = await scryptAsync(password, salt, 64);
    return { password_salt: salt, password_hash: hash.toString('base64'), algorithm: 'scrypt-v1' };
  }

  private async verifyPassword(password: string, credential: CredentialRow): Promise<boolean> {
    if (credential.algorithm !== 'scrypt-v1') {
      // 未來若要支援多版本演算法，可在這裡分支
      return false;
    }

    const hash = await scryptAsync(password, credential.password_salt, 64);
    const actual = hash.toString('base64');
    return timingSafeEqualString(actual, credential.password_hash);
  }

  // ----------------------------
  // DB helpers
  // ----------------------------

  private async requireUserByExternalId(client: PoolClient, orgId: string, externalId: string): Promise<UserRow> {
    const result = await client.query<UserRow>(
      `
      SELECT id, organization_id, external_id, name, role, status
      FROM users
      WHERE organization_id = $1
        AND external_id = $2
      `,
      [orgId, externalId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return result.rows[0]!;
  }

  private async requireUserById(client: PoolClient, orgId: string, userId: string): Promise<UserRow> {
    const result = await client.query<UserRow>(
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

  private async getCredential(client: PoolClient, userId: string): Promise<CredentialRow | null> {
    const result = await client.query<CredentialRow>(
      `
      SELECT user_id, password_salt, password_hash, algorithm
      FROM user_credentials
      WHERE user_id = $1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  }
}

/**
 * scryptAsync：把 callback 版 crypto.scrypt 包成 Promise
 *
 * - 我們用 async 版避免阻塞 event loop（MVP 也足夠）
 */
function scryptAsync(password: string, salt: string, keylen: number) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey as Buffer);
    });
  });
}

function timingSafeEqualString(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function timingSafeEqualBase64Url(a: string, b: string) {
  // base64url 的字元集合固定，因此用 Buffer compare 即可
  return timingSafeEqualString(a, b);
}

function isTokenPayloadV1(value: unknown): value is TokenPayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record['v'] === 1 &&
    typeof record['sub'] === 'string' &&
    typeof record['org'] === 'string' &&
    typeof record['role'] === 'string' &&
    typeof record['iat'] === 'number' &&
    typeof record['exp'] === 'number'
  );
}
