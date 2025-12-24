/**
 * Auth Schemas（Zod）
 *
 * 這裡定義「Staff 登入」與「設定密碼」等 auth 相關的 request 驗證規則。
 *
 * 重要背景（本專案的演進路線）：
 * - 早期 MVP 為了快速落地，採用 actor_user_id（由前端傳入）作為最小稽核/權限控管
 * - 當功能越來越多（報表/匯入/維運/稽核），actor_user_id 開始有兩個問題：
 *   1) 使用者可以在 UI 任意選 actor（可被冒用）
 *   2) API 缺少「誰真的就是誰」的身分驗證（authentication）
 *
 * 因此本輪補上 Staff Auth：
 * - 以 org + external_id + password 登入，取得 Bearer token
 * - 後端用 StaffAuthGuard 驗證 token，並要求 request 的 actor_user_id 必須與 token 內的 user_id 一致
 *   → 讓 actor_user_id 從「手動選擇」收斂成「由登入身分推導」
 */

import { z } from 'zod';

const uuidSchema = z.string().uuid();
const nonEmptyStringSchema = z.string().trim().min(1).max(200);

/**
 * Staff login（登入）
 *
 * 設計：
 * - external_id：學號/員編（在 staff 情境就是員編）
 * - password：密碼（MVP 先用最小可用；後續可加強密碼政策、鎖定、2FA）
 */
export const staffLoginSchema = z.object({
  external_id: z.string().trim().min(1).max(64),
  password: nonEmptyStringSchema,
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

/**
 * 設定/重設密碼（admin 操作）
 *
 * - actor_user_id：操作者（必須是 admin/librarian；實際上 guard 會要求它等於 token user）
 * - target_user_id：要設定密碼的目標使用者（通常是 admin/librarian）
 */
export const setStaffPasswordSchema = z.object({
  actor_user_id: uuidSchema,
  target_user_id: uuidSchema,
  new_password: nonEmptyStringSchema,
  note: z.string().trim().min(1).max(200).optional(),
});

export type SetStaffPasswordInput = z.infer<typeof setStaffPasswordSchema>;

/**
 * Bootstrap：第一次設定密碼
 *
 * 目的：
 * - 解決「還沒有人能登入，所以也無法用 admin token 設定密碼」的雞生蛋問題
 *
 * 風險與取捨：
 * - 需要一個環境變數 `AUTH_BOOTSTRAP_SECRET` 作為一次性通關密語
 * - 若未設定，這個 endpoint 會直接拒絕（避免 production 被誤開）
 */
export const bootstrapSetStaffPasswordSchema = z.object({
  bootstrap_secret: nonEmptyStringSchema,
  target_external_id: z.string().trim().min(1).max(64),
  new_password: nonEmptyStringSchema,
  note: z.string().trim().min(1).max(200).optional(),
});

export type BootstrapSetStaffPasswordInput = z.infer<typeof bootstrapSetStaffPasswordSchema>;

