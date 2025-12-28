/**
 * Me Schemas（Zod）
 *
 * Me（/me）端點是「登入後的讀者自助 API」：
 * - 目標：讓前端不需要傳 user_external_id，就能安全地拿到「自己的資料」
 * - 這是 OPAC Account（登入/我的借閱/我的預約）的基礎
 *
 * 重要原則：
 * - user_id 由 Bearer token 推導（PatronAuthGuard），不從 query/body 傳入
 * - 因此 schema 只驗證「與本人無關」的輸入，例如 status filter、bibliographic_id
 */

import { z } from 'zod';

const uuidSchema = z.string().uuid();

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

// loans status filter：沿用 loans/list 的概念
export const meLoanStatusSchema = z.enum(['open', 'closed', 'all']);

export const listMyLoansQuerySchema = z.object({
  status: meLoanStatusSchema.optional(),
  limit: intFromStringSchema.optional(),
  // cursor：支援大量資料時的 keyset pagination（與 /loans、/holds 一致）
  cursor: z.string().trim().min(1).max(500).optional(),
});

export type ListMyLoansQuery = z.infer<typeof listMyLoansQuerySchema>;

// holds status filter：沿用 holds/list 的概念
export const meHoldStatusSchema = z.enum(['queued', 'ready', 'cancelled', 'fulfilled', 'expired', 'all']);

export const listMyHoldsQuerySchema = z.object({
  status: meHoldStatusSchema.optional(),
  limit: intFromStringSchema.optional(),
  // cursor：支援大量資料時的 keyset pagination（與 /loans、/holds 一致）
  cursor: z.string().trim().min(1).max(500).optional(),
});

export type ListMyHoldsQuery = z.infer<typeof listMyHoldsQuerySchema>;

export const placeMyHoldSchema = z.object({
  bibliographic_id: uuidSchema,
  pickup_location_id: uuidSchema,
});

export type PlaceMyHoldInput = z.infer<typeof placeMyHoldSchema>;
