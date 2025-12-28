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

const statusSchema = z.enum(['active', 'inactive']);

export const createLocationSchema = z.object({
  // code：建議使用「英數 + dash」，避免空白/特殊字元造成匯入與管理成本上升。
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'code must be letters/numbers/dashes'),

  // name：顯示名稱（必填）。
  name: z.string().trim().min(1).max(200),

  // area：可選的分區（例如「兒童區」「小說區」）。
  area: z.string().trim().min(1).max(200).optional(),

  // shelf_code：可選的書架代碼（例如「A-03」）。
  shelf_code: z.string().trim().min(1).max(64).optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

/**
 * update location（PATCH）
 *
 * 需求（US-001）：
 * - location 需要能「編輯/停用」
 *
 * 設計取捨（MVP）：
 * - area/shelf_code 允許送 null 清空（與 users.org_unit 類似）
 * - status 用於停用/啟用（active/inactive）
 * - code/name 仍可更新，但 code 需維持原本格式限制（避免匯入/管理成本上升）
 */
export const updateLocationSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'code must be letters/numbers/dashes')
      .optional(),
    name: z.string().trim().min(1).max(200).optional(),
    area: z.string().trim().min(1).max(200).nullable().optional(),
    shelf_code: z.string().trim().min(1).max(64).nullable().optional(),
    status: statusSchema.optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.area !== undefined ||
      value.shelf_code !== undefined ||
      value.status !== undefined,
    {
      message: 'At least one field must be provided to update location',
    },
  );

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
