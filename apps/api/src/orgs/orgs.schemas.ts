/**
 * Orgs Schemas（Zod）
 *
 * 這裡定義「建立 organization」時，request body 的驗證規則。
 * 重要觀念：
 * - TypeScript 型別只能保護「你寫的程式」；不能保護「外部傳進來的 JSON」
 * - 所以我們用 zod 做 runtime validation，搭配 `ZodValidationPipe` 讓錯誤變成 400
 */

import { z } from 'zod';

export const createOrgSchema = z.object({
  // 學校/租戶的名稱：必填，去掉前後空白，長度限制避免亂輸入造成 UI/DB 問題。
  name: z.string().trim().min(1).max(200),

  // code：可讀代碼（選填）
  // - 之後可用於匯入、顯示、或做短網址（比 UUID 好記）
  // - 我們要求小寫 + 數字 + dash，避免大小寫與特殊字元造成問題
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'code must be lowercase letters/numbers/dashes')
    .optional(),
});

// `z.infer`：從 schema 直接推導 TypeScript 型別（避免型別與驗證規則不一致）。
export type CreateOrgInput = z.infer<typeof createOrgSchema>;
