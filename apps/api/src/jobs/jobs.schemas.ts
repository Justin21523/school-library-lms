/**
 * Jobs Schemas（Zod）
 *
 * 目標：
 * - 先把「會跑很久/可能失敗/需要重試」的操作，收斂成 background job
 * - 讓 HTTP request 變成「排隊」而不是「卡住等跑完」
 *
 * 這一版是 MVP/P2 的起點：
 * - 先做最小可用：enqueue + status 查詢
 * - 後續再把 import/report/maintenance 逐步改成 async
 */

import { z } from 'zod';

// limit：string/number → int（1..5000）
const intFromStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return Number.parseInt(trimmed, 10);
  }

  return value;
}, z.number().int().min(1).max(5000));

/**
 * enqueue: holds.expire_ready（到書未取到期處理）
 *
 * - 只允許 staff（StaffAuthGuard）
 * - actor_user_id 由後端推導（req.staff_user.id），避免前端冒用
 */
export const enqueueExpireReadyHoldsJobSchema = z.object({
  as_of: z.string().trim().min(1).max(64).optional(),
  limit: intFromStringSchema.optional(),
  note: z.string().trim().min(1).max(200).optional(),
});

export type EnqueueExpireReadyHoldsJobInput = z.infer<typeof enqueueExpireReadyHoldsJobSchema>;

