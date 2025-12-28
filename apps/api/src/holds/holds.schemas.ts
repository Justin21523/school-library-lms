/**
 * Holds Schemas（Zod）
 *
 * 這裡定義 holds（預約/保留）的 request 驗證規則。
 *
 * 重要背景：
 * - DB 的 holds.status 是 enum：queued/ready/cancelled/fulfilled/expired
 * - 本專案同時支援兩種使用情境：
 *   1) staff（館員後台 Web Console）：已導入 Staff Auth（Bearer token）
 *      - 重要 staff 動作端點（例如 fulfill / expire-ready）在 controller 層套用 StaffAuthGuard
 *      - actor_user_id 仍保留在 body（寫 audit / RBAC），但 guard 會要求它必須等於登入者（避免冒用）
 *   2) patron（讀者自助 OPAC）：目前仍是「無登入」模式
 *      - create/cancel 等端點允許不帶 actor_user_id，後端會視為「本人操作」
 *
 * 注意：
 * - 目前 OPAC 仍未導入讀者登入，因此「本人操作」仍屬 MVP 的最小可用假設
 * - 後續若要真正安全，建議導入讀者身分驗證（或另開 OPAC 專用端點/權杖）
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
 * - actor_user_id（可選）：誰在操作（用於 audit）
 *   - staff 代辦：傳 actor_user_id（館員）
 *   - OPAC 自助：不傳 actor_user_id（後端視為 borrower 本人）
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
 * - staff 取消：傳 actor_user_id（館員）
 * - OPAC 自助取消：不傳（後端視為 hold.user_id 本人）
 */
export const cancelHoldSchema = z.object({
  actor_user_id: uuidSchema.optional(),
});

export type CancelHoldInput = z.infer<typeof cancelHoldSchema>;

/**
 * fulfill（取書借出 / 完成保留）
 *
 * 這是一個「館員動作」：
 * - 需要 actor_user_id（admin/librarian）
 * - 會建立 loan、更新 item 狀態、更新 hold 狀態，並寫 audit
 */
export const fulfillHoldSchema = z.object({
  actor_user_id: uuidSchema,
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
  actor_user_id: uuidSchema,
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
