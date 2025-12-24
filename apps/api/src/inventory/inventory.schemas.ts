/**
 * Inventory Schemas（Zod）
 *
 * Inventory（盤點）的核心動作可以拆成三件事：
 * 1) 開一個盤點 session（在哪個 location、誰開始、什麼時候開始）
 * 2) 在 session 內掃描冊條碼（把「掃到」記錄下來，並更新 item.last_inventory_at）
 * 3) 關閉 session（寫入 audit，並讓差異清單/報表有一個「封存時間點」）
 *
 * 為什麼要有 session？
 * - 只靠 item_copies.last_inventory_at 很難回答：「這本書是在哪一次盤點被掃到？」
 * - session_id 讓差異清單可重現（給同一個 session_id，結果就固定）
 *
 * 注意：
 * - 盤點是 staff 工作台行為，因此所有端點都會被 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id 仍保留在 body（寫 audit / RBAC），並由 guard 強制等於登入者（避免冒用）
 */

import { z } from 'zod';

// 共用 schema：UUID / 條碼 / note
const uuidSchema = z.string().uuid();
const barcodeSchema = z.string().trim().min(1).max(64);
const noteSchema = z.string().trim().min(1).max(200);

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
 * POST /inventory/sessions：建立盤點 session
 */
export const createInventorySessionSchema = z.object({
  actor_user_id: uuidSchema,
  location_id: uuidSchema,
  note: noteSchema.optional(),
});

export type CreateInventorySessionInput = z.infer<typeof createInventorySessionSchema>;

/**
 * GET /inventory/sessions：列出盤點 sessions（方便回看/選擇報表）
 */
export const inventorySessionStatusFilterSchema = z.enum(['open', 'closed', 'all']);

export const listInventorySessionsQuerySchema = z.object({
  location_id: uuidSchema.optional(),
  status: inventorySessionStatusFilterSchema.optional(),
  limit: intFromStringSchema.optional(),
});

export type ListInventorySessionsQuery = z.infer<typeof listInventorySessionsQuerySchema>;

/**
 * POST /inventory/sessions/:sessionId/scan：掃描冊條碼
 */
export const scanInventoryItemSchema = z.object({
  actor_user_id: uuidSchema,
  item_barcode: barcodeSchema,
});

export type ScanInventoryItemInput = z.infer<typeof scanInventoryItemSchema>;

/**
 * POST /inventory/sessions/:sessionId/close：關閉 session（寫 audit）
 */
export const closeInventorySessionSchema = z.object({
  actor_user_id: uuidSchema,
  note: noteSchema.optional(),
});

export type CloseInventorySessionInput = z.infer<typeof closeInventorySessionSchema>;

