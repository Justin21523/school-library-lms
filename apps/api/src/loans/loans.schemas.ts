/**
 * Loans Schemas（Zod）
 *
 * 這裡定義「借閱查詢（loans list）」的 query 參數驗證規則。
 *
 * 為什麼 query 也要驗證？
 * - Query string 也是外部輸入（不可信）
 * - 例如 status 若傳錯字，應該回 400 而不是讓 DB 報錯或回奇怪結果
 * - limit 若傳非數字，應該回 400，避免造成意外的大查詢
 */

import { z } from 'zod';

// 共用 schema：UUID（用於 loan/user/item 等）
const uuidSchema = z.string().uuid();

// status：借閱狀態的查詢範圍（注意：DB 的 loan_status 只有 open/closed）
// - open：未歸還（returned_at IS NULL）
// - closed：已歸還（returned_at IS NOT NULL）
// - all：不限制
export const loanListStatusSchema = z.enum(['open', 'closed', 'all']);

// Query string 都是字串，但 limit 我們希望是 int，因此用 preprocess 轉型。
const intFromStringSchema = z.preprocess((value) => {
  // 未提供就回 undefined（讓 optional 生效）
  if (value === undefined || value === null) return undefined;

  // query param 在 Nest 會是 string（也可能是 string[]，但我們不支援重複參數）
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return Number.parseInt(trimmed, 10);
  }

  return value;
}, z.number().int().min(1).max(500));

export const listLoansQuerySchema = z.object({
  // status：可選；未提供時我們會在 service 端預設為 open（符合館員常用情境）。
  status: loanListStatusSchema.optional(),

  // user_external_id：可選；精確比對（external_id 在同 org 內唯一）。
  user_external_id: z.string().trim().min(1).max(64).optional(),

  // item_barcode：可選；精確比對（barcode 在同 org 內唯一）。
  item_barcode: z.string().trim().min(1).max(64).optional(),

  // limit：可選；控制回傳筆數上限（避免一次拉太多）。
  limit: intFromStringSchema.optional(),
});

export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;

/**
 * US-061：借閱歷史保存期限（Maintenance / Retention）
 *
 * 目標：
 * - 依 retention_days（保存天數）刪除「已歸還且過久」的借閱紀錄（loans）
 *
 * 設計：
 * - mode=preview：只回傳候選清單與摘要（不寫 DB）
 * - mode=apply：實際刪除（寫 DB + 寫 audit）
 *
 * 注意（MVP）：
 * - 本專案尚未做完整 auth，因此仍要求 actor_user_id（admin）
 * - 後續導入 auth 後，actor 應由 token 推導
 */
export const loanMaintenanceModeSchema = z.enum(['preview', 'apply']);

// limit：body/query string → int（1..5000）
const intFromStringWideSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return Number.parseInt(trimmed, 10);
  }

  return value;
}, z.number().int().min(1).max(5000));

export const purgeLoanHistorySchema = z.object({
  actor_user_id: uuidSchema,
  mode: loanMaintenanceModeSchema,

  // as_of：用哪個時間點作為「現在」（未提供時由後端用 DB now()）
  as_of: z.string().trim().min(1).max(64).optional(),

  // retention_days：要保留幾天的借閱歷史（必填；避免不小心刪光）
  retention_days: intFromStringWideSchema,

  // limit：一次預覽/刪除最多幾筆（預設 200；可用於分批）
  limit: intFromStringWideSchema.optional(),

  // include_audit_events：是否連同 loan 相關 audit_events 一起清除（預設 false；避免誤刪）
  include_audit_events: z.boolean().optional(),

  // note：備註（寫入 audit metadata；選填）
  note: z.string().trim().min(1).max(200).optional(),
});

export type PurgeLoanHistoryInput = z.infer<typeof purgeLoanHistorySchema>;
