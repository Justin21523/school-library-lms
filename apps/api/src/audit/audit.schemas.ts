/**
 * Audit Schemas（Zod）
 *
 * 本模組提供「稽核事件（audit_events）」查詢。
 *
 * 重要背景：
 * - audit_events 記錄了「誰（actor_user_id）在什麼時間做了什麼（action）」並影響哪些資料（entity_type/entity_id）
 * - 這類資料通常包含敏感資訊（例如借閱相關），因此需要基本權限控管
 *
 * MVP 權限策略（沒有 auth 的前提下的最小控管）：
 * - 查詢端點要求 `actor_user_id`（查詢者）
 * - 後端會驗證該 user 必須是 admin/librarian 且 active
 *
 * 注意：
 * - 這不是完整安全方案；真正做法是導入 auth，改由 token 推導 actor
 * - 但它能避免「不帶任何身份」就取得稽核資料
 */

import { z } from 'zod';

const uuidSchema = z.string().uuid();

// limit：query string → int（1..5000）
const intFromStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return Number.parseInt(trimmed, 10);
  }

  return value;
}, z.number().int().min(1).max(5000));

// free-text filter：允許用在 action/entity_type/entity_id/actor_query 等
const shortTextSchema = z.string().trim().min(1).max(200);

/**
 * list audit events query
 *
 * 支援常用篩選：
 * - from/to：時間區間（created_at）
 * - action：事件類型（例如 loan.checkout）
 * - entity_type/entity_id：影響的資料
 * - actor_query：用 actor 的 external_id / name 做模糊查詢（方便現場查人）
 */
export const listAuditEventsQuerySchema = z.object({
  // 查詢者（viewer / requestor）
  actor_user_id: uuidSchema,

  // from/to：這裡先用字串；由 DB 端解析 timestamptz（錯誤會轉成 400）
  from: z.string().trim().min(1).max(64).optional(),
  to: z.string().trim().min(1).max(64).optional(),

  // filters
  action: shortTextSchema.optional(),
  entity_type: shortTextSchema.optional(),
  entity_id: shortTextSchema.optional(),
  actor_query: shortTextSchema.optional(),

  limit: intFromStringSchema.optional(),
});

export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuerySchema>;

