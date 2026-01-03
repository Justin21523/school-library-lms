/**
 * Holds Schemas（Zod）
 *
 * 這裡定義 holds（預約/保留）的 request 驗證規則。
 *
 * 重要背景：
 * - DB 的 holds.status 是 enum：queued/ready/cancelled/fulfilled/expired
 * - 本專案目前有兩種「端點族群」：
 *   1) staff（館員後台 Web Console）：`/api/v1/orgs/:orgId/holds/*`
 *      - controller 全面套用 StaffAuthGuard（Bearer token）
 *      - actor_user_id 由後端推導（req.staff_user.id），避免前端可冒用/可省略導致 audit 失真
 *   2) patron（讀者自助 OPAC Account）：`/api/v1/orgs/:orgId/me/*`
 *      - 由 PatronAuthGuard 保護，user_id 由 token 推導
 *      - OPAC 不再提供「以 user_external_id 冒充本人」的過渡寫入端點
 *
 * 注意：
 * - 若你需要「館員替讀者代辦」：走 staff `/holds` 端點（會寫入 audit 並受 RBAC 控制）
 */

import { z } from 'zod';

// 共用 schema：UUID 與 external_id（學號/員編）。
const uuidSchema = z.string().uuid();
const externalIdSchema = z.string().trim().min(1).max(64);
const barcodeSchema = z.string().trim().min(1).max(64);

// status filter：list holds 時允許用 all 表示不過濾。
export const holdListStatusSchema = z.enum([
  'queued',
  'ready',
  'cancelled',
  'fulfilled',
  'expired',
  'all',
]);

// limit：query string → int（1..500）
const intFromStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return Number.parseInt(trimmed, 10);
  }

  return value;
}, z.number().int().min(1).max(500));

/**
 * 建立 hold（預約）
 *
 * 設計：
 * - user_external_id：指定「這筆預約是替誰建立」（借閱者）
 * - actor_user_id（可選）：操作者（用於 audit）
 *   - staff `/holds`：可不傳（由 StaffAuthGuard 推導），或傳入（但必須等於 token user）
 *   - OPAC `/me/holds`：由 token 推導（前端不傳）
 */
export const createHoldSchema = z.object({
  bibliographic_id: uuidSchema,
  user_external_id: externalIdSchema,
  pickup_location_id: uuidSchema,
  actor_user_id: uuidSchema.optional(),
});

export type CreateHoldInput = z.infer<typeof createHoldSchema>;

/**
 * 取消 hold
 *
 * actor_user_id（可選）：
 * - staff `/holds/:id/cancel`：可不傳（由 StaffAuthGuard 推導），或傳入（但必須等於 token user）
 * - OPAC `/me/holds/:id/cancel`：由 token 推導（前端不傳）
 */
export const cancelHoldSchema = z.object({
  actor_user_id: uuidSchema.optional(),
});

export type CancelHoldInput = z.infer<typeof cancelHoldSchema>;

/**
 * fulfill（取書借出 / 完成保留）
 *
 * 這是一個「館員動作」：
 * - actor_user_id 由 StaffAuthGuard 推導（可不由前端傳）
 * - 會建立 loan、更新 item 狀態、更新 hold 狀態，並寫 audit
 */
export const fulfillHoldSchema = z.object({
  actor_user_id: uuidSchema.optional(),
});

export type FulfillHoldInput = z.infer<typeof fulfillHoldSchema>;

/**
 * US-0xx：Holds 到期處理（ready_until → expired）
 *
 * 這是一個「館員每日例行作業」型的端點：
 * - 目的：把超過取書期限（ready_until）的 hold 標記為 expired，並釋放/轉派冊
 * - 風險：會批次更新資料，因此必須要求 actor_user_id（admin/librarian）
 *
 * 設計：
 * - mode=preview：只列出「會被處理的 holds」與摘要（不寫入 DB）
 * - mode=apply：實際更新（寫 DB + 寫 audit_events）
 *
 * 為什麼要有 preview？
 * - 學校現場常見「某天停課/校內活動」導致取書延後；館員可能想先確認清單再處理
 * - preview 能降低誤操作成本（尤其是第一次導入）
 */
export const holdMaintenanceModeSchema = z.enum(['preview', 'apply']);

export const expireReadyHoldsSchema = z.object({
  actor_user_id: uuidSchema.optional(),
  mode: holdMaintenanceModeSchema,

  // as_of：用哪個時間點判定過期（未提供時由後端用 DB now() 取得）
  // - 用字串是為了允許 ISO 8601（或 Postgres 能 parse 的 timestamptz 格式）
  as_of: z.string().trim().min(1).max(64).optional(),

  // limit：一次處理/預覽最多幾筆（避免長時間鎖）
  // - 我們沿用 query 版的 int preprocess，讓前端送 string/number 都可
  limit: intFromStringSchema.optional(),

  // note：操作備註（寫入 audit metadata；選填）
  note: z.string().trim().min(1).max(200).optional(),
});

export type ExpireReadyHoldsInput = z.infer<typeof expireReadyHoldsSchema>;

/**
 * list holds query
 */
export const listHoldsQuerySchema = z.object({
  /**
   * query：模糊搜尋（使用者/書名/取書地點/冊條碼）
   *
   * 需求動機（對齊你的回饋）：
   * - 只靠 user_external_id/item_barcode/bibliographic_id 的精確鍵，對日常查詢不友善
   * - 館員通常只記得「姓名/書名」或想快速找「某地點的 ready holds」
   *
   * 行為：
   * - 後端用 ILIKE + %...% 在 joins（user/bib/location/assigned item）欄位做 OR 搜尋
   * - 仍保留精確 filter（掃碼/名冊編號）以支援高確定性操作
   */
  query: z.string().trim().min(1).max(200).optional(),
  status: holdListStatusSchema.optional(),
  user_external_id: externalIdSchema.optional(),
  item_barcode: barcodeSchema.optional(),
  bibliographic_id: uuidSchema.optional(),
  pickup_location_id: uuidSchema.optional(),
  limit: intFromStringSchema.optional(),

  // cursor：cursor pagination（keyset）
  // - 由 API 回傳 next_cursor
  // - 前端「載入更多」時帶回來即可續查
  cursor: z.string().trim().min(1).max(500).optional(),
});

export type ListHoldsQuery = z.infer<typeof listHoldsQuerySchema>;
