/**
 * Authority Schemas（Zod）
 *
 * Authority / Vocabulary 的角色是「可治理的 controlled vocab 主檔」：
 * - name：姓名款目（作者/貢獻者；後續可再細分個人名/團體名）
 * - subject：主題詞（thesaurus；支援 BT/NT/RT 與 expand）
 * - geographic：地理名稱（MARC 651）
 * - genre：類型/體裁（MARC 655）
 * - language：語言代碼/語言名稱（MARC 041；本輪先把 kind 打開，細規則在文件定死）
 * - relator：關係/角色代碼（MARC 700$e/$4；本輪先以前端 datalist 提示，DB/治理先預留）
 *
 * 這一輪（v1）的範圍（刻意可控、可演進）：
 * - CRUD + 搜尋/建議（autocomplete）仍是基礎
 * - subjects / names 已升級成 term-based：
 *   - subjects：`bibliographic_subject_terms` + `subject_term_ids`
 *   - names：`bibliographic_name_terms` + `creator_term_ids`/`contributor_term_ids`
 * - 其他 kinds 先落地「主檔 + MARC linking 基礎」，後續再逐一把 UI/查詢/治理補齊
 */

import { z } from 'zod';

// kind：權威控制款目類型（controlled vocab 類別）
export const authorityTermKindSchema = z.enum(['name', 'subject', 'geographic', 'genre', 'language', 'relator']);
export type AuthorityTermKind = z.infer<typeof authorityTermKindSchema>;

// status：沿用 DB 的 active/inactive（與 locations/users 一致）
export const authorityTermStatusSchema = z.enum(['active', 'inactive']);
export type AuthorityTermStatus = z.infer<typeof authorityTermStatusSchema>;

// vocabulary_code：用於區分不同「詞彙庫」來源（local / builtin-zh / ...）
// - v0 先用簡單格式限制，避免空白/特殊字元讓查詢/URL/匯入變麻煩
const vocabularyCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-_]*$/i, 'vocabulary_code must be letters/numbers/_/-');

// label：款目文字（繁中/英文字都可；但不可空白且避免極端長度）
const labelSchema = z.string().trim().min(1).max(200);

// variant_labels：別名/同義詞（簡化版 UF/alt labels）
const variantLabelsSchema = z.array(labelSchema).max(50);

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

// ----------------------------
// list/search（管理頁用；支援 cursor pagination）
// ----------------------------

export const listAuthorityTermsQuerySchema = z.object({
  kind: authorityTermKindSchema,
  query: z.string().trim().min(1).max(200).optional(),
  vocabulary_code: vocabularyCodeSchema.optional(),
  // status：
  // - 不提供 → 預設只看 active
  // - all → 不過濾（管理頁會用）
  status: z.enum(['active', 'inactive', 'all']).optional(),
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});

export type ListAuthorityTermsQuery = z.infer<typeof listAuthorityTermsQuerySchema>;

// ----------------------------
// suggest（autocomplete；不做 cursor）
// ----------------------------

export const suggestAuthorityTermsQuerySchema = z.object({
  kind: authorityTermKindSchema,
  q: z.string().trim().min(1).max(200),
  vocabulary_code: vocabularyCodeSchema.optional(),
  limit: intFromStringSchema.optional(),
});

export type SuggestAuthorityTermsQuery = z.infer<typeof suggestAuthorityTermsQuerySchema>;

// ----------------------------
// create/update（CRUD）
// ----------------------------

export const createAuthorityTermSchema = z.object({
  kind: authorityTermKindSchema,
  preferred_label: labelSchema,
  vocabulary_code: vocabularyCodeSchema.optional(),
  variant_labels: variantLabelsSchema.optional(),
  note: z.string().trim().min(1).max(1000).optional(),
  status: authorityTermStatusSchema.optional(),
  // source：v0 先允許寫入（例如：local/builtin/seed-demo），但 UI 預設會用 local
  source: z.string().trim().min(1).max(64).optional(),
});

export type CreateAuthorityTermInput = z.infer<typeof createAuthorityTermSchema>;

export const updateAuthorityTermSchema = z
  .object({
    preferred_label: labelSchema.optional(),
    vocabulary_code: vocabularyCodeSchema.optional(),
    variant_labels: variantLabelsSchema.nullable().optional(),
    note: z.string().trim().min(1).max(1000).nullable().optional(),
    status: authorityTermStatusSchema.optional(),
    source: z.string().trim().min(1).max(64).optional(),
  })
  .refine(
    (value) =>
      value.preferred_label !== undefined ||
      value.vocabulary_code !== undefined ||
      value.variant_labels !== undefined ||
      value.note !== undefined ||
      value.status !== undefined ||
      value.source !== undefined,
    { message: 'At least one field must be provided to update authority term' },
  );

export type UpdateAuthorityTermInput = z.infer<typeof updateAuthorityTermSchema>;

// ----------------------------
// Thesaurus v1：BT/NT/RT relations + term expand
// ----------------------------

/**
 * Thesaurus v1（最小可行）
 *
 * 你要的「主題詞/控制詞彙」若要變成真正可用的 thesaurus，至少要有：
 * - UF/USE（同義/入口詞）：v1 先用 `variant_labels` 表達
 * - BT/NT（上下位）：v1 落地到 `authority_term_relations`（relation_type=broader）
 * - RT（相關詞）：v1 落地到 `authority_term_relations`（relation_type=related）
 *
 * 注意：
 * - 目前我們仍以「字串」存 bibliographic_records.subjects（text[]），尚未做到 id linking
 * - 但 thesaurus 的關係結構仍可先做出來，供：
 *   1) 館員瀏覽/治理（避免主題詞越長越亂）
 *   2) 檢索擴充（後續可在搜尋時自動展開 UF/NT/RT）
 */

export const thesaurusRelationKindSchema = z.enum(['broader', 'narrower', 'related']);
export type ThesaurusRelationKind = z.infer<typeof thesaurusRelationKindSchema>;

export const createThesaurusRelationSchema = z.object({
  // kind：以「目前 term」為視角（方便 UI）
  // - broader：新增 BT（本 term 的上位詞）
  // - narrower：新增 NT（本 term 的下位詞）
  // - related：新增 RT
  kind: thesaurusRelationKindSchema,
  target_term_id: z.string().uuid(),
});

export type CreateThesaurusRelationInput = z.infer<typeof createThesaurusRelationSchema>;

// expand：用於檢索擴充/自動補詞（同義、上下位、相關）
const expandIncludeItemSchema = z.enum(['self', 'variants', 'broader', 'narrower', 'related']);

const expandIncludeSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;

  // query string 可能是：
  // - include=self,variants,broader
  // - include=self&include=variants（重複 key）
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.split(',').map((x) => x.trim()).filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((v) => (typeof v === 'string' ? v.split(',') : [])).map((x) => x.trim()).filter(Boolean);
  }

  return value;
}, z.array(expandIncludeItemSchema).min(1).max(5));

export const expandThesaurusQuerySchema = z.object({
  include: expandIncludeSchema.optional(),
  depth: intFromStringSchema.optional(), // 0..500 會在 service 再 clamp（v1 只允許到 5）
});

export type ExpandThesaurusQuery = z.infer<typeof expandThesaurusQuerySchema>;

// ----------------------------
// Thesaurus v1.1：hierarchy browsing（roots / children / ancestors / graph）
// ----------------------------

/**
 * 你希望支援「幾萬 terms」+ polyhierarchy（多個 BT）。
 *
 * 對 UI 來說，正確做法不是一次把整棵樹拉回來，而是：
 * - roots（Top terms）當入口
 * - children 逐步 lazy-load（展開到哪載到哪）
 * - ancestors 提供 breadcrumb（多條 path）
 * - graph/subtree 提供除錯/可視化（depth-limited，且必須可限制輸出量）
 */

// roots：Top terms（沒有 BT 的 term）
export const listThesaurusRootsQuerySchema = z.object({
  // v1.1：最早只聚焦 subject；v1.4 起擴充到 651/655 對應的 vocab kinds（讓編目 UI 也能用樹狀瀏覽）
  // - subject：MARC 650
  // - geographic：MARC 651
  // - genre：MARC 655
  //
  // name 款目仍不建議做 BT/NT（多數館藏系統以 authority record / see also 為主），因此不納入 roots API。
  kind: z.enum(['subject', 'geographic', 'genre']),
  vocabulary_code: vocabularyCodeSchema,
  status: z.enum(['active', 'inactive', 'all']).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});
export type ListThesaurusRootsQuery = z.infer<typeof listThesaurusRootsQuerySchema>;

// children：直接 NT（parent = current term；child = narrower term）
export const listThesaurusChildrenQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).optional(),
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});
export type ListThesaurusChildrenQuery = z.infer<typeof listThesaurusChildrenQuerySchema>;

// ancestors：breadcrumb（polyhierarchy 會有多條 path）
export const thesaurusAncestorsQuerySchema = z.object({
  // depth：最大往上追幾層（避免深到爆）
  depth: intFromStringSchema.optional(),
  // max_paths：最多回傳幾條 breadcrumb path（polyhierarchy 可能爆炸）
  max_paths: intFromStringSchema.optional(),
});
export type ThesaurusAncestorsQuery = z.infer<typeof thesaurusAncestorsQuerySchema>;

// graph：depth-limited nodes + edges（for visualization / QA）
export const thesaurusGraphQuerySchema = z.object({
  direction: z.enum(['narrower', 'broader']).optional(),
  depth: intFromStringSchema.optional(),
  max_nodes: intFromStringSchema.optional(),
  max_edges: intFromStringSchema.optional(),
});
export type ThesaurusGraphQuery = z.infer<typeof thesaurusGraphQuerySchema>;

// ----------------------------
// Thesaurus governance：quality reports + relations CSV import/export
// ----------------------------

export const thesaurusQualityQuerySchema = z.object({
  kind: z.enum(['subject', 'geographic', 'genre']),
  vocabulary_code: vocabularyCodeSchema,
  status: z.enum(['active', 'inactive', 'all']).optional(),
  type: z.enum(['orphans', 'multi_broader', 'unused_with_relations']),
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});
export type ThesaurusQualityQuery = z.infer<typeof thesaurusQualityQuerySchema>;

export const exportThesaurusRelationsQuerySchema = z.object({
  kind: z.enum(['subject', 'geographic', 'genre']),
  vocabulary_code: vocabularyCodeSchema,
});
export type ExportThesaurusRelationsQuery = z.infer<typeof exportThesaurusRelationsQuerySchema>;

export const importThesaurusRelationsSchema = z.object({
  kind: z.enum(['subject', 'geographic', 'genre']),
  vocabulary_code: vocabularyCodeSchema,
  mode: z.enum(['preview', 'apply']),
  // csv_text：限制 20MB（relations 可能比 roster 大；但仍要避免誤貼超大檔）
  csv_text: z.string().min(1).max(20_000_000),
});
export type ImportThesaurusRelationsInput = z.infer<typeof importThesaurusRelationsSchema>;

// ----------------------------
// Authority governance：usage + merge/redirect（term 治理）
// ----------------------------

/**
 * usage：某個 authority term 被哪些 bib 使用（用於治理）
 *
 * GET /api/v1/orgs/:orgId/authority-terms/:termId/usage?limit=&cursor=
 *
 * v1.3+：針對「已落地 junction table」的 kinds 提供 usage：
 * - subject：bibliographic_subject_terms
 * - name：bibliographic_name_terms
 * - geographic：bibliographic_geographic_terms
 * - genre：bibliographic_genre_terms
 */
export const authorityTermUsageQuerySchema = z.object({
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});
export type AuthorityTermUsageQuery = z.infer<typeof authorityTermUsageQuerySchema>;

/**
 * merge/redirect：把一個 term 併入另一個 term（治理）
 *
 * POST /api/v1/orgs/:orgId/authority-terms/:termId/merge
 *
 * 設計：
 * - preview/apply（降低誤操作）
 * - merge 會：
 *   - 批次更新 junction table（v1.3+：subject/name/geographic/genre）
 *   - 把舊詞（preferred + variants）收進 target.variant_labels
 *   - 搬移/合併 thesaurus relations（同 vocabulary_code 才能搬；避免跨詞彙庫亂連）
 *   - 可選：停用 source term（保留 row 便於追溯）
 */
export const authorityTermMergeModeSchema = z.enum(['preview', 'apply']);

export const mergeAuthorityTermSchema = z.object({
  actor_user_id: z.string().uuid(),
  mode: authorityTermMergeModeSchema,
  target_term_id: z.string().uuid(),

  // options（都可選；預設採「保守但有用」）
  deactivate_source_term: z.boolean().optional(),
  merge_variant_labels: z.boolean().optional(),
  move_relations: z.boolean().optional(),

  // note：操作備註（會寫 audit metadata；選填）
  note: z.string().trim().min(1).max(200).optional(),
});

export type MergeAuthorityTermInput = z.infer<typeof mergeAuthorityTermSchema>;
