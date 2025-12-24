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

/**
 * Ready Holds（取書架清單 / 可取書清單）
 *
 * 情境：
 * - holds.status=ready 代表「該冊已被保留在取書架上」，等待读者到館取書
 * - 館員每天需要一份清單，才能：
 *   - 快速對照：取書架上有哪些書、要給誰
 *   - 找出已過期但仍卡在 ready 的 hold（提醒跑 maintenance）
 *   - 匯出 CSV / 列印小條（紙本工作流仍很常見）
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/reports/ready-holds?actor_user_id=...&pickup_location_id=...&as_of=...&limit=...&format=json|csv
 */
export const readyHoldsReportQuerySchema = z.object({
  actor_user_id: uuidSchema,

  // as_of：用哪個時間點判定「是否已過期」（ready_until < as_of）
  // - 未提供時，後端用「現在」作為基準
  as_of: z.string().trim().min(1).max(64).optional(),

  // pickup_location_id：取書地點（館別/分區）過濾；未提供代表不過濾
  pickup_location_id: uuidSchema.optional(),

  // limit：避免一次撈爆（上限 5000）
  limit: intFromStringSchema.optional(),

  // format：json/csv（同一端點支援匯出）
  format: reportFormatSchema.optional(),
});

export type ReadyHoldsReportQuery = z.infer<typeof readyHoldsReportQuerySchema>;

/**
 * US-051：Zero Circulation（零借閱清單 / 零借閱報表）
 *
 * 需求：
 * - 館員能選一段期間（from/to），找出「在此期間內沒有任何借出（loans）」的書目
 * - 典型用途：汰舊（weeding）、館藏調整、補書決策
 *
 * MVP 限制：
 * - USER-STORIES.md 提到「排除類型（參考書/典藏）」；但目前資料模型尚未有 material_type/collection_type 欄位
 * - 因此本輪先提供「期間內零借閱」的核心功能；排除類型可在未來擴充（例如在 bib/item 增加欄位或 tag）
 */
export const zeroCirculationReportQuerySchema = z.object({
  actor_user_id: uuidSchema,

  from: z.string().trim().min(1).max(64),
  to: z.string().trim().min(1).max(64),

  limit: intFromStringSchema.optional(),
  format: reportFormatSchema.optional(),
});

export type ZeroCirculationReportQuery = z.infer<typeof zeroCirculationReportQuerySchema>;

/**
 * Inventory Diff（盤點差異清單）
 *
 * 需求（對齊 MVP-SPEC.md 的「盤點」段落）：
 * - 在某次盤點 session 結束後，產出差異清單：
 *   1) missing：在架（available）但未掃到
 *   2) unexpected：掃到但系統顯示非在架（status != available 或 location 不一致）
 *
 * 設計：
 * - inventory_session_id：用 session 作為「本次盤點」的唯一識別（比時間區間更可靠）
 * - format=csv：沿用 reports 的 JSON + CSV 基礎架構（含 Excel 友善 BOM）
 * - limit：避免一次回傳過大（預設 5000；若校內館藏更大可再調整/做分頁）
 */
export const inventoryDiffReportQuerySchema = z.object({
  actor_user_id: uuidSchema,
  inventory_session_id: uuidSchema,
  limit: intFromStringSchema.optional(),
  format: reportFormatSchema.optional(),
});

export type InventoryDiffReportQuery = z.infer<typeof inventoryDiffReportQuerySchema>;
