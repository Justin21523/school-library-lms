/**
 * AuthRateLimitService（in-memory rate limiter）
 *
 * 目的：
 * - 針對「登入」這種容易被暴力破解的端點，提供最小可用的 rate limit。
 *
 * 為什麼先用 in-memory？
 * - MVP 階段先追求「依賴最少」與「能跑」
 * - 不引入額外套件（也避免 network 安裝依賴）
 *
 * 取捨（你需要知道的風險）：
 * - 這是「單一 Node process」的 in-memory 限流：
 *   - 若你未來水平擴展成多台 API（多個 process/Pod），每台會各算各的
 *   - 要做到全域一致的限流，建議改用 Redis（例如 BullMQ/Rate limiter）
 *
 * - 仍然很有價值：
 *   - 對 MVP/單機部署，可以大幅降低暴力嘗試的成功率與 DB 壓力
 *   - 並且能把「錯誤」提早在 HTTP 層擋下來
 */

import { Injectable } from '@nestjs/common';

type Bucket = {
  window_start_ms: number;
  window_end_ms: number;
  count: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset_at_ms: number;
  retry_after_seconds: number;
};

@Injectable()
export class AuthRateLimitService {
  // buckets：key → 固定時間窗計數
  // - key 建議包含 org + ip（必要時再加 external_id）
  private readonly buckets = new Map<string, Bucket>();

  // 清理策略：避免 buckets 無限長大（特別是在被掃描時）
  private nextCleanupAtMs = Date.now() + 60_000;

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    this.maybeCleanup(now);

    const existing = this.buckets.get(key);
    const bucket = existing && existing.window_end_ms > now
      ? existing
      : { window_start_ms: now, window_end_ms: now + windowMs, count: 0 };

    if (!existing || existing.window_end_ms <= now) {
      this.buckets.set(key, bucket);
    }

    if (bucket.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.window_end_ms - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        limit,
        reset_at_ms: bucket.window_end_ms,
        retry_after_seconds: retryAfterSeconds,
      };
    }

    bucket.count += 1;

    const remaining = Math.max(0, limit - bucket.count);
    return {
      allowed: true,
      remaining,
      limit,
      reset_at_ms: bucket.window_end_ms,
      retry_after_seconds: 0,
    };
  }

  private maybeCleanup(nowMs: number) {
    if (nowMs < this.nextCleanupAtMs) return;
    this.nextCleanupAtMs = nowMs + 60_000;

    // 固定窗：只要 window_end < now 就可以移除
    for (const [key, bucket] of this.buckets) {
      if (bucket.window_end_ms <= nowMs) this.buckets.delete(key);
    }
  }
}

