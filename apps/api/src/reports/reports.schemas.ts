/**
 * Reports Schemas（Zod）
 *
 * 報表（reports）屬於「讀取型」端點，但通常包含較敏感資訊（例如逾期名單）。
 * 因此在 MVP（沒有 auth）階段，我們先用 `actor_user_id` 做最小控管：
 * - 只有 admin/librarian（館員/管理者）可以查詢/匯出逾期清單
 * - 前端（Web Console）必須提供 actor_user_id
 *
 * 注意：
 * - 這不是完整的權限系統；真正解法是導入 auth（token/SSO）後由後端推導 actor
 * - 但它能避免「任何人直接打 API 就能拿到逾期名單」的風險
 */

import { z } from 'zod';

// 共用：UUID、文字欄位、limit
const uuidSchema = z.string().uuid();
const nonEmptyStringSchema = z.string().trim().min(1).max(200);

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

// format：同一個 endpoint 同時支援 JSON 與 CSV（?format=csv）
export const reportFormatSchema = z.enum(['json', 'csv']);

/**
 * Overdue report query
 *
 * 支援：
 * - actor_user_id：必填（館員/管理者）
 * - as_of：可選（ISO 8601 時間字串）；未提供時後端以「現在」為基準
 * - org_unit：可選（班級/單位）；對應 users.org_unit（MVP 用字串直接比對）
 * - limit：可選（最多 5000）
 * - format：可選（json/csv；預設 json）
 */
export const overdueReportQuerySchema = z.object({
  actor_user_id: uuidSchema,

  // as_of：這裡先用「字串」驗證（避免 zod datetime 在不同格式下太嚴格）。
  // - 實際上我們會在 service 端把它當成 timestamptz 送進 Postgres 解析
  // - 若格式錯誤，會由 DB 端回 22P02，再轉成 400（對齊其他模組）
  as_of: z.string().trim().min(1).max(64).optional(),

  org_unit: nonEmptyStringSchema.optional(),
  limit: intFromStringSchema.optional(),
  format: reportFormatSchema.optional(),
});

export type OverdueReportQuery = z.infer<typeof overdueReportQuerySchema>;

/**
 * US-050：Top Circulation（熱門書）
 *
 * 需求：館員能選一段期間，查「借閱次數最高的書」（通常用於閱讀推廣、補書決策）
 *
 * 設計：
 * - from/to：期間邊界（timestamptz）
 * - limit：回傳前 N 名（預設 50）
 * - format：json/csv（同一端點支援匯出）
 */
export const topCirculationReportQuerySchema = z.object({
  actor_user_id: uuidSchema,

  from: z.string().trim().min(1).max(64),
  to: z.string().trim().min(1).max(64),

  limit: intFromStringSchema.optional(),
  format: reportFormatSchema.optional(),
});

export type TopCirculationReportQuery = z.infer<typeof topCirculationReportQuerySchema>;

/**
 * US-050：Circulation Summary（借閱量彙總）
 *
 * 需求：館員能選一段期間，並以 day/week/month 彙總借閱量（借出筆數）
 *
 * 注意：
 * - 「學期」在 MVP 先視為「你自行選擇 from/to 的期間」（例如 113-1）
 * - group_by 則是「統計顆粒度」（日/週/月）
 */
export const circulationSummaryGroupBySchema = z.enum(['day', 'week', 'month']);

export const circulationSummaryReportQuerySchema = z.object({
  actor_user_id: uuidSchema,

  from: z.string().trim().min(1).max(64),
  to: z.string().trim().min(1).max(64),

  group_by: circulationSummaryGroupBySchema,
  format: reportFormatSchema.optional(),
});

export type CirculationSummaryReportQuery = z.infer<typeof circulationSummaryReportQuerySchema>;
