/**
 * AuthRateLimitGuard（登入限流）
 *
 * 規則（預設）：
 * - 同 org + 同 IP：每 15 分鐘最多 60 次（防止同一來源狂打）
 * - 同 org + 同 IP + 同 external_id：每 15 分鐘最多 10 次（防止針對單一帳號暴力嘗試）
 *
 * 回應：
 * - 429 Too Many Requests
 * - body：{ error: { code: 'RATE_LIMITED', message, details } }
 * - header：Retry-After（秒）
 *
 * 注意：
 * - 這個 guard 不會區分「密碼錯」或「帳號不存在」，避免給攻擊者額外訊息
 * - 這是 MVP 版 in-memory 限流；若未來要水平擴展，請改成 Redis
 */

import { CanActivate, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AuthRateLimitService } from './auth-rate-limit.service';

function parseIntEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseBoolEnv(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
}

function extractClientIp(req: any) {
  // 1) 反向代理常用：X-Forwarded-For（取第一個）
  const xff = req?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  // 2) Fastify：req.ip
  const ip = req?.ip;
  if (typeof ip === 'string' && ip.trim()) return ip.trim();

  // 3) Node socket
  const remote = req?.socket?.remoteAddress;
  if (typeof remote === 'string' && remote.trim()) return remote.trim();

  return 'unknown';
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: AuthRateLimitService) {}

  async canActivate(context: any): Promise<boolean> {
    // NestJS + Fastify：context.switchToHttp().getRequest() 會拿到 Fastify request
    const req = context.switchToHttp().getRequest() as any;
    // Nest 的 getResponse() 在泛型上不一定有完整型別（取決於 adapter），因此用 cast 更穩。
    const reply = context.switchToHttp().getResponse() as FastifyReply;

    // 可透過 env 暫時關閉（例如本機壓測/教學）
    // - 正式環境不建議關閉
    const disabled = parseBoolEnv('AUTH_LOGIN_RATE_LIMIT_DISABLED', false);
    if (disabled) return true;

    const orgId = typeof req?.params?.orgId === 'string' ? req.params.orgId : 'unknown-org';
    const ip = extractClientIp(req);
    const externalId =
      typeof req?.body?.external_id === 'string' && req.body.external_id.trim()
        ? req.body.external_id.trim()
        : '';

    const windowMs = parseIntEnv('AUTH_LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
    const maxPerIp = parseIntEnv('AUTH_LOGIN_RATE_LIMIT_MAX_PER_IP', 60);
    const maxPerIpUser = parseIntEnv('AUTH_LOGIN_RATE_LIMIT_MAX_PER_IP_USER', 10);

    const ipKey = `auth_login:org=${orgId}:ip=${ip}`;
    const userKey = externalId ? `auth_login:org=${orgId}:ip=${ip}:external_id=${externalId}` : null;

    // 先檢查「同 IP」總量（避免靠換 external_id 逃避）
    const ipResult = this.limiter.consume(ipKey, maxPerIp, windowMs);
    if (!ipResult.allowed) {
      reply.header('Retry-After', String(ipResult.retry_after_seconds));
      throw new HttpException(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many login attempts, please try again later',
            details: { reset_at: new Date(ipResult.reset_at_ms).toISOString() },
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 再檢查「同 IP + 同帳號」（降低針對單一帳號的暴力嘗試）
    if (userKey) {
      const userResult = this.limiter.consume(userKey, maxPerIpUser, windowMs);
      if (!userResult.allowed) {
        reply.header('Retry-After', String(userResult.retry_after_seconds));
        throw new HttpException(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many login attempts, please try again later',
              details: { reset_at: new Date(userResult.reset_at_ms).toISOString() },
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }
}
