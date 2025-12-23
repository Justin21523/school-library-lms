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
