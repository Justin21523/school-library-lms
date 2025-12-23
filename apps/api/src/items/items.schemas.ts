/**
 * Items Schemas（Zod）
 *
 * item_copies（實體冊）是借還與盤點的核心；
 * 這裡定義建立/更新的欄位驗證規則。
 */

import { z } from 'zod';

// item_status 的允許值（與 db/schema.sql 的 enum 對齊）。
export const itemStatusValues = [
  'available',
  'checked_out',
  'on_hold',
  'lost',
  'withdrawn',
  'repair',
] as const;

const itemStatusSchema = z.enum(itemStatusValues);

export const createItemSchema = z.object({
  // barcode：同 org 內唯一，建議實體條碼直接對應。
  barcode: z.string().trim().min(1).max(64),

  // call_number：索書號（上架/找書用）。
  call_number: z.string().trim().min(1).max(128),

  // location_id：此冊的歸屬位置（必填）。
  location_id: z.string().uuid(),

  // status：建立時預設 available；必要時可指定（例如 repair）。
  status: itemStatusSchema.optional(),

  // acquired_at/last_inventory_at：ISO 8601 字串（timestamptz）。
  acquired_at: z.string().datetime().optional(),
  last_inventory_at: z.string().datetime().optional(),

  // notes：備註（破損、贈書等）。
  notes: z.string().trim().min(1).max(1000).optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  // 更新時允許部分欄位修改。
  barcode: z.string().trim().min(1).max(64).optional(),
  call_number: z.string().trim().min(1).max(128).optional(),
  location_id: z.string().uuid().optional(),
  status: itemStatusSchema.optional(),
  acquired_at: z.string().datetime().nullable().optional(),
  last_inventory_at: z.string().datetime().nullable().optional(),
  notes: z.string().trim().min(1).max(1000).nullable().optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;
