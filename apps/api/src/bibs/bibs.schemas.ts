/**
 * Bibs Schemas（Zod）
 *
 * 這裡定義書目（bibliographic_records）的建立/更新驗證規則。
 * - 建立：欄位完整度會更高（至少要有 title）
 * - 更新：允許部分欄位修改，也允許用 null 清空可選欄位
 */

import { z } from 'zod';

import { getMarc21FieldSpec, validateMarcFieldWithDictionary } from '../common/marc21';

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

// UUID：多個端點會共用（import/maintenance 等）。
const uuidSchema = z.string().uuid();

// ----------------------------
// list bibs query（支援大量資料的 cursor pagination）
// ----------------------------

// list 的 isbn filter：允許較短輸入（例如先貼上部分 ISBN），但後端目前仍採「精確比對」
// - create/update 仍用 isbnSchema（至少 10 碼），確保資料品質
const isbnFilterSchema = z.string().trim().min(1).max(20).regex(/^[0-9-]+$/);

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

/**
 * list bibs query
 *
 * 注意：
 * - 為了讓 scale seed（大量書目）可用，我們採用 cursor pagination（keyset）
 * - cursor 由 API 回傳（next_cursor），前端在「載入更多」時帶回來即可續查
 */
export const listBibsQuerySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  // subjects_any：用於 thesaurus expand 後的「主題詞擴充查詢」
  // - 前端會把 labels[] 用逗號串起來丟進 query string（例如：subjects_any=汰舊,報廢,除籍）
  // - 後端會用 `subjects && $labels::text[]` 做 overlap 查詢（建議搭配 GIN index）
  subjects_any: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(z.string().trim().min(1).max(200)).min(1).max(200))
    .optional(),
  // subject_term_ids_any：term_id-driven 的主題詞擴充查詢（authority linking v1）
  // - 前端會把 UUID[] 用逗號串起來丟進 query string（例如：subject_term_ids_any=uuid1,uuid2,...）
  // - 後端會用 `EXISTS (SELECT 1 FROM bibliographic_subject_terms ...)` 做過濾（建議搭配索引）
  subject_term_ids_any: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(uuidSchema).min(1).max(500))
    .optional(),
  // subject_term_ids：alias（同 subject_term_ids_any；讓 query 參數更直覺）
  // - 行為：ANY（任一命中）過濾
  // - 支援逗號分隔 UUID（例如：subject_term_ids=uuid1,uuid2,...）
  subject_term_ids: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(uuidSchema).min(1).max(500))
    .optional(),
  // geographics_any：MARC 651 的「地理名稱」擴充查詢（labels[]；用逗號串起來送出）
  // - 後端會用 `geographics && $labels::text[]` 做 overlap 查詢（建議搭配 GIN index）
  geographics_any: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(z.string().trim().min(1).max(200)).min(1).max(200))
    .optional(),
  // geographic_term_ids_any：term_id-driven 的「地理名稱」過濾（authority linking v1.3）
  // - 前端會把 UUID[] 用逗號串起來丟進 query string（例如：geographic_term_ids_any=uuid1,uuid2,...）
  // - 後端會用 `EXISTS (SELECT 1 FROM bibliographic_geographic_terms ...)` 做過濾（建議搭配索引）
  geographic_term_ids_any: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(uuidSchema).min(1).max(500))
    .optional(),
  // geographic_term_ids：alias（同 geographic_term_ids_any）
  geographic_term_ids: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(uuidSchema).min(1).max(500))
    .optional(),
  // genres_any：MARC 655 的「類型/體裁」擴充查詢（labels[]；用逗號串起來送出）
  genres_any: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(z.string().trim().min(1).max(200)).min(1).max(200))
    .optional(),
  // genre_term_ids_any：term_id-driven 的「類型/體裁」過濾（authority linking v1.3）
  genre_term_ids_any: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(uuidSchema).min(1).max(500))
    .optional(),
  // genre_term_ids：alias（同 genre_term_ids_any）
  genre_term_ids: z
    .preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }, z.array(uuidSchema).min(1).max(500))
    .optional(),
  isbn: isbnFilterSchema.optional(),
  classification: z.string().trim().min(1).max(64).optional(),
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
}).superRefine((value, ctx) => {
  // alias 防呆：若同時提供 *_any 與不帶 _any 的 alias，必須一致，避免前端誤送造成難以 debug。
  const assertSame = (a: string[] | undefined, b: string[] | undefined, field: string) => {
    if (!a || !b) return;
    const setA = new Set(a);
    const setB = new Set(b);
    if (setA.size !== setB.size) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Conflicting filters: ${field} vs ${field}_any`, path: [field] });
      return;
    }
    for (const id of setA) {
      if (!setB.has(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Conflicting filters: ${field} vs ${field}_any`, path: [field] });
        return;
      }
    }
  };

  assertSame(value.subject_term_ids, value.subject_term_ids_any, 'subject_term_ids');
  assertSame(value.geographic_term_ids, value.geographic_term_ids_any, 'geographic_term_ids');
  assertSame(value.genre_term_ids, value.genre_term_ids_any, 'genre_term_ids');
});

export type ListBibsQuery = z.infer<typeof listBibsQuerySchema>;

// ----------------------------
// MARC export（進階編目：交換格式）
// ----------------------------

/**
 * Bib MARC export query
 *
 * GET /api/v1/orgs/:orgId/bibs/:bibId/marc?format=json|xml|mrc
 *
 * 設計：
 * - format 預設 json（便於 API client 直接 parse）
 * - xml/mrc 用於「下載檔案」或與其他系統交換
 */
export const bibMarcFormatSchema = z.enum(['json', 'xml', 'mrc']);

export const getBibMarcQuerySchema = z.object({
  format: bibMarcFormatSchema.optional(),
});

export type GetBibMarcQuery = z.infer<typeof getBibMarcQuerySchema>;

/**
 * marc_extras schema（JSONB）
 *
 * 這是「表單欄位以外」的 MARC 欄位儲存區：
 * - 由匯入器/編輯器寫入
 * - 由匯出器讀出並 append 到 core MARC fields
 *
 * 為何用「結構化 JSON」而不是直接存 .mrc？
 * - JSON 更容易版本演進與差異比對（diff）
 * - 匯出時仍可序列化成 MARCXML / ISO2709（.mrc）
 *
 * 注意：
 * - 這裡的 schema 先做「最小但嚴格」的型別保護，避免髒資料進 DB
 * - 若未來需要支援更多屬性（例如 $0 URI、$2 vocabulary、指標規則），可以擴充 schema
 */
const marcTagSchema = z
  .string()
  .regex(/^[0-9]{3}$/, 'tag must be a 3-digit string')
  // 000 是 leader，不是 field tag（避免把 leader 以 tag=000 混進 marc_extras）
  .refine((tag) => tag !== '000', 'tag 000 is reserved for leader');
const marcIndicatorSchema = z.string().max(1); // 允許空字串代表空白指標

const marcSubfieldSchema = z
  .object({
    code: z.string().trim().length(1),
    value: z.string(),
  })
  .strict();

const marcControlFieldSchema = z
  .object({
    tag: marcTagSchema,
    value: z.string(),
  })
  .strict();

const marcDataFieldSchema = z
  .object({
    tag: marcTagSchema,
    ind1: marcIndicatorSchema,
    ind2: marcIndicatorSchema,
    subfields: z.array(marcSubfieldSchema).min(1).max(200),
  })
  .strict();

export const marcFieldSchema = z.union([marcControlFieldSchema, marcDataFieldSchema]).superRefine((field, ctx) => {
  // 欄位級驗證（常用 MARC21 字典）：
  // - 指標值合法性
  // - 子欄位 code / required / repeatable / value 格式
  // - 00X control/data 形狀約束
  // - 禁止 001/005（系統管理）
  for (const issue of validateMarcFieldWithDictionary(field as any)) {
    if (issue.level !== 'error') continue;
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: issue.path });
  }
});
export const marcExtrasSchema = z
  .array(marcFieldSchema)
  .max(2000)
  .superRefine((fields, ctx) => {
    // repeatable=false（字典級）：同 tag 在 marc_extras 內不可重複
    const indexesByTag = new Map<string, number[]>();
    fields.forEach((f: any, idx: number) => {
      const tag = String(f?.tag ?? '').trim();
      if (!tag) return;
      const arr = indexesByTag.get(tag);
      if (arr) arr.push(idx);
      else indexesByTag.set(tag, [idx]);
    });

    for (const [tag, idxs] of indexesByTag.entries()) {
      const spec = getMarc21FieldSpec(tag);
      if (!spec) continue;
      if (spec.repeatable !== false) continue;
      if (idxs.length <= 1) continue;

      for (const dupIndex of idxs.slice(1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `tag ${tag} is not repeatable (repeatable=false)`,
          path: [dupIndex, 'tag'],
        });
      }
    }
  });

export const updateMarcExtrasSchema = z.object({
  marc_extras: marcExtrasSchema,
});

export type UpdateMarcExtrasInput = z.infer<typeof updateMarcExtrasSchema>;

export const createBibliographicSchema = z
  .object({
  // title：題名是必填（MVP 的最小可用欄位）。
  title: z.string().trim().min(1).max(500),

  // creators/contributors：顯示/相容用（text[]）
  // - v1 開始支援 term_id-driven（creator_term_ids / contributor_term_ids）
  // - 後端會在寫入時把這兩欄正規化成 authority_terms.preferred_label（避免拼法差異）
  creators: textArray.optional(),
  contributors: textArray.optional(),
  // creator_term_ids / contributor_term_ids：term_id-driven 的人名連結（name linking v1）
  // - 建議前端以此為準（多選/下拉選單）
  // - 為了向後相容，creators/contributors 仍可直接送字串；但同一欄不可同時提供（避免不一致）
  creator_term_ids: z.array(uuidSchema).max(50).optional(),
  contributor_term_ids: z.array(uuidSchema).max(50).optional(),

  // publisher：出版者（可選）。
  publisher: z.string().trim().min(1).max(200).optional(),

  // published_year：出版年（只收整數）。
  published_year: z.number().int().min(1400).max(2100).optional(),

  // language：建議 ISO 639-1/2 代碼，先寬鬆處理。
  language: z.string().trim().min(1).max(16).optional(),

  // subjects：主題詞（可用於 OPAC 檢索）。
  subjects: textArray.optional(),
  // subject_term_ids：term_id-driven 的主題詞連結（authority linking v1）
  // - 建議前端以此為準（多選/下拉選單），後端會據此正規化 subjects（寫入 preferred_label）
  // - 為了向後相容，subjects 仍可直接送字串；但兩者不可同時提供（避免不一致）
  subject_term_ids: z.array(uuidSchema).max(50).optional(),

  // geographics：地理名稱（MARC 651）
  // - v1.3 起新增：term_id-driven（geographic_term_ids）
  // - 向後相容：仍允許直接送字串；但兩者不可同時提供
  geographics: textArray.optional(),
  geographic_term_ids: z.array(uuidSchema).max(50).optional(),

  // genres：類型/體裁（MARC 655）
  // - v1.3 起新增：term_id-driven（genre_term_ids）
  // - 向後相容：仍允許直接送字串；但兩者不可同時提供
  genres: textArray.optional(),
  genre_term_ids: z.array(uuidSchema).max(50).optional(),

  // isbn/classification：常見檢索欄位（可選）。
  isbn: isbnSchema.optional(),
  classification: z.string().trim().min(1).max(64).optional(),
})
  .superRefine((value, ctx) => {
    if (value.creators !== undefined && value.creator_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either creators or creator_term_ids, not both',
        path: ['creator_term_ids'],
      });
    }
    if (value.contributors !== undefined && value.contributor_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either contributors or contributor_term_ids, not both',
        path: ['contributor_term_ids'],
      });
    }
    if (value.subjects !== undefined && value.subject_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either subjects or subject_term_ids, not both',
        path: ['subject_term_ids'],
      });
    }
    if (value.geographics !== undefined && value.geographic_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either geographics or geographic_term_ids, not both',
        path: ['geographic_term_ids'],
      });
    }
    if (value.genres !== undefined && value.genre_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either genres or genre_term_ids, not both',
        path: ['genre_term_ids'],
      });
    }
  });

export type CreateBibliographicInput = z.infer<typeof createBibliographicSchema>;

export const updateBibliographicSchema = z
  .object({
  // 更新時允許部分欄位，並允許用 null 清空。
  title: z.string().trim().min(1).max(500).optional(),

  creators: textArray.nullable().optional(),
  contributors: textArray.nullable().optional(),
  creator_term_ids: z.array(uuidSchema).max(50).nullable().optional(),
  contributor_term_ids: z.array(uuidSchema).max(50).nullable().optional(),
  publisher: z.string().trim().min(1).max(200).nullable().optional(),
  published_year: z.number().int().min(1400).max(2100).nullable().optional(),
  language: z.string().trim().min(1).max(16).nullable().optional(),
  subjects: textArray.nullable().optional(),
  subject_term_ids: z.array(uuidSchema).max(50).nullable().optional(),
  geographics: textArray.nullable().optional(),
  geographic_term_ids: z.array(uuidSchema).max(50).nullable().optional(),
  genres: textArray.nullable().optional(),
  genre_term_ids: z.array(uuidSchema).max(50).nullable().optional(),
  isbn: isbnSchema.nullable().optional(),
  classification: z.string().trim().min(1).max(64).nullable().optional(),
})
  .superRefine((value, ctx) => {
    if (value.creators !== undefined && value.creator_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either creators or creator_term_ids, not both',
        path: ['creator_term_ids'],
      });
    }
    if (value.contributors !== undefined && value.contributor_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either contributors or contributor_term_ids, not both',
        path: ['contributor_term_ids'],
      });
    }
    if (value.subjects !== undefined && value.subject_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either subjects or subject_term_ids, not both',
        path: ['subject_term_ids'],
      });
    }
    if (value.geographics !== undefined && value.geographic_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either geographics or geographic_term_ids, not both',
        path: ['geographic_term_ids'],
      });
    }
    if (value.genres !== undefined && value.genre_term_ids !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either genres or genre_term_ids, not both',
        path: ['genre_term_ids'],
      });
    }
  });

export type UpdateBibliographicInput = z.infer<typeof updateBibliographicSchema>;

// ----------------------------
// Maintenance：subjects backfill（既有資料 → authority linking）
// ----------------------------

/**
 * backfill-bib-subject-terms
 *
 * 你要的「既有資料 backfill」工具：
 * - 目標：把 bibliographic_records.subjects（text[]）轉成 term_id-driven 的 links
 *   - match preferred_label / variant_labels
 *   - missing/ambiguous → 建/補 local term（讓後續可治理/merge）
 *   - 填滿 bibliographic_subject_terms（保留順序 position）
 * - 輸出報表：auto_created / ambiguous / unmatched（供人工覆核）
 *
 * 設計：沿用本專案既有 maintenance endpoint 模式（preview/apply）
 * - preview：在 transaction 內跑「真實寫入」，最後 ROLLBACK（確保結果可重現且 DB 不變）
 * - apply：COMMIT + 寫 audit_events（方便追溯）
 */
export const bibSubjectBackfillModeSchema = z.enum(['preview', 'apply']);

export const backfillBibSubjectTermsSchema = z.object({
  actor_user_id: uuidSchema,
  mode: bibSubjectBackfillModeSchema,

  // limit/cursor：避免一次掃太多造成長時間鎖；用 keyset cursor 逐批處理
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),

  // only_missing：預設只處理「link table 目前為空」的書目（migration 常用）
  // - 若要重建全部 links（例如調整 mapping 規則後重跑）可設為 false
  only_missing: z.boolean().optional(),

  // 新增 local term 的預設屬性（可用於追溯/治理）
  vocabulary_code_for_new: z.string().trim().min(1).max(64).optional(),
  source_for_new: z.string().trim().min(1).max(64).optional(),

  // prefer_vocabulary_codes：當 label 同時命中多套 vocabulary 時，可用此順序嘗試消歧（選填）
  prefer_vocabulary_codes: z.array(z.string().trim().min(1).max(64)).max(20).optional(),

  // note：操作備註（寫入 audit metadata；選填）
  note: z.string().trim().min(1).max(200).optional(),
});

export type BackfillBibSubjectTermsInput = z.infer<typeof backfillBibSubjectTermsSchema>;

// ----------------------------
// Maintenance：geographics/genres backfill（既有資料 → authority linking v1.3）
// ----------------------------

/**
 * backfill-bib-geographic-terms
 *
 * 把既有資料的「地理名稱」（MARC 651）回填成 term_id-driven：
 * - 來源（優先順序）：
 *   1) bibliographic_records.geographics（若已存在）
 *   2) bibliographic_records.marc_extras 的 651$a（若 geographics 為空；用於 migration）
 * - 行為比照 subjects backfill：
 *   - match preferred_label / variant_labels
 *   - missing/ambiguous → 建/補 local term
 *   - 填 bibliographic_geographic_terms（保序 position）
 *   - 回寫 geographics 正規化（preferred_label）
 */
export const backfillBibGeographicTermsSchema = backfillBibSubjectTermsSchema;
export type BackfillBibGeographicTermsInput = z.infer<typeof backfillBibGeographicTermsSchema>;

/**
 * backfill-bib-genre-terms
 *
 * 把既有資料的「類型/體裁」（MARC 655）回填成 term_id-driven：
 * - 來源（優先順序）：
 *   1) bibliographic_records.genres
 *   2) bibliographic_records.marc_extras 的 655$a
 * - 行為比照 subjects backfill（preview/apply + 報表）
 */
export const backfillBibGenreTermsSchema = backfillBibSubjectTermsSchema;
export type BackfillBibGenreTermsInput = z.infer<typeof backfillBibGenreTermsSchema>;

// ----------------------------
// Maintenance：names backfill（既有 creators/contributors → name linking v1）
// ----------------------------

/**
 * backfill-bib-name-terms
 *
 * 你在「第 4 步」提出的人名 term-based，除了新資料要走 `creator_term_ids`/`contributor_term_ids` 外，
 * 既有資料也需要一個「按 org 批次」的回填工具，才能把：
 * - bibliographic_records.creators/contributors（text[]）
 * 轉成：
 * - bibliographic_name_terms（role=creator|contributor + position）
 *
 * 本輪先把 input schema 與 subjects backfill 對齊（同一套 preview/apply + cursor/limit + 報表模式），
 * 讓操作習慣一致。
 */
export const backfillBibNameTermsSchema = backfillBibSubjectTermsSchema;
export type BackfillBibNameTermsInput = z.infer<typeof backfillBibNameTermsSchema>;

// ----------------------------
// MARC Batch Import（preview/apply；去重 ISBN/035）
// ----------------------------

/**
 * MARC batch import
 *
 * POST /api/v1/orgs/:orgId/bibs/import-marc
 *
 * 需求（你列出的「尚未完成」）：
 * - 多筆 record preview/apply
 * - 去重：ISBN（020）/ 035
 * - 選擇 create vs update（可 per record override）
 * - 錯誤報表（preview 回傳 errors；apply 若有 errors 就拒絕寫入）
 *
 * 注意：
 * - 本端點假設「前端已把 MARC 檔解析成 bib + marc_extras」
 * - 若未來要支援 server-side 解析（避免瀏覽器解析大檔），可再新增 multipart/upload 流程
 */

export const marcImportModeSchema = z.enum(['preview', 'apply']);
export type MarcImportMode = z.infer<typeof marcImportModeSchema>;

export const marcImportDecisionSchema = z.enum(['create', 'update', 'skip']);
export type MarcImportDecision = z.infer<typeof marcImportDecisionSchema>;

export const importMarcRecordSchema = z.object({
  // bib：表單欄位（可治理真相來源）
  bib: createBibliographicSchema,

  // marc_extras：保留未做成表單的 MARC 欄位（含 245/264/650/700 的進階子欄位）
  marc_extras: marcExtrasSchema.optional(),
});

export type ImportMarcRecordInput = z.infer<typeof importMarcRecordSchema>;

export const importMarcBatchSchema = z.object({
  actor_user_id: uuidSchema,
  mode: marcImportModeSchema,

  // records：限制數量避免單次 request 過大；真的要匯入上千筆可用分批或後續做 server-side import
  records: z.array(importMarcRecordSchema).min(1).max(500),

  options: z
    .object({
      // 是否寫入 marc_extras（預設 true）
      save_marc_extras: z.boolean().optional(),

      // 是否補齊 authority_terms（預設 false；避免匯入就把 vocab 洗爆）
      upsert_authority_terms: z.boolean().optional(),

      // 補齊 authority_terms 時使用的 vocabulary_code（預設 local）
      authority_vocabulary_code: z.string().trim().min(1).max(64).optional(),
    })
    .optional(),

  // decisions：apply 時可 per record 覆蓋（preview 可不送）
  decisions: z
    .array(
      z.object({
        index: z.number().int().min(0),
        decision: marcImportDecisionSchema,
        target_bib_id: uuidSchema.optional(),
      }),
    )
    .optional(),

  // source info：寫入 audit metadata（選填）
  source_filename: z.string().trim().min(1).max(200).optional(),
  source_note: z.string().trim().min(1).max(200).optional(),
});

export type ImportMarcBatchInput = z.infer<typeof importMarcBatchSchema>;

// ----------------------------
// US-022：Catalog CSV Import（書目/冊 批次匯入）
// ----------------------------

/**
 * 這個匯入端點的設計沿用 US-010（users/import）的 preview/apply 模式：
 * - preview：不寫 DB，只回傳「會新增/更新什麼」與錯誤（列號/原因）
 * - apply：只有在無錯誤時才允許寫入，並寫 audit_events 方便追溯
 *
 * 注意：
 * - 這是「高風險批次寫入」：可能一次改上千筆 item/bib
 * - 因此必須要求 actor_user_id（staff）並在 service 做 RBAC + audit
 */

// import mode：preview/apply
export const catalogImportModeSchema = z.enum(['preview', 'apply']);

export const importCatalogCsvSchema = z.object({
  actor_user_id: uuidSchema,
  mode: catalogImportModeSchema,

  // csv_text：限制 5MB（避免誤貼巨大檔）
  csv_text: z.string().min(1).max(5_000_000),

  // default_location_id：當 CSV 沒有 location 欄位時，可用這個作為預設（選填）
  default_location_id: uuidSchema.optional(),

  // update_existing_items：若 barcode 已存在，是否允許更新（預設 true）
  update_existing_items: z.boolean().optional(),

  // allow_relink_bibliographic：是否允許「同 barcode 重新指到不同書目」（風險較高，預設 false）
  allow_relink_bibliographic: z.boolean().optional(),

  // source info：寫入 audit metadata（選填）
  source_filename: z.string().trim().min(1).max(200).optional(),
  source_note: z.string().trim().min(1).max(200).optional(),
});

export type CatalogCsvImportMode = z.infer<typeof catalogImportModeSchema>;
export type ImportCatalogCsvInput = z.infer<typeof importCatalogCsvSchema>;
