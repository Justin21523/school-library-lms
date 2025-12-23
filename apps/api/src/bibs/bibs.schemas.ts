/**
 * Bibs Schemas（Zod）
 *
 * 這裡定義書目（bibliographic_records）的建立/更新驗證規則。
 * - 建立：欄位完整度會更高（至少要有 title）
 * - 更新：允許部分欄位修改，也允許用 null 清空可選欄位
 */

import { z } from 'zod';

// 共用：人名/主題詞等短字串的基本限制（避免空白與過長）。
const shortText = z.string().trim().min(1).max(200);

// 共用：作者/貢獻者/主題詞的陣列（MVP 先用 text[] 簡化多對多）。
const textArray = z.array(shortText).max(50);

// ISBN：先允許數字與破折號；更完整的 ISBN-10/13 checksum 可等擴充再做。
const isbnSchema = z
  .string()
  .trim()
  .min(10)
  .max(20)
  .regex(/^[0-9-]+$/, 'isbn must contain digits or hyphens only');

export const createBibliographicSchema = z.object({
  // title：題名是必填（MVP 的最小可用欄位）。
  title: z.string().trim().min(1).max(500),

  // creators/contributors：用陣列簡化多對多（未來可拆成 junction table）。
  creators: textArray.optional(),
  contributors: textArray.optional(),

  // publisher：出版者（可選）。
  publisher: z.string().trim().min(1).max(200).optional(),

  // published_year：出版年（只收整數）。
  published_year: z.number().int().min(1400).max(2100).optional(),

  // language：建議 ISO 639-1/2 代碼，先寬鬆處理。
  language: z.string().trim().min(1).max(16).optional(),

  // subjects：主題詞（可用於 OPAC 檢索）。
  subjects: textArray.optional(),

  // isbn/classification：常見檢索欄位（可選）。
  isbn: isbnSchema.optional(),
  classification: z.string().trim().min(1).max(64).optional(),
});

export type CreateBibliographicInput = z.infer<typeof createBibliographicSchema>;

export const updateBibliographicSchema = z.object({
  // 更新時允許部分欄位，並允許用 null 清空。
  title: z.string().trim().min(1).max(500).optional(),

  creators: textArray.nullable().optional(),
  contributors: textArray.nullable().optional(),
  publisher: z.string().trim().min(1).max(200).nullable().optional(),
  published_year: z.number().int().min(1400).max(2100).nullable().optional(),
  language: z.string().trim().min(1).max(16).nullable().optional(),
  subjects: textArray.nullable().optional(),
  isbn: isbnSchema.nullable().optional(),
  classification: z.string().trim().min(1).max(64).nullable().optional(),
});

export type UpdateBibliographicInput = z.infer<typeof updateBibliographicSchema>;
