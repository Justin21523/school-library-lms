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

