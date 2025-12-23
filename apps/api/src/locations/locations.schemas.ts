/**
 * Locations Schemas（Zod）
 *
 * `locations` 用來描述館內「位置/分館/分區/書架」。
 * 例如：主館、兒童區、小說區、A-03 書架。
 *
 * 建立 location 時，至少需要：
 * - code：機器可讀代碼（用於匯入/設定/辨識）
 * - name：人類可讀名稱（顯示在 UI）
 */

import { z } from 'zod';

export const createLocationSchema = z.object({
  // code：建議使用小寫 + 數字 + dash，避免大小寫與特殊字元造成不一致。
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'code must be lowercase letters/numbers/dashes'),

  // name：顯示名稱（必填）。
  name: z.string().trim().min(1).max(200),

  // area：可選的分區（例如「兒童區」「小說區」）。
  area: z.string().trim().min(1).max(200).optional(),

  // shelf_code：可選的書架代碼（例如「A-03」）。
  shelf_code: z.string().trim().min(1).max(64).optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
