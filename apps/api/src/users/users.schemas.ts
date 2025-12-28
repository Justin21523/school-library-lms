/**
 * Users Schemas（Zod）
 *
 * `users` 在此系統代表「讀者/館員/教師/管理者」的統一模型（Patron/Staff）。
 * MVP 先採用簡化 RBAC：
 * - 每個 user 只有一個 role（student/teacher/librarian/admin/guest）
 *
 * 之後若需要更細的權限（permissions）或多角色（user_roles），再擴充成多對多。
 */

import { z } from 'zod';

// z.enum：限定 role 必須是其中之一（避免資料庫 enum error 或拼字錯誤）。
const roleSchema = z.enum(['admin', 'librarian', 'teacher', 'student', 'guest']);
const statusSchema = z.enum(['active', 'inactive']);

// UUID：多個端點都會用到（actor_user_id / userId / orgId ...）
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

export const createUserSchema = z.object({
  // external_id：學號/教職員編號（來源系統的唯一鍵），比姓名可靠。
  external_id: z.string().trim().min(1).max(64),

  // name：姓名（必填）。
  name: z.string().trim().min(1).max(200),

  // role：角色（RBAC）。
  role: roleSchema,

  // org_unit：班級/單位（選填），用於查詢與報表分群。
  org_unit: z.string().trim().min(1).max(64).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * list users query（US-011）
 *
 * 需求：館員要能以姓名/學號/班級篩選使用者
 * - query：模糊搜尋（external_id / name / org_unit）
 * - role/status：精準篩選（避免搜尋結果太雜）
 *
 * 注意：
 * - 為了支援大量資料（scale seed）驗證，我們採用 cursor pagination（keyset）
 * - cursor 由 API 回傳（next_cursor），前端在「載入更多」時帶回來
 */
export const listUsersQuerySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  role: roleSchema.optional(),
  status: statusSchema.optional(),
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/**
 * update user（PATCH）
 *
 * 為什麼 PATCH 要帶 actor_user_id？
 * - MVP 目前沒有 auth（登入/權杖），後端無法從 token 推導操作者
 * - 但「停用/改角色」屬於敏感操作，因此仍必須有一個最小身份來源（actor_user_id）
 *
 * 設計：
 * - name/role/org_unit/status 為可更新欄位
 * - org_unit 支援 null（清空）
 * - status 用於停用/啟用（active/inactive）
 */
export const updateUserSchema = z
  .object({
    actor_user_id: uuidSchema,

    name: z.string().trim().min(1).max(200).optional(),
    role: roleSchema.optional(),

    // nullable：允許送 null 表示「清空班級/單位」
    org_unit: z.string().trim().min(1).max(64).nullable().optional(),

    status: statusSchema.optional(),

    // note：選填的操作備註（寫入 audit metadata 用）
    note: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.role !== undefined ||
      value.org_unit !== undefined ||
      value.status !== undefined,
    {
      message: 'At least one field must be provided to update user',
    },
  );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * US-010：使用者 CSV 匯入
 *
 * 端點：POST /api/v1/orgs/:orgId/users/import
 *
 * 設計重點（MVP）：
 * - 沒有 auth，因此匯入必須帶 actor_user_id，後端驗證 admin/librarian（避免名冊資料裸奔）
 * - 匯入提供兩個 mode：
 *   - preview：回傳「新增/更新/不變/將停用」的預估與錯誤列出（不寫 DB）
 *   - apply：實際寫入 DB，並寫入 audit_events（可追溯）
 *
 * CSV 內容規範（在 docs 會更完整說明）：
 * - header 必須包含 external_id 與 name
 * - role 可以在 CSV 提供，或由 default_role 補上（常見：整份檔都是學生）
 * - deactivate_missing 可選：把「未出現在 CSV 的學生/教師」批次停用（每學期最常用）
 */

// 匯入只涵蓋「名冊」角色：student/teacher
// - staff（admin/librarian）通常由館員手動建立，避免名冊匯入誤設權限
const importRosterRoleSchema = z.enum(['student', 'teacher']);

export const importUsersCsvSchema = z.object({
  // actor_user_id：執行匯入的館員/管理者（寫 audit_events 的 actor）
  actor_user_id: uuidSchema,

  // mode：preview / apply
  mode: z.enum(['preview', 'apply']),

  // csv_text：CSV 文字內容（由前端讀檔後送出）
  // - 這裡做一個上限避免誤傳極大檔案（MVP：5MB）
  csv_text: z.string().min(1).max(5_000_000),

  // default_role：當 CSV 沒有 role 欄位，或某列 role 為空時使用（常見：整份檔都是學生）
  default_role: importRosterRoleSchema.optional(),

  // deactivate_missing：是否要停用「未出現在 CSV」的使用者（通常是畢業/轉出）
  // - 這是 roster sync 的常見需求；若開啟，後端會把 CSV 視為「來源清單」
  deactivate_missing: z.boolean().optional(),

  // deactivate_missing_roles：要套用停用的角色範圍（預設只處理 student，較安全）
  deactivate_missing_roles: z.array(importRosterRoleSchema).min(1).max(2).optional(),

  // source_filename：前端可帶入檔名，方便 audit event 追溯（不必填）
  source_filename: z.string().trim().min(1).max(200).optional(),

  // source_note：操作備註（例如「113-1 學期名冊」）（不必填）
  source_note: z.string().trim().min(1).max(200).optional(),
});

export type ImportUsersCsvInput = z.infer<typeof importUsersCsvSchema>;

// 讓 service 型別可以重用（不需要每個檔案都重新宣告 union）
export type UserRole = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof statusSchema>;
