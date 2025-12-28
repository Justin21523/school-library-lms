/**
 * Policies Schemas（Zod）
 *
 * circulation policy（借閱政策）是「把規則從程式碼搬到資料」的關鍵：
 * - 借期幾天
 * - 同時可借上限
 * - 續借上限
 * - 預約上限
 * - 到館保留幾天
 *
 * MVP 先做 student/teacher 兩套；未來可擴成：
 * - 依館藏類型（繪本/小說/教具）不同政策
 * - 依年級不同政策
 * - 版本化政策（policy versioning）
 */

import { z } from 'zod';

// audience_role：目前只做 student/teacher，避免把 enum 做太大（MVP）。
const audienceRoleSchema = z.enum(['student', 'teacher']);

export const createPolicySchema = z.object({
  // code：可讀代碼，用於匯入/設定（同 org 內唯一）。
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'code must be letters/numbers/dashes'),

  // name：顯示名稱（例如「學生預設政策」）。
  name: z.string().trim().min(1).max(200),

  // audience_role：這套政策是給哪種角色用（student/teacher）。
  audience_role: audienceRoleSchema,

  // 下面是可調參數，使用 int 並限制範圍，避免輸入極端值。
  loan_days: z.number().int().min(1).max(365),
  max_loans: z.number().int().min(0).max(999),
  max_renewals: z.number().int().min(0).max(99),
  max_holds: z.number().int().min(0).max(99),
  hold_pickup_days: z.number().int().min(0).max(99),

  // overdue_block_days：逾期達 X 天後，禁止新增借閱（checkout/renew/hold/fulfill）
  // - 0 代表不啟用
  // - 實際判定由後端以「整天數」推導（見 circulation/holds service）
  overdue_block_days: z.number().int().min(0).max(365),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

/**
 * update policy（PATCH）
 *
 * 需求（US-002）：
 * - 借閱政策需要可調整（例如每學期規則不同）
 * - 同時需要「明確的有效政策」機制，避免只能靠 created_at「最新一筆」的隱性規則
 *
 * 設計取捨（MVP）：
 * - audience_role 不允許更新（避免一筆政策在不同角色間「搬家」造成追溯困難）
 * - is_active 只允許設為 true（啟用）
 *   - 停用/切換有效政策：用「啟用另一筆」來完成（避免把角色政策整個停用導致 checkout/renew/holds 無規則可用）
 */
export const updatePolicySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'code must be letters/numbers/dashes')
      .optional(),
    name: z.string().trim().min(1).max(200).optional(),

    loan_days: z.number().int().min(1).max(365).optional(),
    max_loans: z.number().int().min(0).max(999).optional(),
    max_renewals: z.number().int().min(0).max(99).optional(),
    max_holds: z.number().int().min(0).max(99).optional(),
    hold_pickup_days: z.number().int().min(0).max(99).optional(),
    overdue_block_days: z.number().int().min(0).max(365).optional(),

    // 啟用此政策（只允許 true；不可直接把有效政策設回 false）
    is_active: z.literal(true).optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.loan_days !== undefined ||
      value.max_loans !== undefined ||
      value.max_renewals !== undefined ||
      value.max_holds !== undefined ||
      value.hold_pickup_days !== undefined ||
      value.overdue_block_days !== undefined ||
      value.is_active !== undefined,
    {
      message: 'At least one field must be provided to update policy',
    },
  );

export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
