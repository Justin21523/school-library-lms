/**
 * Circulation Schemas（Zod）
 *
 * checkout/checkin 的 request body 驗證規則。
 * 注意：目前尚未實作 auth，因此必須由前端傳入 actor_user_id（操作者）。
 */

import { z } from 'zod';

// 共用：條碼/外部 ID 都是「短字串 + 可掃描」的概念。
const barcodeSchema = z.string().trim().min(1).max(64);
const externalIdSchema = z.string().trim().min(1).max(64);
const uuidSchema = z.string().uuid();

export const checkoutSchema = z.object({
  // user_external_id：借書人（讀者）的學號/員編等來源系統 ID。
  user_external_id: externalIdSchema,

  // item_barcode：冊條碼（實體掃描條碼）。
  item_barcode: barcodeSchema,

  // actor_user_id：操作者（館員/管理者），用來寫入 audit_events。
  actor_user_id: uuidSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const checkinSchema = z.object({
  // item_barcode：歸還的冊條碼。
  item_barcode: barcodeSchema,

  // actor_user_id：操作者（館員/管理者）。
  actor_user_id: uuidSchema,
});

export type CheckinInput = z.infer<typeof checkinSchema>;
