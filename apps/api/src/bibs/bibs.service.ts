/**
 * BibsService
 *
 * 書目（bibliographic_records）的資料存取與搜尋邏輯。
 * - list：基本搜尋 + 回傳可借冊數量
 * - create：新增書目
 * - getById：取得單一書目（含可借冊數）
 * - update：部分更新書目
 *
 * 另：US-022（Catalog CSV Import）
 * - 書目/冊的批次匯入（preview/apply + audit）
 * - 這是學校導入時「一次性建檔」最省力的做法
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import type { AuthorityTermKind } from '../authority/authority.schemas';
import { decodeCursorV1, encodeCursorV1, normalizeSortToIso, type CursorPage } from '../common/cursor';
import { parseCsv } from '../common/csv';
import {
  buildMarcRecordFromBibliographic,
  isMarcDataField,
  sanitizeMarcExtras,
  type BibliographicForMarc,
  type MarcField,
  type MarcRecord,
} from '../common/marc';
import { DbService } from '../db/db.service';
import type {
  BackfillBibGeographicTermsInput,
  BackfillBibGenreTermsInput,
  BackfillBibNameTermsInput,
  BackfillBibSubjectTermsInput,
  CatalogCsvImportMode,
  CreateBibliographicInput,
  ImportCatalogCsvInput,
  ImportMarcBatchInput,
  ListBibsQuery,
  UpdateBibliographicInput,
} from './bibs.schemas';

// BibliographicRow：對應 bibliographic_records 的欄位。
type BibliographicRow = {
  id: string;
  organization_id: string;
  title: string;
  creators: string[] | null;
  contributors: string[] | null;
  publisher: string | null;
  published_year: number | null;
  language: string | null;
  subjects: string[] | null;
  geographics: string[] | null;
  genres: string[] | null;
  isbn: string | null;
  classification: string | null;
  created_at: string;
  updated_at: string;
};

// 有些 API 需要「書目 + 可借數量」。
type BibliographicWithCountsRow = BibliographicRow & {
  total_items: number;
  available_items: number;
};

type BibliographicWithCountsAndSubjectLinksRow = BibliographicWithCountsRow & {
  // subject_term_ids：term_id-driven 主題詞連結（編目 UI 應以此為真相來源）
  subject_term_ids: string[];
  // subject_terms：給 UI 顯示用（避免 UI 需要額外打 N 次 authority-terms/:id）
  subject_terms: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  // geographic_term_ids / geographic_terms：MARC 651（地理名稱）term-based（v1.3）
  geographic_term_ids: string[];
  geographic_terms: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  // genre_term_ids / genre_terms：MARC 655（類型/體裁）term-based（v1.3）
  genre_term_ids: string[];
  genre_terms: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  // creator_term_ids / contributor_term_ids：term_id-driven 人名連結（name linking v1）
  creator_term_ids: string[];
  creator_terms: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  contributor_term_ids: string[];
  contributor_terms: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
};

// BibSubjectTermRow：書目已連結的主題詞（term_id-driven；供編目 UI/MARC/export/治理使用）
type BibSubjectTermRow = {
  id: string;
  vocabulary_code: string;
  preferred_label: string;
  position: number;
};

// BibGeographicTermRow：書目已連結的地理名稱（MARC 651；term_id-driven）
type BibGeographicTermRow = {
  id: string;
  vocabulary_code: string;
  preferred_label: string;
  position: number;
};

// BibGenreTermRow：書目已連結的類型/體裁（MARC 655；term_id-driven）
type BibGenreTermRow = {
  id: string;
  vocabulary_code: string;
  preferred_label: string;
  position: number;
};

// BibNameTermRow：書目已連結的人名款目（creator/contributor；term_id-driven）
type BibNameTermRow = {
  id: string;
  vocabulary_code: string;
  preferred_label: string;
  position: number;
};

// AuthorityTermLookupRow：MARC extras 的 `$0=urn:uuid:<term_id>` 驗證時需要的最小欄位集
// - 只查我們會用到的欄位（id/kind/vocabulary_code/status），避免把整筆 term 拉太大
type AuthorityTermLookupRow = {
  id: string;
  kind: AuthorityTermKind;
  vocabulary_code: string;
  status: 'active' | 'inactive';
};

// MarcAuthorityLinkViolation：把「MARC 欄位 ↔ controlled vocab」的硬規則具體化成可回報的錯誤
// - 注意：這裡只針對我們系統自己的 `$0=urn:uuid:` 做檢查
//   - 若 `$0` 是外部 URI / control number（不是 urn:uuid），我們不介入（避免誤擋匯入資料）
type MarcAuthorityLinkViolation = {
  code: 'AUTHORITY_TERM_NOT_FOUND' | 'AUTHORITY_KIND_MISMATCH' | 'AUTHORITY_VOCAB_MISMATCH';
  message: string;
  details: {
    tag: string;
    field_index: number;
    subfield_index?: number;
    term_id?: string;
    expected_kind?: AuthorityTermKind;
    actual_kind?: AuthorityTermKind;
    expected_vocabulary_code?: string;
    actual_vocabulary_code?: string;
  };
};

// ----------------------------
// MARC Batch Import（preview/apply；去重 ISBN/035）
// ----------------------------

type MarcImportDecision = 'create' | 'update' | 'skip';

type MarcImportRecordError = {
  record_index: number;
  code: string;
  message: string;
  details?: unknown;
};

type MarcImportMatch = {
  by: 'isbn' | '035' | null;
  bib_id: string | null;
  bib_title: string | null;
  bib_isbn: string | null;
  matched_values: string[];
};

type MarcImportRecordPlan = {
  record_index: number;

  // input echo（讓前端能顯示 preview 表格；apply 也能用同一份 payload）
  bib: CreateBibliographicInput;
  marc_extras_count: number;

  // identifiers（去重用）
  isbn: string | null;
  identifiers_035: string[];

  match: MarcImportMatch;

  // suggested/decision（讓 UI 能呈現「建議」與「最後選擇」）
  suggested_decision: MarcImportDecision;
  decision: MarcImportDecision;
  target_bib_id: string | null;
};

type MarcImportSummary = {
  total_records: number;
  valid_records: number;
  invalid_records: number;
  to_create: number;
  to_update: number;
  to_skip: number;
  matched_by_isbn: number;
  matched_by_035: number;
};

export type MarcImportPreviewResult = {
  mode: 'preview';
  source: { records: number; sha256: string; source_filename: string | null };
  options: {
    save_marc_extras: boolean;
    upsert_authority_terms: boolean;
    authority_vocabulary_code: string;
  };
  summary: MarcImportSummary;
  warnings: MarcImportRecordError[];
  errors: MarcImportRecordError[];
  records: MarcImportRecordPlan[];
};

export type MarcImportApplyResult = {
  mode: 'apply';
  summary: MarcImportSummary;
  audit_event_id: string;
  results: Array<{ record_index: number; decision: MarcImportDecision; bib_id: string | null }>;
};

export type MarcImportResult = MarcImportPreviewResult | MarcImportApplyResult;

// ----------------------------
// US-022：Catalog CSV Import（書目/冊 批次匯入）
// ----------------------------

type UserRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
type UserStatus = 'active' | 'inactive';
type ItemStatus = 'available' | 'checked_out' | 'on_hold' | 'lost' | 'withdrawn' | 'repair';

const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

type ActorRow = { id: string; role: UserRole; status: UserStatus };

type ExistingItemByBarcodeRow = {
  id: string;
  barcode: string;
  bibliographic_id: string;
};

type LocationByCodeRow = { id: string; code: string };
type LocationByIdRow = { id: string };

type ExistingBibByIdRow = { id: string };
type ExistingBibByIsbnRow = { id: string; isbn: string };

type CatalogCanonicalColumn =
  | 'barcode'
  | 'call_number'
  | 'location_code'
  | 'location_id'
  | 'status'
  | 'acquired_at'
  | 'notes'
  | 'bibliographic_id'
  | 'title'
  | 'creators'
  | 'publisher'
  | 'published_year'
  | 'language'
  | 'subjects'
  | 'isbn'
  | 'classification';

type ImportRowError = {
  row_number: number;
  code: string;
  message: string;
  field?: CatalogCanonicalColumn | 'csv';
  details?: unknown;
};

type NormalizedRow = {
  row_number: number;

  // item
  barcode: string;
  call_number: string;
  location_id: string;
  status: ItemStatus;
  acquired_at: string | null;
  notes: string | null;

  // bib reference（用其中一種）
  bibliographic_id: string | null;
  isbn: string | null;

  // bib create fields（若需建立新書目）
  title: string | null;
  creators: string[] | null;
  publisher: string | null;
  published_year: number | null;
  language: string | null;
  subjects: string[] | null;
  classification: string | null;
};

type RowPlan = NormalizedRow & {
  // bib_action：這列對書目的處理方式
  // - use_existing：使用既有書目（由 bibliographic_id 或 isbn 找到）
  // - create_new：需建立新書目（會在 apply 階段一次建立）
  bib_action: 'use_existing' | 'create_new' | 'invalid';

  // bib_key：用來把多列對應到同一個「待建立書目」（避免同一本書建多次）
  // - 若 bib_action=use_existing，bib_key 會是 `id:<uuid>` 或 `isbn:<isbn>`
  // - 若 bib_action=create_new，bib_key 會是 `isbn:<isbn>` 或 `title:<hash>`
  bib_key: string;

  // item_action：這列對冊的處理方式
  item_action: 'create' | 'update' | 'invalid';
};

type ImportSummary = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;

  bibs_to_create: number;
  items_to_create: number;
  items_to_update: number;
};

export type CatalogCsvImportPreviewResult = {
  mode: 'preview';
  csv: { header: string[]; sha256: string };
  options: {
    default_location_id: string | null;
    update_existing_items: boolean;
    allow_relink_bibliographic: boolean;
  };
  summary: ImportSummary;
  errors: ImportRowError[];
  rows: RowPlan[];

  // bibs_to_create_preview：前 N 筆「將建立的書目」摘要（讓館員確認有沒有建太多）
  bibs_to_create_preview: Array<{ bib_key: string; title: string | null; isbn: string | null }>;
};

export type CatalogCsvImportApplyResult = {
  mode: 'apply';
  summary: ImportSummary;
  audit_event_id: string;
};

export type CatalogCsvImportResult = CatalogCsvImportPreviewResult | CatalogCsvImportApplyResult;

// ----------------------------
// Maintenance：subjects backfill（既有資料 → authority linking）
// ----------------------------

type BackfillSubjectLabelDecision =
  | {
      input_label: string;
      status: 'matched_preferred' | 'matched_variant';
      term: { id: string; vocabulary_code: string; preferred_label: string };
    }
  | {
      input_label: string;
      status: 'auto_created';
      term: { id: string; vocabulary_code: string; preferred_label: string };
    }
  | {
      input_label: string;
      status: 'ambiguous_auto_created';
      term: { id: string; vocabulary_code: string; preferred_label: string };
      candidates: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
    }
  | {
      input_label: string;
      status: 'skipped_blank' | 'unmatched';
      reason: string;
    };

type BackfillBibSubjectTermsRowReport = {
  bibliographic_id: string;
  title: string;
  // subjects_before：原始 subjects（trim 後、保留順序；方便人工比對）
  subjects_before: string[];
  // subjects_after：正規化後 subjects（會對齊 term ids 去重結果）
  // - 若這筆被跳過（unmatched/fatal），就回 null 代表「未修改」
  subjects_after: string[] | null;
  subject_term_ids_after: string[] | null;
  decisions: BackfillSubjectLabelDecision[];
  status: 'would_update' | 'skipped_invalid' | 'no_subjects';
};

type BackfillBibSubjectTermsSummary = {
  scanned: number;
  would_update: number;
  skipped_invalid: number;
  no_subjects: number;
  // labels：label-level 的分類統計（便於你快速估算治理工作量）
  labels: {
    matched_preferred: number;
    matched_variant: number;
    auto_created: number;
    ambiguous_auto_created: number;
    unmatched: number;
    skipped_blank: number;
  };
};

export type BackfillBibSubjectTermsPreviewResult = {
  mode: 'preview';
  summary: BackfillBibSubjectTermsSummary;
  rows: BackfillBibSubjectTermsRowReport[];
  next_cursor: string | null;
};

export type BackfillBibSubjectTermsApplyResult = {
  mode: 'apply';
  summary: BackfillBibSubjectTermsSummary;
  rows: BackfillBibSubjectTermsRowReport[];
  next_cursor: string | null;
  audit_event_id: string;
};

export type BackfillBibSubjectTermsResult = BackfillBibSubjectTermsPreviewResult | BackfillBibSubjectTermsApplyResult;

// ----------------------------
// Maintenance：geographics/genres backfill（既有資料 → authority linking v1.3）
// ----------------------------

// 注意：決策狀態與 subjects backfill 相同（只是套用到不同 kind/欄位）
type BackfillGeographicLabelDecision = BackfillSubjectLabelDecision;
type BackfillGenreLabelDecision = BackfillSubjectLabelDecision;

type BackfillBibGeographicTermsRowReport = {
  bibliographic_id: string;
  title: string;
  geographics_before: string[];
  geographics_after: string[] | null;
  geographic_term_ids_after: string[] | null;
  decisions: BackfillGeographicLabelDecision[];
  status: 'would_update' | 'skipped_invalid' | 'no_geographics';
};

type BackfillBibGeographicTermsSummary = {
  scanned: number;
  would_update: number;
  skipped_invalid: number;
  no_geographics: number;
  labels: BackfillBibSubjectTermsSummary['labels'];
};

export type BackfillBibGeographicTermsPreviewResult = {
  mode: 'preview';
  summary: BackfillBibGeographicTermsSummary;
  rows: BackfillBibGeographicTermsRowReport[];
  next_cursor: string | null;
};

export type BackfillBibGeographicTermsApplyResult = {
  mode: 'apply';
  summary: BackfillBibGeographicTermsSummary;
  rows: BackfillBibGeographicTermsRowReport[];
  next_cursor: string | null;
  audit_event_id: string;
};

export type BackfillBibGeographicTermsResult = BackfillBibGeographicTermsPreviewResult | BackfillBibGeographicTermsApplyResult;

type BackfillBibGenreTermsRowReport = {
  bibliographic_id: string;
  title: string;
  genres_before: string[];
  genres_after: string[] | null;
  genre_term_ids_after: string[] | null;
  decisions: BackfillGenreLabelDecision[];
  status: 'would_update' | 'skipped_invalid' | 'no_genres';
};

type BackfillBibGenreTermsSummary = {
  scanned: number;
  would_update: number;
  skipped_invalid: number;
  no_genres: number;
  labels: BackfillBibSubjectTermsSummary['labels'];
};

export type BackfillBibGenreTermsPreviewResult = {
  mode: 'preview';
  summary: BackfillBibGenreTermsSummary;
  rows: BackfillBibGenreTermsRowReport[];
  next_cursor: string | null;
};

export type BackfillBibGenreTermsApplyResult = {
  mode: 'apply';
  summary: BackfillBibGenreTermsSummary;
  rows: BackfillBibGenreTermsRowReport[];
  next_cursor: string | null;
  audit_event_id: string;
};

export type BackfillBibGenreTermsResult = BackfillBibGenreTermsPreviewResult | BackfillBibGenreTermsApplyResult;

// ----------------------------
// Maintenance：names backfill（既有 creators/contributors → name linking v1）
// ----------------------------

// 注意：決策狀態與 subjects backfill 相同（只是套用到不同 kind/欄位）
type BackfillNameLabelDecision = BackfillSubjectLabelDecision;

type BackfillBibNameTermsRowReport = {
  bibliographic_id: string;
  title: string;

  creators_before: string[];
  contributors_before: string[];

  // creators_after / contributors_after：
  // - 若這個 role 沒有任何可回填的 names（或被跳過），就回 null 代表「未修改」
  creators_after: string[] | null;
  contributors_after: string[] | null;

  // creator_term_ids_after / contributor_term_ids_after：
  // - 對應 bibliographic_name_terms 的 term_id（保序去重後）
  creator_term_ids_after: string[] | null;
  contributor_term_ids_after: string[] | null;

  // decisions：讓你能在 UI 直接看到「每個 name 字串被怎麼處理」
  creator_decisions: BackfillNameLabelDecision[];
  contributor_decisions: BackfillNameLabelDecision[];

  status: 'would_update' | 'skipped_invalid' | 'no_names';
};

type BackfillBibNameTermsSummary = {
  scanned: number;
  would_update: number;
  skipped_invalid: number;
  no_names: number;
  labels: BackfillBibSubjectTermsSummary['labels'];
};

export type BackfillBibNameTermsPreviewResult = {
  mode: 'preview';
  summary: BackfillBibNameTermsSummary;
  rows: BackfillBibNameTermsRowReport[];
  next_cursor: string | null;
};

export type BackfillBibNameTermsApplyResult = {
  mode: 'apply';
  summary: BackfillBibNameTermsSummary;
  rows: BackfillBibNameTermsRowReport[];
  next_cursor: string | null;
  audit_event_id: string;
};

export type BackfillBibNameTermsResult = BackfillBibNameTermsPreviewResult | BackfillBibNameTermsApplyResult;

@Injectable()
export class BibsService {
  constructor(private readonly db: DbService) {}

  // ----------------------------
  // Authority linking（subjects → authority_terms）
  // ----------------------------

  /**
   * resolveSubjectTermsForWrite
   *
   * 你要求的方向：主題詞「先正規化再落庫」，並逐步改為 term_id 驅動。
   *
   * 因此，當寫入 bibliographic_records.subjects 時：
   * - 若前端提供 subject_term_ids → 以 id 為真相來源，反查 preferred_label（寫入 subjects）
   * - 若前端提供 subjects（字串）→ 嘗試對應到 authority_terms：
   *   - label 命中 preferred_label → 直接使用該 term
   *   - label 命中 variant_labels（UF）→ 正規化成該 term 的 preferred_label
   *   - label 找不到 → 自動建立 local term（source=...），確保後續能 term_id-driven
   *
   * 回傳：
   * - subjects：應寫入 bibliographic_records.subjects 的「正規化後」文字陣列
   * - subject_term_ids：應寫入 bibliographic_subject_terms 的 term_id 陣列（順序對齊 subjects）
   *
   * 注意：
   * - 這裡不做「同義詞/規範款目」的語意推導；只做 authority file 的一致性治理
   * - 若遇到同一個 label 命中多筆 term（模糊），會拒絕並要求改用 subject_term_ids 指定
   */
  private async resolveSubjectTermsForWrite(
    client: PoolClient,
    orgId: string,
    input: { subjects?: string[] | null; subject_term_ids?: string[] | null },
    options: { vocabulary_code_for_new: string; source_for_new: string },
  ): Promise<{ subjects: string[] | null; subject_term_ids: string[] | null } | null> {
    // 未提供任何 subjects 欄位 → 不介入（保持原值）
    if (input.subjects === undefined && input.subject_term_ids === undefined) return null;

    // 1) subject_term_ids（id 驅動）
    if (input.subject_term_ids !== undefined) {
      const ids = input.subject_term_ids;
      if (ids === null) return { subjects: null, subject_term_ids: null };

      // zod 會驗 UUID；這裡只做去重保序
      const uniqIds = uniqStrings(ids);
      if (uniqIds.length === 0) return { subjects: [], subject_term_ids: [] };

      const result = await client.query<{ id: string; preferred_label: string }>(
        `
        SELECT id, preferred_label
        FROM authority_terms
        WHERE organization_id = $1
          AND kind = 'subject'::authority_term_kind
          AND id = ANY($2::uuid[])
        `,
        [orgId, uniqIds],
      );

      const byId = new Map<string, { id: string; preferred_label: string }>();
      for (const row of result.rows) byId.set(row.id, row);

      const missing = uniqIds.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        throw new BadRequestException({
          error: {
            code: 'SUBJECT_TERM_NOT_FOUND',
            message: 'Some subject_term_ids do not exist',
            details: { missing_term_ids: missing },
          },
        });
      }

      const orderedSubjects: string[] = [];
      const orderedIds: string[] = [];
      for (const id of uniqIds) {
        const term = byId.get(id)!;
        orderedIds.push(id);
        orderedSubjects.push(term.preferred_label);
      }

      return { subjects: orderedSubjects, subject_term_ids: orderedIds };
    }

    // 2) subjects（字串 → 正規化 → term_id）
    const labelsRaw = input.subjects;
    // 型別保險：理論上 input.subjects 若是 undefined，應已在最上方 return null
    if (labelsRaw === undefined) return null;
    if (labelsRaw === null) return { subjects: null, subject_term_ids: null };

    const labels = uniqStrings(labelsRaw);
    if (labels.length === 0) return { subjects: [], subject_term_ids: [] };

    // 2.1 先查有哪些 label 已能對應到 term（preferred 或 variant）
    const selectTermsSql = `
      SELECT id, preferred_label, variant_labels
      FROM authority_terms
      WHERE organization_id = $1
        AND kind = 'subject'::authority_term_kind
        AND (
          preferred_label = ANY($2::text[])
          OR COALESCE(variant_labels, '{}'::text[]) && $2::text[]
        )
    `;

    const existing = await client.query<{
      id: string;
      preferred_label: string;
      variant_labels: string[] | null;
    }>(selectTermsSql, [orgId, labels]);

    // coveredLabels：哪些輸入 labels 已能在 authority_terms 找到對應（避免誤建重複 term）
    const coveredLabels = new Set<string>();
    for (const t of existing.rows) {
      const pref = (t.preferred_label ?? '').trim();
      if (pref && labels.includes(pref)) coveredLabels.add(pref);
      for (const v of t.variant_labels ?? []) {
        const vv = (v ?? '').trim();
        if (vv && labels.includes(vv)) coveredLabels.add(vv);
      }
    }

    const missingLabels = labels.filter((l) => !coveredLabels.has(l));

    // 2.2 缺的 label → 自動建立 local term（確保後續能 term_id-driven）
    if (missingLabels.length > 0) {
      await this.upsertAuthorityTerms(
        client,
        orgId,
        'subject',
        options.vocabulary_code_for_new,
        missingLabels,
        options.source_for_new,
      );
    }

    // 2.3 重新查詢（包含剛建立的 terms），並把每個 label resolve 成唯一 term
    const afterUpsert = missingLabels.length > 0 ? await client.query(selectTermsSql, [orgId, labels]) : existing;

    const terms = afterUpsert.rows;

    // label → term_ids（可能多筆；若 >1 視為模糊）
    const idsByLabel = new Map<string, Set<string>>();
    const preferredById = new Map<string, string>();
    for (const t of terms) {
      preferredById.set(t.id, t.preferred_label);
      const pref = (t.preferred_label ?? '').trim();
      if (pref) {
        const set = idsByLabel.get(pref) ?? new Set<string>();
        set.add(t.id);
        idsByLabel.set(pref, set);
      }
      for (const v of t.variant_labels ?? []) {
        const vv = (v ?? '').trim();
        if (!vv) continue;
        const set = idsByLabel.get(vv) ?? new Set<string>();
        set.add(t.id);
        idsByLabel.set(vv, set);
      }
    }

    const orderedIds: string[] = [];
    const orderedSubjects: string[] = [];
    const seenTermIds = new Set<string>();

    for (const label of labels) {
      const ids = idsByLabel.get(label);
      if (!ids || ids.size === 0) {
        // 理論上不會發生：missingLabels 已 upsert
        throw new BadRequestException({
          error: {
            code: 'SUBJECT_TERM_RESOLVE_FAILED',
            message: 'Failed to resolve subject label to authority term',
            details: { label },
          },
        });
      }

      if (ids.size > 1) {
        throw new BadRequestException({
          error: {
            code: 'SUBJECT_TERM_AMBIGUOUS',
            message: 'Subject label matches multiple authority terms; use subject_term_ids to disambiguate',
            details: { label, term_ids: Array.from(ids) },
          },
        });
      }

      const termId = Array.from(ids)[0]!;
      if (seenTermIds.has(termId)) continue; // 同義/重複輸入 → 去重保序
      seenTermIds.add(termId);

      orderedIds.push(termId);
      orderedSubjects.push(preferredById.get(termId) ?? label);
    }

    return { subjects: orderedSubjects, subject_term_ids: orderedIds };
  }

  /**
   * resolveGeographicTermsForWrite
   *
   * v1.3：把 MARC 651（地理名稱）也改成 term_id-driven（比照 subjects v1）
   *
   * 行為與 resolveSubjectTermsForWrite 完全一致，只是：
   * - kind='geographic'
   * - 欄位改成 geographics / geographic_term_ids
   *
   * 為什麼仍保留 geographics(text[])？
   * - UI 顯示/相容：讓既有「不懂 authority」的畫面仍能列出文字
   * - 快速查詢：允許用 GIN overlap 做 label-based filter（但長期以 term_id-driven 為主）
   */
  private async resolveGeographicTermsForWrite(
    client: PoolClient,
    orgId: string,
    input: { geographics?: string[] | null; geographic_term_ids?: string[] | null },
    options: { vocabulary_code_for_new: string; source_for_new: string },
  ): Promise<{ geographics: string[] | null; geographic_term_ids: string[] | null } | null> {
    // 未提供任何 geographics 欄位 → 不介入（保持原值）
    if (input.geographics === undefined && input.geographic_term_ids === undefined) return null;

    // 1) geographic_term_ids（id 驅動）
    if (input.geographic_term_ids !== undefined) {
      const ids = input.geographic_term_ids;
      if (ids === null) return { geographics: null, geographic_term_ids: null };

      // zod 會驗 UUID；這裡只做去重保序
      const uniqIds = uniqStrings(ids);
      if (uniqIds.length === 0) return { geographics: [], geographic_term_ids: [] };

      const result = await client.query<{ id: string; preferred_label: string }>(
        `
        SELECT id, preferred_label
        FROM authority_terms
        WHERE organization_id = $1
          AND kind = 'geographic'::authority_term_kind
          AND id = ANY($2::uuid[])
        `,
        [orgId, uniqIds],
      );

      const byId = new Map<string, { id: string; preferred_label: string }>();
      for (const row of result.rows) byId.set(row.id, row);

      const missing = uniqIds.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        throw new BadRequestException({
          error: {
            code: 'GEOGRAPHIC_TERM_NOT_FOUND',
            message: 'Some geographic_term_ids do not exist',
            details: { missing_term_ids: missing },
          },
        });
      }

      const orderedLabels: string[] = [];
      const orderedIds: string[] = [];
      for (const id of uniqIds) {
        const term = byId.get(id)!;
        orderedIds.push(id);
        orderedLabels.push(term.preferred_label);
      }

      return { geographics: orderedLabels, geographic_term_ids: orderedIds };
    }

    // 2) geographics（字串 → 正規化 → term_id）
    const labelsRaw = input.geographics;
    if (labelsRaw === undefined) return null;
    if (labelsRaw === null) return { geographics: null, geographic_term_ids: null };

    const labels = uniqStrings(labelsRaw);
    if (labels.length === 0) return { geographics: [], geographic_term_ids: [] };

    // 2.1 先查有哪些 label 已能對應到 term（preferred 或 variant）
    const selectTermsSql = `
      SELECT id, preferred_label, variant_labels
      FROM authority_terms
      WHERE organization_id = $1
        AND kind = 'geographic'::authority_term_kind
        AND (
          preferred_label = ANY($2::text[])
          OR COALESCE(variant_labels, '{}'::text[]) && $2::text[]
        )
    `;

    const existing = await client.query<{
      id: string;
      preferred_label: string;
      variant_labels: string[] | null;
    }>(selectTermsSql, [orgId, labels]);

    const coveredLabels = new Set<string>();
    for (const t of existing.rows) {
      const pref = (t.preferred_label ?? '').trim();
      if (pref && labels.includes(pref)) coveredLabels.add(pref);
      for (const v of t.variant_labels ?? []) {
        const vv = (v ?? '').trim();
        if (vv && labels.includes(vv)) coveredLabels.add(vv);
      }
    }

    const missingLabels = labels.filter((l) => !coveredLabels.has(l));

    // 2.2 缺的 label → 自動建立 local term（確保後續能 term_id-driven）
    if (missingLabels.length > 0) {
      await this.upsertAuthorityTerms(
        client,
        orgId,
        'geographic',
        options.vocabulary_code_for_new,
        missingLabels,
        options.source_for_new,
      );
    }

    // 2.3 重新查詢（包含剛建立的 terms），並把每個 label resolve 成唯一 term
    const afterUpsert = missingLabels.length > 0 ? await client.query(selectTermsSql, [orgId, labels]) : existing;
    const terms = afterUpsert.rows;

    const idsByLabel = new Map<string, Set<string>>();
    const preferredById = new Map<string, string>();
    for (const t of terms) {
      preferredById.set(t.id, t.preferred_label);
      const pref = (t.preferred_label ?? '').trim();
      if (pref) {
        const set = idsByLabel.get(pref) ?? new Set<string>();
        set.add(t.id);
        idsByLabel.set(pref, set);
      }
      for (const v of t.variant_labels ?? []) {
        const vv = (v ?? '').trim();
        if (!vv) continue;
        const set = idsByLabel.get(vv) ?? new Set<string>();
        set.add(t.id);
        idsByLabel.set(vv, set);
      }
    }

    const orderedIds: string[] = [];
    const orderedLabels: string[] = [];
    const seenTermIds = new Set<string>();

    for (const label of labels) {
      const ids = idsByLabel.get(label);
      if (!ids || ids.size === 0) {
        throw new BadRequestException({
          error: {
            code: 'GEOGRAPHIC_TERM_RESOLVE_FAILED',
            message: 'Failed to resolve geographic label to authority term',
            details: { label },
          },
        });
      }

      if (ids.size > 1) {
        throw new BadRequestException({
          error: {
            code: 'GEOGRAPHIC_TERM_AMBIGUOUS',
            message: 'Geographic label matches multiple authority terms; use geographic_term_ids to disambiguate',
            details: { label, term_ids: Array.from(ids) },
          },
        });
      }

      const termId = Array.from(ids)[0]!;
      if (seenTermIds.has(termId)) continue;
      seenTermIds.add(termId);

      orderedIds.push(termId);
      orderedLabels.push(preferredById.get(termId) ?? label);
    }

    return { geographics: orderedLabels, geographic_term_ids: orderedIds };
  }

  /**
   * resolveGenreTermsForWrite
   *
   * v1.3：把 MARC 655（類型/體裁）改成 term_id-driven（比照 subjects v1）
   */
  private async resolveGenreTermsForWrite(
    client: PoolClient,
    orgId: string,
    input: { genres?: string[] | null; genre_term_ids?: string[] | null },
    options: { vocabulary_code_for_new: string; source_for_new: string },
  ): Promise<{ genres: string[] | null; genre_term_ids: string[] | null } | null> {
    if (input.genres === undefined && input.genre_term_ids === undefined) return null;

    // 1) genre_term_ids（id 驅動）
    if (input.genre_term_ids !== undefined) {
      const ids = input.genre_term_ids;
      if (ids === null) return { genres: null, genre_term_ids: null };

      const uniqIds = uniqStrings(ids);
      if (uniqIds.length === 0) return { genres: [], genre_term_ids: [] };

      const result = await client.query<{ id: string; preferred_label: string }>(
        `
        SELECT id, preferred_label
        FROM authority_terms
        WHERE organization_id = $1
          AND kind = 'genre'::authority_term_kind
          AND id = ANY($2::uuid[])
        `,
        [orgId, uniqIds],
      );

      const byId = new Map<string, { id: string; preferred_label: string }>();
      for (const row of result.rows) byId.set(row.id, row);

      const missing = uniqIds.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        throw new BadRequestException({
          error: {
            code: 'GENRE_TERM_NOT_FOUND',
            message: 'Some genre_term_ids do not exist',
            details: { missing_term_ids: missing },
          },
        });
      }

      const orderedLabels: string[] = [];
      const orderedIds: string[] = [];
      for (const id of uniqIds) {
        const term = byId.get(id)!;
        orderedIds.push(id);
        orderedLabels.push(term.preferred_label);
      }

      return { genres: orderedLabels, genre_term_ids: orderedIds };
    }

    // 2) genres（字串 → 正規化 → term_id）
    const labelsRaw = input.genres;
    if (labelsRaw === undefined) return null;
    if (labelsRaw === null) return { genres: null, genre_term_ids: null };

    const labels = uniqStrings(labelsRaw);
    if (labels.length === 0) return { genres: [], genre_term_ids: [] };

    const selectTermsSql = `
      SELECT id, preferred_label, variant_labels
      FROM authority_terms
      WHERE organization_id = $1
        AND kind = 'genre'::authority_term_kind
        AND (
          preferred_label = ANY($2::text[])
          OR COALESCE(variant_labels, '{}'::text[]) && $2::text[]
        )
    `;

    const existing = await client.query<{
      id: string;
      preferred_label: string;
      variant_labels: string[] | null;
    }>(selectTermsSql, [orgId, labels]);

    const coveredLabels = new Set<string>();
    for (const t of existing.rows) {
      const pref = (t.preferred_label ?? '').trim();
      if (pref && labels.includes(pref)) coveredLabels.add(pref);
      for (const v of t.variant_labels ?? []) {
        const vv = (v ?? '').trim();
        if (vv && labels.includes(vv)) coveredLabels.add(vv);
      }
    }

    const missingLabels = labels.filter((l) => !coveredLabels.has(l));

    if (missingLabels.length > 0) {
      await this.upsertAuthorityTerms(
        client,
        orgId,
        'genre',
        options.vocabulary_code_for_new,
        missingLabels,
        options.source_for_new,
      );
    }

    const afterUpsert = missingLabels.length > 0 ? await client.query(selectTermsSql, [orgId, labels]) : existing;
    const terms = afterUpsert.rows;

    const idsByLabel = new Map<string, Set<string>>();
    const preferredById = new Map<string, string>();
    for (const t of terms) {
      preferredById.set(t.id, t.preferred_label);
      const pref = (t.preferred_label ?? '').trim();
      if (pref) {
        const set = idsByLabel.get(pref) ?? new Set<string>();
        set.add(t.id);
        idsByLabel.set(pref, set);
      }
      for (const v of t.variant_labels ?? []) {
        const vv = (v ?? '').trim();
        if (!vv) continue;
        const set = idsByLabel.get(vv) ?? new Set<string>();
        set.add(t.id);
        idsByLabel.set(vv, set);
      }
    }

    const orderedIds: string[] = [];
    const orderedLabels: string[] = [];
    const seenTermIds = new Set<string>();

    for (const label of labels) {
      const ids = idsByLabel.get(label);
      if (!ids || ids.size === 0) {
        throw new BadRequestException({
          error: {
            code: 'GENRE_TERM_RESOLVE_FAILED',
            message: 'Failed to resolve genre label to authority term',
            details: { label },
          },
        });
      }

      if (ids.size > 1) {
        throw new BadRequestException({
          error: {
            code: 'GENRE_TERM_AMBIGUOUS',
            message: 'Genre label matches multiple authority terms; use genre_term_ids to disambiguate',
            details: { label, term_ids: Array.from(ids) },
          },
        });
      }

      const termId = Array.from(ids)[0]!;
      if (seenTermIds.has(termId)) continue;
      seenTermIds.add(termId);

      orderedIds.push(termId);
      orderedLabels.push(preferredById.get(termId) ?? label);
    }

    return { genres: orderedLabels, genre_term_ids: orderedIds };
  }

  /**
   * resolveNameTermsForWrite
   *
   * Step 4：人名 linking（creators/contributors）
   *
   * 你要的方向與 subjects 完全一致，只是 kind 改成 name：
   * - 編目 UI 送 creator_term_ids / contributor_term_ids（term_id-driven）作為真相來源
   * - 後端依 term_id 回寫 creators/contributors（text[]）為 preferred_label（正規化）
   * - 向後相容：仍允許送 creators/contributors（字串），並嘗試：
   *   - 命中 preferred_label → 直接用該 term
   *   - 命中 variant_labels → 正規化成 preferred_label
   *   - 找不到 → 自動建立 local term（確保後續能 term_id-driven）
   *
   * 注意：
   * - 若遇到同一個 label 命中多筆 term（模糊），會拒絕並要求改用 term_ids 指定
   *   （避免自動選錯人名造成不可逆的權威連結錯誤）
   */
  private async resolveNameTermsForWrite(
    client: PoolClient,
    orgId: string,
    input: { labels?: string[] | null; term_ids?: string[] | null },
    options: { vocabulary_code_for_new: string; source_for_new: string; field: 'creators' | 'contributors' },
  ): Promise<{ labels: string[] | null; term_ids: string[] | null } | null> {
    if (input.labels === undefined && input.term_ids === undefined) return null;

    // 1) term_ids（id 驅動）
    if (input.term_ids !== undefined) {
      const ids = input.term_ids;
      if (ids === null) return { labels: null, term_ids: null };

      const uniqIds = uniqStrings(ids);
      if (uniqIds.length === 0) return { labels: [], term_ids: [] };

      const result = await client.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
        `
        SELECT id, preferred_label, vocabulary_code
        FROM authority_terms
        WHERE organization_id = $1
          AND kind = 'name'::authority_term_kind
          AND id = ANY($2::uuid[])
        `,
        [orgId, uniqIds],
      );

      const byId = new Map<string, { id: string; preferred_label: string; vocabulary_code: string }>();
      for (const row of result.rows) byId.set(row.id, row);

      const missing = uniqIds.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        throw new BadRequestException({
          error: {
            code: 'NAME_TERM_NOT_FOUND',
            message: `Some ${options.field} term_ids do not exist`,
            details: { missing_term_ids: missing, field: options.field },
          },
        });
      }

      const orderedLabels: string[] = [];
      const orderedIds: string[] = [];
      for (const id of uniqIds) {
        const t = byId.get(id)!;
        orderedIds.push(id);
        orderedLabels.push(t.preferred_label);
      }

      return { labels: orderedLabels, term_ids: orderedIds };
    }

    // 2) labels（字串 → 正規化 → term_id）
    const labelsRaw = input.labels;
    if (labelsRaw === undefined) return null;
    if (labelsRaw === null) return { labels: null, term_ids: null };

    const labels = uniqStrings(labelsRaw);
    if (labels.length === 0) return { labels: [], term_ids: [] };

    const selectTermsSql = `
      SELECT id, preferred_label, vocabulary_code, variant_labels
      FROM authority_terms
      WHERE organization_id = $1
        AND kind = 'name'::authority_term_kind
        AND (
          preferred_label = ANY($2::text[])
          OR COALESCE(variant_labels, '{}'::text[]) && $2::text[]
        )
    `;

    const existing = await client.query<{
      id: string;
      preferred_label: string;
      vocabulary_code: string;
      variant_labels: string[] | null;
    }>(selectTermsSql, [orgId, labels]);

    const coveredLabels = new Set<string>();
    for (const t of existing.rows) {
      const pref = (t.preferred_label ?? '').trim();
      if (pref && labels.includes(pref)) coveredLabels.add(pref);
      for (const v of t.variant_labels ?? []) {
        const vv = (v ?? '').trim();
        if (vv && labels.includes(vv)) coveredLabels.add(vv);
      }
    }

    const missingLabels = labels.filter((l) => !coveredLabels.has(l));
    if (missingLabels.length > 0) {
      await this.upsertAuthorityTerms(
        client,
        orgId,
        'name',
        options.vocabulary_code_for_new,
        missingLabels,
        options.source_for_new,
      );
    }

    const afterUpsert = missingLabels.length > 0 ? await client.query(selectTermsSql, [orgId, labels]) : existing;
    const terms = afterUpsert.rows;

    const idsByLabel = new Map<string, Set<string>>();
    const preferredById = new Map<string, string>();
    for (const t of terms) {
      const termId = t.id;
      preferredById.set(termId, (t.preferred_label ?? '').trim());

      const pref = (t.preferred_label ?? '').trim();
      if (pref && labels.includes(pref)) {
        const set = idsByLabel.get(pref) ?? new Set<string>();
        set.add(termId);
        idsByLabel.set(pref, set);
      }
      for (const v of t.variant_labels ?? []) {
        const vv = (v ?? '').trim();
        if (!vv || !labels.includes(vv)) continue;
        const set = idsByLabel.get(vv) ?? new Set<string>();
        set.add(termId);
        idsByLabel.set(vv, set);
      }
    }

    const orderedIds: string[] = [];
    const orderedLabels: string[] = [];
    const seenTermIds = new Set<string>();

    for (const label of labels) {
      const ids = idsByLabel.get(label) ?? new Set<string>();
      if (ids.size === 0) continue; // 理論上不應發生（missing 已 upsert）

      if (ids.size > 1) {
        throw new BadRequestException({
          error: {
            code: 'NAME_TERM_AMBIGUOUS',
            message: `Name label matches multiple authority terms; use ${options.field}_term_ids to disambiguate`,
            details: { label, term_ids: Array.from(ids), field: options.field },
          },
        });
      }

      const termId = Array.from(ids)[0]!;
      if (seenTermIds.has(termId)) continue;
      seenTermIds.add(termId);

      orderedIds.push(termId);
      orderedLabels.push(preferredById.get(termId) ?? label);
    }

    return { labels: orderedLabels, term_ids: orderedIds };
  }

  private async replaceBibSubjectTerms(
    client: PoolClient,
    orgId: string,
    bibId: string,
    subjectTermIds: string[] | null,
  ) {
    // replace 策略（先刪後插）：
    // - 避免留下舊連結
    // - 避免需要做 diff（MVP 階段簡化）
    await client.query(
      `
      DELETE FROM bibliographic_subject_terms
      WHERE organization_id = $1
        AND bibliographic_id = $2
      `,
      [orgId, bibId],
    );

    if (!subjectTermIds || subjectTermIds.length === 0) return;

    // position：用 WITH ORDINALITY 保序（1-based）
    await client.query(
      `
      INSERT INTO bibliographic_subject_terms (
        organization_id,
        bibliographic_id,
        term_id,
        position
      )
      SELECT
        $1,
        $2,
        u.term_id,
        u.ordinality::int
      FROM unnest($3::uuid[]) WITH ORDINALITY AS u(term_id, ordinality)
      ON CONFLICT DO NOTHING
      `,
      [orgId, bibId, subjectTermIds],
    );
  }

  private async replaceBibGeographicTerms(
    client: PoolClient,
    orgId: string,
    bibId: string,
    termIds: string[] | null,
  ) {
    // replace 策略（先刪後插）：
    // - 與 subjects 相同：避免留下舊連結、也避免 position unique constraint 的 swap 問題
    await client.query(
      `
      DELETE FROM bibliographic_geographic_terms
      WHERE organization_id = $1
        AND bibliographic_id = $2
      `,
      [orgId, bibId],
    );

    if (!termIds || termIds.length === 0) return;

    await client.query(
      `
      INSERT INTO bibliographic_geographic_terms (
        organization_id,
        bibliographic_id,
        term_id,
        position
      )
      SELECT
        $1,
        $2,
        u.term_id,
        u.ordinality::int
      FROM unnest($3::uuid[]) WITH ORDINALITY AS u(term_id, ordinality)
      ON CONFLICT DO NOTHING
      `,
      [orgId, bibId, termIds],
    );
  }

  private async replaceBibGenreTerms(
    client: PoolClient,
    orgId: string,
    bibId: string,
    termIds: string[] | null,
  ) {
    await client.query(
      `
      DELETE FROM bibliographic_genre_terms
      WHERE organization_id = $1
        AND bibliographic_id = $2
      `,
      [orgId, bibId],
    );

    if (!termIds || termIds.length === 0) return;

    await client.query(
      `
      INSERT INTO bibliographic_genre_terms (
        organization_id,
        bibliographic_id,
        term_id,
        position
      )
      SELECT
        $1,
        $2,
        u.term_id,
        u.ordinality::int
      FROM unnest($3::uuid[]) WITH ORDINALITY AS u(term_id, ordinality)
      ON CONFLICT DO NOTHING
      `,
      [orgId, bibId, termIds],
    );
  }

  private async replaceBibNameTerms(
    client: PoolClient,
    orgId: string,
    bibId: string,
    role: 'creator' | 'contributor',
    termIds: string[] | null,
  ) {
    // replace 策略（先刪後插）：
    // - role 分開維護（creator vs contributor）
    // - 避免 position unique constraint 需要 swap（同 subjects 的策略）
    await client.query(
      `
      DELETE FROM bibliographic_name_terms
      WHERE organization_id = $1
        AND bibliographic_id = $2
        AND role = $3::bibliographic_name_role
      `,
      [orgId, bibId, role],
    );

    if (!termIds || termIds.length === 0) return;

    await client.query(
      `
      INSERT INTO bibliographic_name_terms (
        organization_id,
        bibliographic_id,
        role,
        term_id,
        position
      )
      SELECT
        $1,
        $2,
        $3::bibliographic_name_role,
        u.term_id,
        u.ordinality::int
      FROM unnest($4::uuid[]) WITH ORDINALITY AS u(term_id, ordinality)
      ON CONFLICT DO NOTHING
      `,
      [orgId, bibId, role, termIds],
    );
  }

  async list(
    orgId: string,
    query: ListBibsQuery,
  ): Promise<CursorPage<BibliographicWithCountsRow>> {
    // query：關鍵字搜尋（title/creators/subjects/...）；空字串視為未提供。
    const search = query.query?.trim() ? `%${query.query.trim()}%` : null;

    // subjects_any：主題詞擴充查詢（thesaurus expand 後的 labels[]）
    // - 用 text[] overlap（&&）做「任一命中」：subjects 只要包含任何一個 label 就算 match
    // - 注意：這是「精確 match」的控制詞彙查詢；跟 query 的 ILIKE（部分匹配）不同
    // - 效能：建議在 bibliographic_records.subjects 建 GIN index（見 db/schema.sql）
    const subjectsAny = query.subjects_any?.length ? query.subjects_any : null;

    // subject_term_ids_any / subject_term_ids：
    // - term_id-driven 的主題詞擴充查詢（authority linking v1）
    // - v1.4 起提供更直覺的 alias：subject_term_ids（行為同 *_any：ANY / 任一命中）
    // - 用 junction table 做 EXISTS 過濾（避免靠字串長相）
    // - 效能：建議在 bibliographic_subject_terms 建 (org, term_id, bib_id) 索引（見 db/schema.sql）
    const subjectTermIdsAny =
      (query.subject_term_ids_any?.length ? query.subject_term_ids_any : null) ??
      (query.subject_term_ids?.length ? query.subject_term_ids : null);

    // geographics_any：地理名稱擴充查詢（MARC 651 labels[]）
    // - 用 text[] overlap（&&）做「任一命中」
    const geographicsAny = query.geographics_any?.length ? query.geographics_any : null;

    // geographic_term_ids_any / geographic_term_ids：term_id-driven 的地理名稱過濾（authority linking v1.3）
    // - 用 junction table 做 EXISTS 過濾（避免靠字串長相）
    const geographicTermIdsAny =
      (query.geographic_term_ids_any?.length ? query.geographic_term_ids_any : null) ??
      (query.geographic_term_ids?.length ? query.geographic_term_ids : null);

    // genres_any：類型/體裁擴充查詢（MARC 655 labels[]）
    const genresAny = query.genres_any?.length ? query.genres_any : null;

    // genre_term_ids_any / genre_term_ids：term_id-driven 的類型/體裁過濾（authority linking v1.3）
    const genreTermIdsAny =
      (query.genre_term_ids_any?.length ? query.genre_term_ids_any : null) ??
      (query.genre_term_ids?.length ? query.genre_term_ids : null);

    // isbn：採精確比對（常見做法是條碼/ISBN 直接掃碼）。
    const isbn = query.isbn?.trim() ? query.isbn.trim() : null;

    // classification：用 prefix 搜尋（輸入 823 可找到 823.914）。
    const classification = query.classification?.trim()
      ? `${query.classification.trim()}%`
      : null;

    // cursor pagination：
    // - 排序鍵：b.created_at DESC, b.id DESC
    // - next page 條件：(b.created_at, b.id) < (cursor.sort, cursor.id)
    let cursorSort: string | null = null;
    let cursorId: string | null = null;
    if (query.cursor) {
      try {
        const cursor = decodeCursorV1(query.cursor);
        cursorSort = cursor.sort;
        cursorId = cursor.id;
      } catch (error: any) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid cursor',
            details: { reason: error?.message ?? String(error) },
          },
        });
      }
    }

    const pageSize = query.limit ?? 200;
    const queryLimit = pageSize + 1;

    const result = await this.db.query<BibliographicWithCountsRow>(
      `
      SELECT
        b.id,
        b.organization_id,
        b.title,
        b.creators,
        b.contributors,
        b.publisher,
        b.published_year,
        b.language,
        b.subjects,
        b.geographics,
        b.genres,
        b.isbn,
        b.classification,
        b.created_at,
        b.updated_at,
        -- COUNT 回傳 bigint，轉成 int 讓 API 回傳數字型別。
        COUNT(i.id)::int AS total_items,
        COUNT(i.id) FILTER (WHERE i.status = 'available')::int AS available_items
      FROM bibliographic_records b
      LEFT JOIN item_copies i
        ON i.organization_id = b.organization_id
       AND i.bibliographic_id = b.id
      WHERE b.organization_id = $1
        AND ($2::text IS NULL OR b.isbn = $2)
        AND ($3::text IS NULL OR b.classification ILIKE $3)
        AND (
          $4::uuid[] IS NULL
          OR EXISTS (
            SELECT 1
            FROM bibliographic_subject_terms bst
            WHERE bst.organization_id = b.organization_id
              AND bst.bibliographic_id = b.id
              AND bst.term_id = ANY($4::uuid[])
          )
        )
        AND (
          $5::uuid[] IS NULL
          OR EXISTS (
            SELECT 1
            FROM bibliographic_geographic_terms bgt
            WHERE bgt.organization_id = b.organization_id
              AND bgt.bibliographic_id = b.id
              AND bgt.term_id = ANY($5::uuid[])
          )
        )
        AND (
          $6::uuid[] IS NULL
          OR EXISTS (
            SELECT 1
            FROM bibliographic_genre_terms bgt
            WHERE bgt.organization_id = b.organization_id
              AND bgt.bibliographic_id = b.id
              AND bgt.term_id = ANY($6::uuid[])
          )
        )
        AND (
          $7::text[] IS NULL
          OR b.subjects && $7::text[]
        )
        AND (
          $8::text[] IS NULL
          OR b.geographics && $8::text[]
        )
        AND (
          $9::text[] IS NULL
          OR b.genres && $9::text[]
        )
        AND (
          $10::text IS NULL
          OR b.title ILIKE $10
          OR COALESCE(array_to_string(b.creators, ' '), '') ILIKE $10
          OR COALESCE(array_to_string(b.contributors, ' '), '') ILIKE $10
          OR COALESCE(array_to_string(b.subjects, ' '), '') ILIKE $10
          OR COALESCE(array_to_string(b.geographics, ' '), '') ILIKE $10
          OR COALESCE(array_to_string(b.genres, ' '), '') ILIKE $10
          OR COALESCE(b.publisher, '') ILIKE $10
          OR COALESCE(b.isbn, '') ILIKE $10
          OR COALESCE(b.classification, '') ILIKE $10
        )
        AND (
          $11::timestamptz IS NULL
          OR (b.created_at, b.id) < ($11::timestamptz, $12::uuid)
        )
      GROUP BY b.id
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT $13
      `,
      [
        orgId,
        isbn,
        classification,
        subjectTermIdsAny,
        geographicTermIdsAny,
        genreTermIdsAny,
        subjectsAny,
        geographicsAny,
        genresAny,
        search,
        cursorSort,
        cursorId,
        queryLimit,
      ],
    );

    const rows = result.rows;
    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;

    const last = items.at(-1) ?? null;
    const next_cursor =
      hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.id }) : null;

    return { items, next_cursor };
  }

  async create(orgId: string, input: CreateBibliographicInput): Promise<BibliographicRow> {
    try {
      // 建立書目同時維護 bibliographic_subject_terms / bibliographic_name_terms，因此用 transaction（避免欄位與 links 不一致）。
      return await this.db.transaction(async (client) => {
        // creators/contributors 正規化 + term_id resolve（允許 input 不提供）
        const resolvedCreators = await this.resolveNameTermsForWrite(
          client,
          orgId,
          { labels: input.creators, term_ids: input.creator_term_ids },
          { vocabulary_code_for_new: 'local', source_for_new: 'bib-create', field: 'creators' },
        );
        const resolvedContributors = await this.resolveNameTermsForWrite(
          client,
          orgId,
          { labels: input.contributors, term_ids: input.contributor_term_ids },
          { vocabulary_code_for_new: 'local', source_for_new: 'bib-create', field: 'contributors' },
        );

        const creatorsToStore =
          resolvedCreators !== null ? resolvedCreators.labels : input.creators ?? null;
        const contributorsToStore =
          resolvedContributors !== null ? resolvedContributors.labels : input.contributors ?? null;

        // subjects 正規化 + term_id resolve（允許 input 不提供 subjects）
        const resolvedSubjects = await this.resolveSubjectTermsForWrite(
          client,
          orgId,
          { subjects: input.subjects, subject_term_ids: input.subject_term_ids },
          { vocabulary_code_for_new: 'local', source_for_new: 'bib-create' },
        );

        const subjectsToStore =
          resolvedSubjects !== null ? resolvedSubjects.subjects : input.subjects ?? null;

        // geographics / genres（MARC 651/655）正規化 + term_id resolve（v1.3）
        const resolvedGeographics = await this.resolveGeographicTermsForWrite(
          client,
          orgId,
          { geographics: input.geographics, geographic_term_ids: input.geographic_term_ids },
          { vocabulary_code_for_new: 'local', source_for_new: 'bib-create' },
        );

        const geographicsToStore =
          resolvedGeographics !== null ? resolvedGeographics.geographics : input.geographics ?? null;

        const resolvedGenres = await this.resolveGenreTermsForWrite(
          client,
          orgId,
          { genres: input.genres, genre_term_ids: input.genre_term_ids },
          { vocabulary_code_for_new: 'local', source_for_new: 'bib-create' },
        );

        const genresToStore =
          resolvedGenres !== null ? resolvedGenres.genres : input.genres ?? null;

        const result = await client.query<BibliographicRow>(
          `
          INSERT INTO bibliographic_records (
            organization_id,
            title,
            creators,
            contributors,
            publisher,
            published_year,
            language,
            subjects,
            geographics,
            genres,
            isbn,
            classification
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING
            id,
            organization_id,
            title,
            creators,
            contributors,
            publisher,
            published_year,
            language,
            subjects,
            geographics,
            genres,
            isbn,
            classification,
            created_at,
            updated_at
          `,
          [
            orgId,
            input.title,
            creatorsToStore,
            contributorsToStore,
            input.publisher ?? null,
            input.published_year ?? null,
            input.language ?? null,
            subjectsToStore,
            geographicsToStore,
            genresToStore,
            input.isbn ?? null,
            input.classification ?? null,
          ],
        );

        const created = result.rows[0]!;

        // name term linking（只有在這次有提供 creators/creator_term_ids 等時才維護）
        if (resolvedCreators) {
          await this.replaceBibNameTerms(client, orgId, created.id, 'creator', resolvedCreators.term_ids);
        }
        if (resolvedContributors) {
          await this.replaceBibNameTerms(client, orgId, created.id, 'contributor', resolvedContributors.term_ids);
        }

        // term_id linking（只有在這次有提供 subjects/subject_term_ids 時才維護）
        if (resolvedSubjects) {
          await this.replaceBibSubjectTerms(client, orgId, created.id, resolvedSubjects.subject_term_ids);
        }

        // term_id linking：geographics/genres（v1.3）
        if (resolvedGeographics) {
          await this.replaceBibGeographicTerms(client, orgId, created.id, resolvedGeographics.geographic_term_ids);
        }
        if (resolvedGenres) {
          await this.replaceBibGenreTerms(client, orgId, created.id, resolvedGenres.genre_term_ids);
        }

        return created;
      });
    } catch (error: any) {
      // 23503 = foreign_key_violation：orgId 不存在。
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }
      // 22P02 = invalid_text_representation：UUID/數值格式錯誤（保險處理）。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  async getById(orgId: string, bibId: string): Promise<BibliographicWithCountsAndSubjectLinksRow> {
    // 這個 endpoint 會被「編目 UI」用到，因此我們同時回傳：
    // - bib 本體（含 items counts）
    // - subject_terms（term_id-driven；供 chips/排序/重新選擇）
    //
    // 注意：
    // - subjects(text[]) 仍保留回傳：它是「顯示/相容」用的欄位（也會被 query 搜尋用）
    // - 但編目更新主題詞時，建議前端改送 subject_term_ids（避免 ambiguous）
    return await this.db.transaction(async (client) => {
      const result = await client.query<BibliographicWithCountsRow>(
        `
        SELECT
          b.id,
          b.organization_id,
          b.title,
          b.creators,
          b.contributors,
          b.publisher,
          b.published_year,
          b.language,
          b.subjects,
          b.geographics,
          b.genres,
          b.isbn,
          b.classification,
          b.created_at,
          b.updated_at,
          COUNT(i.id)::int AS total_items,
          COUNT(i.id) FILTER (WHERE i.status = 'available')::int AS available_items
        FROM bibliographic_records b
        LEFT JOIN item_copies i
          ON i.organization_id = b.organization_id
         AND i.bibliographic_id = b.id
        WHERE b.organization_id = $1
          AND b.id = $2
        GROUP BY b.id
        `,
        [orgId, bibId],
      );

      if (result.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Bibliographic record not found' },
        });
      }

      const subjectTerms = await client.query<BibSubjectTermRow>(
        `
        SELECT
          t.id,
          t.vocabulary_code,
          t.preferred_label,
          bst.position
        FROM bibliographic_subject_terms bst
        JOIN authority_terms t
          ON t.organization_id = bst.organization_id
         AND t.id = bst.term_id
        WHERE bst.organization_id = $1
          AND bst.bibliographic_id = $2
        ORDER BY bst.position ASC
        `,
        [orgId, bibId],
      );

      const geographicTerms = await client.query<BibGeographicTermRow>(
        `
        SELECT
          t.id,
          t.vocabulary_code,
          t.preferred_label,
          bgt.position
        FROM bibliographic_geographic_terms bgt
        JOIN authority_terms t
          ON t.organization_id = bgt.organization_id
         AND t.id = bgt.term_id
        WHERE bgt.organization_id = $1
          AND bgt.bibliographic_id = $2
        ORDER BY bgt.position ASC
        `,
        [orgId, bibId],
      );

      const genreTerms = await client.query<BibGenreTermRow>(
        `
        SELECT
          t.id,
          t.vocabulary_code,
          t.preferred_label,
          bgt.position
        FROM bibliographic_genre_terms bgt
        JOIN authority_terms t
          ON t.organization_id = bgt.organization_id
         AND t.id = bgt.term_id
        WHERE bgt.organization_id = $1
          AND bgt.bibliographic_id = $2
        ORDER BY bgt.position ASC
        `,
        [orgId, bibId],
      );

      const creatorTerms = await client.query<BibNameTermRow>(
        `
        SELECT
          t.id,
          t.vocabulary_code,
          t.preferred_label,
          bnt.position
        FROM bibliographic_name_terms bnt
        JOIN authority_terms t
          ON t.organization_id = bnt.organization_id
         AND t.id = bnt.term_id
        WHERE bnt.organization_id = $1
          AND bnt.bibliographic_id = $2
          AND bnt.role = 'creator'::bibliographic_name_role
        ORDER BY bnt.position ASC
        `,
        [orgId, bibId],
      );

      const contributorTerms = await client.query<BibNameTermRow>(
        `
        SELECT
          t.id,
          t.vocabulary_code,
          t.preferred_label,
          bnt.position
        FROM bibliographic_name_terms bnt
        JOIN authority_terms t
          ON t.organization_id = bnt.organization_id
         AND t.id = bnt.term_id
        WHERE bnt.organization_id = $1
          AND bnt.bibliographic_id = $2
          AND bnt.role = 'contributor'::bibliographic_name_role
        ORDER BY bnt.position ASC
        `,
        [orgId, bibId],
      );

      const bib = result.rows[0]!;

      // 額外欄位（不影響既有 API 使用者；只是多回傳資訊）
      return {
        ...bib,
        subject_term_ids: subjectTerms.rows.map((t) => t.id),
        subject_terms: subjectTerms.rows.map((t) => ({
          id: t.id,
          vocabulary_code: t.vocabulary_code,
          preferred_label: t.preferred_label,
        })),
        geographic_term_ids: geographicTerms.rows.map((t) => t.id),
        geographic_terms: geographicTerms.rows.map((t) => ({
          id: t.id,
          vocabulary_code: t.vocabulary_code,
          preferred_label: t.preferred_label,
        })),
        genre_term_ids: genreTerms.rows.map((t) => t.id),
        genre_terms: genreTerms.rows.map((t) => ({
          id: t.id,
          vocabulary_code: t.vocabulary_code,
          preferred_label: t.preferred_label,
        })),
        creator_term_ids: creatorTerms.rows.map((t) => t.id),
        creator_terms: creatorTerms.rows.map((t) => ({
          id: t.id,
          vocabulary_code: t.vocabulary_code,
          preferred_label: t.preferred_label,
        })),
        contributor_term_ids: contributorTerms.rows.map((t) => t.id),
        contributor_terms: contributorTerms.rows.map((t) => ({
          id: t.id,
          vocabulary_code: t.vocabulary_code,
          preferred_label: t.preferred_label,
        })),
      };
    });
  }

  async update(
    orgId: string,
    bibId: string,
    input: UpdateBibliographicInput,
  ): Promise<BibliographicRow> {
    // update 可能同時更新表單欄位與 junction tables（subjects/651/655/names），因此用 transaction。
    return await this.db.transaction(async (client) => {
      const setClauses: string[] = [];
      const params: unknown[] = [orgId, bibId];

      // 只更新「有提供的欄位」，避免把未提供的值寫成 NULL。
      const addClause = (column: string, value: unknown) => {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
      };

      if (input.title !== undefined) addClause('title', input.title);
      if (input.publisher !== undefined) addClause('publisher', input.publisher);
      if (input.published_year !== undefined) addClause('published_year', input.published_year);
      if (input.language !== undefined) addClause('language', input.language);
      if (input.isbn !== undefined) addClause('isbn', input.isbn);
      if (input.classification !== undefined) addClause('classification', input.classification);

      // creators/contributors：若有提供（labels 或 term_ids），就一律走 resolve 正規化
      const resolvedCreators = await this.resolveNameTermsForWrite(
        client,
        orgId,
        { labels: input.creators, term_ids: input.creator_term_ids },
        { vocabulary_code_for_new: 'local', source_for_new: 'bib-update', field: 'creators' },
      );
      if (resolvedCreators !== null) addClause('creators', resolvedCreators.labels);
      else if (input.creators !== undefined) addClause('creators', input.creators);

      const resolvedContributors = await this.resolveNameTermsForWrite(
        client,
        orgId,
        { labels: input.contributors, term_ids: input.contributor_term_ids },
        { vocabulary_code_for_new: 'local', source_for_new: 'bib-update', field: 'contributors' },
      );
      if (resolvedContributors !== null) addClause('contributors', resolvedContributors.labels);
      else if (input.contributors !== undefined) addClause('contributors', input.contributors);

      // subjects：若有提供（subjects 或 subject_term_ids），就一律走 resolve 正規化
      const resolvedSubjects = await this.resolveSubjectTermsForWrite(
        client,
        orgId,
        { subjects: input.subjects, subject_term_ids: input.subject_term_ids },
        { vocabulary_code_for_new: 'local', source_for_new: 'bib-update' },
      );
      if (resolvedSubjects !== null) addClause('subjects', resolvedSubjects.subjects);

      // geographics / genres（MARC 651/655）：若有提供（labels 或 term_ids），就一律走 resolve 正規化
      const resolvedGeographics = await this.resolveGeographicTermsForWrite(
        client,
        orgId,
        { geographics: input.geographics, geographic_term_ids: input.geographic_term_ids },
        { vocabulary_code_for_new: 'local', source_for_new: 'bib-update' },
      );
      if (resolvedGeographics !== null) addClause('geographics', resolvedGeographics.geographics);

      const resolvedGenres = await this.resolveGenreTermsForWrite(
        client,
        orgId,
        { genres: input.genres, genre_term_ids: input.genre_term_ids },
        { vocabulary_code_for_new: 'local', source_for_new: 'bib-update' },
      );
      if (resolvedGenres !== null) addClause('genres', resolvedGenres.genres);

      if (setClauses.length === 0) {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
        });
      }

      // updated_at 一律更新，確保 UI 可用它排序/同步。
      setClauses.push('updated_at = now()');

      const result = await client.query<BibliographicRow>(
        `
        UPDATE bibliographic_records
        SET ${setClauses.join(', ')}
        WHERE organization_id = $1
          AND id = $2
        RETURNING
          id,
          organization_id,
          title,
          creators,
          contributors,
          publisher,
          published_year,
          language,
          subjects,
          geographics,
          genres,
          isbn,
          classification,
          created_at,
          updated_at
        `,
        params,
      );

      if (result.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Bibliographic record not found' },
        });
      }

      // term_id linking：只有在這次有提供 subjects/subject_term_ids 時才重建 links
      if (resolvedSubjects) {
        await this.replaceBibSubjectTerms(client, orgId, bibId, resolvedSubjects.subject_term_ids);
      }

      if (resolvedGeographics) {
        await this.replaceBibGeographicTerms(client, orgId, bibId, resolvedGeographics.geographic_term_ids);
      }

      if (resolvedGenres) {
        await this.replaceBibGenreTerms(client, orgId, bibId, resolvedGenres.genre_term_ids);
      }

      // name term linking：只有在這次有提供 creators/creator_term_ids 等時才維護
      if (resolvedCreators) {
        await this.replaceBibNameTerms(client, orgId, bibId, 'creator', resolvedCreators.term_ids);
      }
      if (resolvedContributors) {
        await this.replaceBibNameTerms(client, orgId, bibId, 'contributor', resolvedContributors.term_ids);
      }

      return result.rows[0]!;
    });
  }

  /**
   * backfillSubjectTerms
   *
   * 這是你要求的「按 org 批次回填」工具：
   * - 把既有的 bibliographic_records.subjects（text[]）轉成 term_id-driven：
   *   - match preferred_label / variant_labels
   *   - missing/ambiguous → 建/補 local term（vocabulary_code_for_new；預設 local）
   *   - 寫入 bibliographic_subject_terms（保序 position）
   *   - 並把 subjects 正規化成 preferred_label（避免同名/同義造成不一致）
   *
   * 為什麼要讓 ambiguous 也「先建 local term」？
   * - migration 階段我們希望先把 links 填滿，讓編目 UI 能完全 term-based
   * - ambiguous 的人工處理，留到後續治理（merge/redirect）一次收斂
   */
  async backfillSubjectTerms(orgId: string, input: BackfillBibSubjectTermsInput): Promise<BackfillBibSubjectTermsResult> {
    return await this.db.withClient(async (client) => {
      // 1) 權限：必須是 staff（admin/librarian 且 active）
      await this.requireStaffActor(client, orgId, input.actor_user_id);

      // 2) cursor/limit：沿用 keyset（created_at DESC, id DESC），避免 offset 變慢
      const pageSizeRaw = input.limit ?? 200;
      const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
      const queryLimit = pageSize + 1;

      let cursorSort: string | null = null;
      let cursorId: string | null = null;
      if (input.cursor) {
        try {
          const cursor = decodeCursorV1(input.cursor);
          cursorSort = cursor.sort;
          cursorId = cursor.id;
        } catch (error: any) {
          throw new BadRequestException({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid cursor',
              details: { reason: error?.message ?? String(error) },
            },
          });
        }
      }

      const onlyMissing = input.only_missing ?? true;
      const vocabularyCodeForNew = input.vocabulary_code_for_new?.trim() || 'local';
      const sourceForNew = input.source_for_new?.trim() || 'bib-subject-backfill';
      const preferVocabularyCodes = (input.prefer_vocabulary_codes ?? []).map((v) => v.trim()).filter(Boolean);

      // 3) preview/apply：用「真實寫入 + rollback/commit」取得可重現的報表
      await client.query('BEGIN');

      const summary: BackfillBibSubjectTermsSummary = {
        scanned: 0,
        would_update: 0,
        skipped_invalid: 0,
        no_subjects: 0,
        labels: {
          matched_preferred: 0,
          matched_variant: 0,
          auto_created: 0,
          ambiguous_auto_created: 0,
          unmatched: 0,
          skipped_blank: 0,
        },
      };

      const rows: BackfillBibSubjectTermsRowReport[] = [];

      try {
        // 3.1) 先抓一批 candidates：只掃「有 subjects」的書目
        // - only_missing=true：只處理 link table 目前為空的書目（最常見 migration）
        const bibs = await client.query<{ id: string; title: string; subjects: string[] | null; created_at: string }>(
          `
          SELECT
            b.id,
            b.title,
            b.subjects,
            b.created_at
          FROM bibliographic_records b
          WHERE b.organization_id = $1
            AND b.subjects IS NOT NULL
            AND array_length(b.subjects, 1) > 0
            AND (
              $2::boolean = false
              OR NOT EXISTS (
                SELECT 1
                FROM bibliographic_subject_terms bst
                WHERE bst.organization_id = b.organization_id
                  AND bst.bibliographic_id = b.id
              )
            )
            AND (
              $3::timestamptz IS NULL
              OR (b.created_at, b.id) < ($3::timestamptz, $4::uuid)
            )
          ORDER BY b.created_at DESC, b.id DESC
          LIMIT $5
          `,
          [orgId, onlyMissing, cursorSort, cursorId, queryLimit],
        );

        const items = bibs.rows.slice(0, pageSize);
        const hasMore = bibs.rows.length > pageSize;
        const last = items.at(-1) ?? null;
        const next_cursor =
          hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.id }) : null;

        // 3.2) 逐筆處理：為了報表可讀與容易 debug，我們先用迴圈（limit 控制住）
        for (const bib of items) {
          summary.scanned += 1;

          const subjectsBefore = (bib.subjects ?? []).map((s) => (s ?? '').trim());
          const nonBlank = subjectsBefore.filter(Boolean);

          if (nonBlank.length === 0) {
            // 全空白：視為無 subjects（不做任何修改）
            summary.no_subjects += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              subjects_before: subjectsBefore,
              subjects_after: null,
              subject_term_ids_after: null,
              decisions: subjectsBefore.map((l) => ({
                input_label: l,
                status: 'skipped_blank' as const,
                reason: 'blank/whitespace-only',
              })),
              status: 'no_subjects',
            });
            summary.labels.skipped_blank += subjectsBefore.length;
            continue;
          }

          // 基本格式檢查：避免把「明顯有問題的舊資料」硬轉（先讓你人工修）
          // - 200 是我們在 API schema 的短字串上限（對齊 create/update）
          const tooLong = nonBlank.filter((l) => l.length > 200);
          if (tooLong.length > 0) {
            summary.skipped_invalid += 1;
            summary.labels.unmatched += tooLong.length;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              subjects_before: subjectsBefore,
              subjects_after: null,
              subject_term_ids_after: null,
              decisions: [
                ...subjectsBefore
                  .filter((l) => !l)
                  .map((l) => ({ input_label: l, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' as const })),
                ...tooLong.map((l) => ({ input_label: l, status: 'unmatched' as const, reason: 'label too long (>200)' as const })),
              ],
              status: 'skipped_invalid',
            });
            summary.labels.skipped_blank += subjectsBefore.filter((l) => !l).length;
            continue;
          }

          // 3.2.1) 查詢「哪些 labels 已存在 term」（preferred 或 variant）
          const labelSet = new Set(nonBlank);
          const existing = await client.query<{
            id: string;
            preferred_label: string;
            vocabulary_code: string;
            variant_labels: string[] | null;
          }>(
            `
            SELECT id, preferred_label, vocabulary_code, variant_labels
            FROM authority_terms
            WHERE organization_id = $1
              AND kind = 'subject'::authority_term_kind
              AND (
                preferred_label = ANY($2::text[])
                OR COALESCE(variant_labels, '{}'::text[]) && $2::text[]
              )
            `,
            [orgId, Array.from(labelSet)],
          );

          // label → candidates（可能多筆）
          const candidatesByLabel = new Map<string, Array<{ id: string; preferred_label: string; vocabulary_code: string; match: 'preferred' | 'variant' }>>();

          for (const t of existing.rows) {
            const pref = (t.preferred_label ?? '').trim();
            if (pref && labelSet.has(pref)) {
              const arr = candidatesByLabel.get(pref) ?? [];
              arr.push({ id: t.id, preferred_label: pref, vocabulary_code: t.vocabulary_code, match: 'preferred' });
              candidatesByLabel.set(pref, arr);
            }

            for (const v of t.variant_labels ?? []) {
              const vv = (v ?? '').trim();
              if (!vv || !labelSet.has(vv)) continue;
              const arr = candidatesByLabel.get(vv) ?? [];
              arr.push({ id: t.id, preferred_label: pref, vocabulary_code: t.vocabulary_code, match: 'variant' });
              candidatesByLabel.set(vv, arr);
            }
          }

          // 3.2.2) 決策：missing/ambiguous → 建 local term；其餘直接選唯一 match
          const labelsToCreateMissing: string[] = [];
          const labelsToCreateAmbiguous: Array<{ label: string; candidates: Array<{ id: string; preferred_label: string; vocabulary_code: string }> }> = [];

          const chosenByLabel = new Map<string, { id: string; preferred_label: string; vocabulary_code: string; status: 'matched_preferred' | 'matched_variant' | 'auto_created' | 'ambiguous_auto_created'; candidates?: Array<{ id: string; preferred_label: string; vocabulary_code: string }> }>();

          for (const label of nonBlank) {
            const candidates = candidatesByLabel.get(label) ?? [];

            if (candidates.length === 0) {
              labelsToCreateMissing.push(label);
              continue;
            }

            if (candidates.length === 1) {
              const c = candidates[0]!;
              chosenByLabel.set(label, {
                id: c.id,
                preferred_label: c.preferred_label,
                vocabulary_code: c.vocabulary_code,
                status: c.match === 'preferred' ? 'matched_preferred' : 'matched_variant',
              });
              continue;
            }

            // 嘗試消歧（保守）：
            // 1) 只有一筆「preferred_label 直接命中」→ 選它
            const preferredMatches = candidates.filter((c) => c.match === 'preferred');
            if (preferredMatches.length === 1) {
              const c = preferredMatches[0]!;
              chosenByLabel.set(label, {
                id: c.id,
                preferred_label: c.preferred_label,
                vocabulary_code: c.vocabulary_code,
                status: 'matched_preferred',
              });
              continue;
            }

            // 2) 若提供 prefer_vocabulary_codes：依順序嘗試選出「唯一命中的 vocabulary」
            let picked: { id: string; preferred_label: string; vocabulary_code: string; match: 'preferred' | 'variant' } | null = null;
            for (const prefer of preferVocabularyCodes) {
              const inVocab = candidates.filter((c) => c.vocabulary_code === prefer);
              if (inVocab.length === 1) {
                picked = inVocab[0]!;
                break;
              }
              if (inVocab.length > 1) {
                // 同一 vocab 仍有多筆 → 無法自動消歧
                picked = null;
                break;
              }
            }

            if (picked) {
              chosenByLabel.set(label, {
                id: picked.id,
                preferred_label: picked.preferred_label,
                vocabulary_code: picked.vocabulary_code,
                status: picked.match === 'preferred' ? 'matched_preferred' : 'matched_variant',
              });
              continue;
            }

            // 3) 仍模糊：migration 階段先建 local term 讓 links 填滿，並把 candidates 寫入報表供後續 merge
            labelsToCreateAmbiguous.push({
              label,
              candidates: candidates.map((c) => ({ id: c.id, preferred_label: c.preferred_label, vocabulary_code: c.vocabulary_code })),
            });
          }

          const labelsToCreate = uniqStrings([...labelsToCreateMissing, ...labelsToCreateAmbiguous.map((x) => x.label)]);

          if (labelsToCreate.length > 0) {
            await this.upsertAuthorityTerms(client, orgId, 'subject', vocabularyCodeForNew, labelsToCreate, sourceForNew);
            const created = await client.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
              `
              SELECT id, preferred_label, vocabulary_code
              FROM authority_terms
              WHERE organization_id = $1
                AND kind = 'subject'::authority_term_kind
                AND vocabulary_code = $2
                AND preferred_label = ANY($3::text[])
              `,
              [orgId, vocabularyCodeForNew, labelsToCreate],
            );

            const createdByLabel = new Map<string, { id: string; preferred_label: string; vocabulary_code: string }>();
            for (const r of created.rows) createdByLabel.set(r.preferred_label, r);

            for (const label of labelsToCreateMissing) {
              const term = createdByLabel.get(label);
              if (!term) continue;
              chosenByLabel.set(label, { ...term, status: 'auto_created' });
            }

            for (const amb of labelsToCreateAmbiguous) {
              const term = createdByLabel.get(amb.label);
              if (!term) continue;
              chosenByLabel.set(amb.label, { ...term, status: 'ambiguous_auto_created', candidates: amb.candidates });
            }
          }

          // 3.2.3) 依原順序組出 term_ids（去重保序）與 subjects 正規化（preferred_label）
          const finalTermIds: string[] = [];
          const finalSubjects: string[] = [];
          const seenTermIds = new Set<string>();
          const decisions: BackfillSubjectLabelDecision[] = [];

          for (const raw of subjectsBefore) {
            const label = (raw ?? '').trim();
            if (!label) {
              decisions.push({ input_label: raw, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' });
              summary.labels.skipped_blank += 1;
              continue;
            }

            const chosen = chosenByLabel.get(label);
            if (!chosen) {
              // 理論上不應發生；保底：視為 unmatched，並跳過（避免把 undefined 寫進 DB）
              decisions.push({ input_label: label, status: 'unmatched' as const, reason: 'internal: label not resolved' });
              summary.labels.unmatched += 1;
              continue;
            }

            const term = { id: chosen.id, vocabulary_code: chosen.vocabulary_code, preferred_label: chosen.preferred_label };

            if (chosen.status === 'matched_preferred') {
              decisions.push({ input_label: label, status: 'matched_preferred', term });
              summary.labels.matched_preferred += 1;
            } else if (chosen.status === 'matched_variant') {
              decisions.push({ input_label: label, status: 'matched_variant', term });
              summary.labels.matched_variant += 1;
            } else if (chosen.status === 'auto_created') {
              decisions.push({ input_label: label, status: 'auto_created', term });
              summary.labels.auto_created += 1;
            } else if (chosen.status === 'ambiguous_auto_created') {
              decisions.push({
                input_label: label,
                status: 'ambiguous_auto_created',
                term,
                candidates: chosen.candidates ?? [],
              });
              summary.labels.ambiguous_auto_created += 1;
            }

            if (seenTermIds.has(term.id)) {
              // 去重保序：同一個 term 不重複連到同一書目（避免 subjects 內重複造成治理困擾）
              continue;
            }
            seenTermIds.add(term.id);
            finalTermIds.push(term.id);
            finalSubjects.push(term.preferred_label);
          }

          // 若最後完全沒有 term（例如全部是空白）→ 視為 no_subjects，不改 DB
          if (finalTermIds.length === 0) {
            summary.no_subjects += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              subjects_before: subjectsBefore,
              subjects_after: null,
              subject_term_ids_after: null,
              decisions,
              status: 'no_subjects',
            });
            continue;
          }

          summary.would_update += 1;

          // apply：更新 links + 正規化 subjects；preview：也跑同樣 SQL，最後 rollback（確保報表可重現）
          await this.replaceBibSubjectTerms(client, orgId, bib.id, finalTermIds);
          await client.query(
            `
            UPDATE bibliographic_records
            SET subjects = $3::text[], updated_at = now()
            WHERE organization_id = $1
              AND id = $2
            `,
            [orgId, bib.id, finalSubjects],
          );

          rows.push({
            bibliographic_id: bib.id,
            title: bib.title,
            subjects_before: subjectsBefore,
            subjects_after: finalSubjects,
            subject_term_ids_after: finalTermIds,
            decisions,
            status: 'would_update',
          });
        }

        if (input.mode === 'preview') {
          await client.query('ROLLBACK');
          return { mode: 'preview', summary, rows, next_cursor } satisfies BackfillBibSubjectTermsPreviewResult;
        }

        // 4) apply：寫 audit（每批次寫一筆，避免 audit 爆量）
        const audit = await client.query<{ id: string }>(
          `
          INSERT INTO audit_events (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          RETURNING id
          `,
          [
            orgId,
            input.actor_user_id,
            'catalog.backfill_subject_terms',
            'maintenance_job',
            // entity_id：用 orgId + cursor（讓同 org 多次批次仍可區分）
            `${orgId}:${input.cursor ?? 'start'}`,
            JSON.stringify({
              note: input.note ?? null,
              options: {
                only_missing: onlyMissing,
                vocabulary_code_for_new: vocabularyCodeForNew,
                source_for_new: sourceForNew,
                prefer_vocabulary_codes: preferVocabularyCodes,
                limit: pageSize,
                cursor: input.cursor ?? null,
              },
              summary,
              next_cursor,
            }),
          ],
        );

        await client.query('COMMIT');
        return {
          mode: 'apply',
          summary,
          rows,
          next_cursor,
          audit_event_id: audit.rows[0]!.id,
        } satisfies BackfillBibSubjectTermsApplyResult;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  /**
   * backfillNameTerms
   *
   * 你在第 4 步要求的「人名 term-based」，除了新資料要走 creator_term_ids/contributor_term_ids 外，
   * 既有資料也需要一個批次工具把 creators/contributors 回填成 junction table（bibliographic_name_terms）。
   *
   * 行為模式比照 subjects backfill（保持一致，降低操作成本）：
   * - preview：transaction 內實跑寫入再 ROLLBACK → 回傳可重現報表
   * - apply：COMMIT + 寫 audit_events（每批一筆，避免 audit 爆量）
   *
   * 回填策略（保守、可治理）：
   * - 對每個名字字串：
   *   - 命中 preferred_label → 直接連結
   *   - 命中 variant_labels → 正規化成 preferred_label 再連結
   *   - 找不到 or 仍模糊 → 建 local term（讓 links 填滿；之後再用 merge/redirect 治理收斂）
   * - creators/contributors 各自保序、各自去重（避免同一 role 重複連到同一 term）
   */
  async backfillNameTerms(orgId: string, input: BackfillBibNameTermsInput): Promise<BackfillBibNameTermsResult> {
    return await this.db.withClient(async (client) => {
      // 1) 權限：必須是 staff（admin/librarian 且 active）
      await this.requireStaffActor(client, orgId, input.actor_user_id);

      // 2) cursor/limit：沿用 keyset（created_at DESC, id DESC），避免 offset 變慢
      const pageSizeRaw = input.limit ?? 200;
      const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
      const queryLimit = pageSize + 1;

      let cursorSort: string | null = null;
      let cursorId: string | null = null;
      if (input.cursor) {
        try {
          const cursor = decodeCursorV1(input.cursor);
          cursorSort = cursor.sort;
          cursorId = cursor.id;
        } catch (error: any) {
          throw new BadRequestException({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid cursor',
              details: { reason: error?.message ?? String(error) },
            },
          });
        }
      }

      const onlyMissing = input.only_missing ?? true;
      const vocabularyCodeForNew = input.vocabulary_code_for_new?.trim() || 'local';
      const sourceForNew = input.source_for_new?.trim() || 'bib-name-backfill';
      const preferVocabularyCodes = (input.prefer_vocabulary_codes ?? []).map((v) => v.trim()).filter(Boolean);

      // 3) preview/apply：用「真實寫入 + rollback/commit」取得可重現的報表
      await client.query('BEGIN');

      const summary: BackfillBibNameTermsSummary = {
        scanned: 0,
        would_update: 0,
        skipped_invalid: 0,
        no_names: 0,
        labels: {
          matched_preferred: 0,
          matched_variant: 0,
          auto_created: 0,
          ambiguous_auto_created: 0,
          unmatched: 0,
          skipped_blank: 0,
        },
      };

      const rows: BackfillBibNameTermsRowReport[] = [];

      try {
        // 3.1) candidates：只掃「有 creators 或 contributors」的書目
        // - only_missing=true：只處理 link table 目前為空的書目（migration 常用）
        const bibs = await client.query<{
          id: string;
          title: string;
          creators: string[] | null;
          contributors: string[] | null;
          created_at: string;
        }>(
          `
          SELECT
            b.id,
            b.title,
            b.creators,
            b.contributors,
            b.created_at
          FROM bibliographic_records b
          WHERE b.organization_id = $1
            AND (
              (b.creators IS NOT NULL AND array_length(b.creators, 1) > 0)
              OR (b.contributors IS NOT NULL AND array_length(b.contributors, 1) > 0)
            )
            AND (
              $2::boolean = false
              OR NOT EXISTS (
                SELECT 1
                FROM bibliographic_name_terms bnt
                WHERE bnt.organization_id = b.organization_id
                  AND bnt.bibliographic_id = b.id
              )
            )
            AND (
              $3::timestamptz IS NULL
              OR (b.created_at, b.id) < ($3::timestamptz, $4::uuid)
            )
          ORDER BY b.created_at DESC, b.id DESC
          LIMIT $5
          `,
          [orgId, onlyMissing, cursorSort, cursorId, queryLimit],
        );

        const items = bibs.rows.slice(0, pageSize);
        const hasMore = bibs.rows.length > pageSize;
        const last = items.at(-1) ?? null;
        const next_cursor =
          hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.id }) : null;

        // 3.2) 逐筆處理（limit 控制住，讓報表容易讀）
        for (const bib of items) {
          summary.scanned += 1;

          const creatorsBefore = (bib.creators ?? []).map((s) => (s ?? '').trim());
          const contributorsBefore = (bib.contributors ?? []).map((s) => (s ?? '').trim());
          const creatorsNonBlank = creatorsBefore.filter(Boolean);
          const contributorsNonBlank = contributorsBefore.filter(Boolean);
          const nonBlank = [...creatorsNonBlank, ...contributorsNonBlank];

          if (nonBlank.length === 0) {
            summary.no_names += 1;

            const creatorDecisions: BackfillNameLabelDecision[] = creatorsBefore.map((l) => ({
              input_label: l,
              status: 'skipped_blank' as const,
              reason: 'blank/whitespace-only',
            }));
            const contributorDecisions: BackfillNameLabelDecision[] = contributorsBefore.map((l) => ({
              input_label: l,
              status: 'skipped_blank' as const,
              reason: 'blank/whitespace-only',
            }));

            summary.labels.skipped_blank += creatorsBefore.length + contributorsBefore.length;

            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              creators_before: creatorsBefore,
              contributors_before: contributorsBefore,
              creators_after: null,
              contributors_after: null,
              creator_term_ids_after: null,
              contributor_term_ids_after: null,
              creator_decisions: creatorDecisions,
              contributor_decisions: contributorDecisions,
              status: 'no_names',
            });
            continue;
          }

          // 基本格式檢查：避免把「明顯有問題的舊資料」硬轉（先讓你人工修）
          // - 200 是我們在 API schema 的短字串上限（對齊 create/update）
          const tooLongCreators = creatorsNonBlank.filter((l) => l.length > 200);
          const tooLongContributors = contributorsNonBlank.filter((l) => l.length > 200);
          const tooLong = [...tooLongCreators, ...tooLongContributors];
          if (tooLong.length > 0) {
            summary.skipped_invalid += 1;
            summary.labels.unmatched += tooLong.length;

            const creatorDecisions: BackfillNameLabelDecision[] = [
              ...creatorsBefore
                .filter((l) => !l)
                .map((l) => ({ input_label: l, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' as const })),
              ...tooLongCreators.map((l) => ({ input_label: l, status: 'unmatched' as const, reason: 'label too long (>200)' as const })),
            ];
            const contributorDecisions: BackfillNameLabelDecision[] = [
              ...contributorsBefore
                .filter((l) => !l)
                .map((l) => ({ input_label: l, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' as const })),
              ...tooLongContributors.map((l) => ({ input_label: l, status: 'unmatched' as const, reason: 'label too long (>200)' as const })),
            ];

            summary.labels.skipped_blank += creatorsBefore.filter((l) => !l).length + contributorsBefore.filter((l) => !l).length;

            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              creators_before: creatorsBefore,
              contributors_before: contributorsBefore,
              creators_after: null,
              contributors_after: null,
              creator_term_ids_after: null,
              contributor_term_ids_after: null,
              creator_decisions: creatorDecisions,
              contributor_decisions: contributorDecisions,
              status: 'skipped_invalid',
            });
            continue;
          }

          // 3.2.1) 查詢「哪些 labels 已存在 term」（preferred 或 variant）
          const labelSet = new Set(nonBlank);
          const existing = await client.query<{
            id: string;
            preferred_label: string;
            vocabulary_code: string;
            variant_labels: string[] | null;
          }>(
            `
            SELECT id, preferred_label, vocabulary_code, variant_labels
            FROM authority_terms
            WHERE organization_id = $1
              AND kind = 'name'::authority_term_kind
              AND (
                preferred_label = ANY($2::text[])
                OR COALESCE(variant_labels, '{}'::text[]) && $2::text[]
              )
            `,
            [orgId, Array.from(labelSet)],
          );

          // label → candidates（可能多筆）
          const candidatesByLabel = new Map<
            string,
            Array<{ id: string; preferred_label: string; vocabulary_code: string; match: 'preferred' | 'variant' }>
          >();

          for (const t of existing.rows) {
            const pref = (t.preferred_label ?? '').trim();
            if (pref && labelSet.has(pref)) {
              const arr = candidatesByLabel.get(pref) ?? [];
              arr.push({ id: t.id, preferred_label: pref, vocabulary_code: t.vocabulary_code, match: 'preferred' });
              candidatesByLabel.set(pref, arr);
            }

            for (const v of t.variant_labels ?? []) {
              const vv = (v ?? '').trim();
              if (!vv || !labelSet.has(vv)) continue;
              const arr = candidatesByLabel.get(vv) ?? [];
              arr.push({ id: t.id, preferred_label: pref, vocabulary_code: t.vocabulary_code, match: 'variant' });
              candidatesByLabel.set(vv, arr);
            }
          }

          // 3.2.2) 決策：missing/ambiguous → 建 local term；其餘直接選唯一 match
          const labelsToCreateMissing: string[] = [];
          const labelsToCreateAmbiguous: Array<{ label: string; candidates: Array<{ id: string; preferred_label: string; vocabulary_code: string }> }> = [];

          const chosenByLabel = new Map<
            string,
            {
              id: string;
              preferred_label: string;
              vocabulary_code: string;
              status: 'matched_preferred' | 'matched_variant' | 'auto_created' | 'ambiguous_auto_created';
              candidates?: Array<{ id: string; preferred_label: string; vocabulary_code: string }>;
            }
          >();

          for (const label of nonBlank) {
            const candidates = candidatesByLabel.get(label) ?? [];

            if (candidates.length === 0) {
              labelsToCreateMissing.push(label);
              continue;
            }

            if (candidates.length === 1) {
              const c = candidates[0]!;
              chosenByLabel.set(label, {
                id: c.id,
                preferred_label: c.preferred_label,
                vocabulary_code: c.vocabulary_code,
                status: c.match === 'preferred' ? 'matched_preferred' : 'matched_variant',
              });
              continue;
            }

            // 嘗試消歧（保守）：
            // 1) 只有一筆「preferred_label 直接命中」→ 選它
            const preferredMatches = candidates.filter((c) => c.match === 'preferred');
            if (preferredMatches.length === 1) {
              const c = preferredMatches[0]!;
              chosenByLabel.set(label, {
                id: c.id,
                preferred_label: c.preferred_label,
                vocabulary_code: c.vocabulary_code,
                status: 'matched_preferred',
              });
              continue;
            }

            // 2) 若提供 prefer_vocabulary_codes：依順序嘗試選出「唯一命中的 vocabulary」
            let picked: { id: string; preferred_label: string; vocabulary_code: string; match: 'preferred' | 'variant' } | null = null;
            for (const prefer of preferVocabularyCodes) {
              const inVocab = candidates.filter((c) => c.vocabulary_code === prefer);
              if (inVocab.length === 1) {
                picked = inVocab[0]!;
                break;
              }
              if (inVocab.length > 1) {
                // 同一 vocab 仍有多筆 → 無法自動消歧
                picked = null;
                break;
              }
            }

            if (picked) {
              chosenByLabel.set(label, {
                id: picked.id,
                preferred_label: picked.preferred_label,
                vocabulary_code: picked.vocabulary_code,
                status: picked.match === 'preferred' ? 'matched_preferred' : 'matched_variant',
              });
              continue;
            }

            // 3) 仍模糊：migration 階段先建 local term 讓 links 填滿，並把 candidates 寫入報表供後續 merge
            labelsToCreateAmbiguous.push({
              label,
              candidates: candidates.map((c) => ({ id: c.id, preferred_label: c.preferred_label, vocabulary_code: c.vocabulary_code })),
            });
          }

          const labelsToCreate = uniqStrings([...labelsToCreateMissing, ...labelsToCreateAmbiguous.map((x) => x.label)]);

          if (labelsToCreate.length > 0) {
            await this.upsertAuthorityTerms(client, orgId, 'name', vocabularyCodeForNew, labelsToCreate, sourceForNew);
            const created = await client.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
              `
              SELECT id, preferred_label, vocabulary_code
              FROM authority_terms
              WHERE organization_id = $1
                AND kind = 'name'::authority_term_kind
                AND vocabulary_code = $2
                AND preferred_label = ANY($3::text[])
              `,
              [orgId, vocabularyCodeForNew, labelsToCreate],
            );

            const createdByLabel = new Map<string, { id: string; preferred_label: string; vocabulary_code: string }>();
            for (const r of created.rows) createdByLabel.set(r.preferred_label, r);

            for (const label of labelsToCreateMissing) {
              const term = createdByLabel.get(label);
              if (!term) continue;
              chosenByLabel.set(label, { ...term, status: 'auto_created' });
            }

            for (const amb of labelsToCreateAmbiguous) {
              const term = createdByLabel.get(amb.label);
              if (!term) continue;
              chosenByLabel.set(amb.label, { ...term, status: 'ambiguous_auto_created', candidates: amb.candidates });
            }
          }

          // 3.2.3) 依原順序組出 term_ids（去重保序）並正規化 creators/contributors（preferred_label）
          const finalCreatorTermIds: string[] = [];
          const finalCreators: string[] = [];
          const seenCreatorTermIds = new Set<string>();
          const creatorDecisions: BackfillNameLabelDecision[] = [];

          for (const raw of creatorsBefore) {
            const label = (raw ?? '').trim();
            if (!label) {
              creatorDecisions.push({ input_label: raw, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' });
              summary.labels.skipped_blank += 1;
              continue;
            }

            const chosen = chosenByLabel.get(label);
            if (!chosen) {
              creatorDecisions.push({ input_label: label, status: 'unmatched' as const, reason: 'internal: label not resolved' });
              summary.labels.unmatched += 1;
              continue;
            }

            const term = { id: chosen.id, vocabulary_code: chosen.vocabulary_code, preferred_label: chosen.preferred_label };

            if (chosen.status === 'matched_preferred') {
              creatorDecisions.push({ input_label: label, status: 'matched_preferred', term });
              summary.labels.matched_preferred += 1;
            } else if (chosen.status === 'matched_variant') {
              creatorDecisions.push({ input_label: label, status: 'matched_variant', term });
              summary.labels.matched_variant += 1;
            } else if (chosen.status === 'auto_created') {
              creatorDecisions.push({ input_label: label, status: 'auto_created', term });
              summary.labels.auto_created += 1;
            } else if (chosen.status === 'ambiguous_auto_created') {
              creatorDecisions.push({ input_label: label, status: 'ambiguous_auto_created', term, candidates: chosen.candidates ?? [] });
              summary.labels.ambiguous_auto_created += 1;
            }

            if (seenCreatorTermIds.has(term.id)) continue;
            seenCreatorTermIds.add(term.id);
            finalCreatorTermIds.push(term.id);
            finalCreators.push(term.preferred_label);
          }

          const finalContributorTermIds: string[] = [];
          const finalContributors: string[] = [];
          const seenContributorTermIds = new Set<string>();
          const contributorDecisions: BackfillNameLabelDecision[] = [];

          for (const raw of contributorsBefore) {
            const label = (raw ?? '').trim();
            if (!label) {
              contributorDecisions.push({ input_label: raw, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' });
              summary.labels.skipped_blank += 1;
              continue;
            }

            const chosen = chosenByLabel.get(label);
            if (!chosen) {
              contributorDecisions.push({ input_label: label, status: 'unmatched' as const, reason: 'internal: label not resolved' });
              summary.labels.unmatched += 1;
              continue;
            }

            const term = { id: chosen.id, vocabulary_code: chosen.vocabulary_code, preferred_label: chosen.preferred_label };

            if (chosen.status === 'matched_preferred') {
              contributorDecisions.push({ input_label: label, status: 'matched_preferred', term });
              summary.labels.matched_preferred += 1;
            } else if (chosen.status === 'matched_variant') {
              contributorDecisions.push({ input_label: label, status: 'matched_variant', term });
              summary.labels.matched_variant += 1;
            } else if (chosen.status === 'auto_created') {
              contributorDecisions.push({ input_label: label, status: 'auto_created', term });
              summary.labels.auto_created += 1;
            } else if (chosen.status === 'ambiguous_auto_created') {
              contributorDecisions.push({ input_label: label, status: 'ambiguous_auto_created', term, candidates: chosen.candidates ?? [] });
              summary.labels.ambiguous_auto_created += 1;
            }

            if (seenContributorTermIds.has(term.id)) continue;
            seenContributorTermIds.add(term.id);
            finalContributorTermIds.push(term.id);
            finalContributors.push(term.preferred_label);
          }

          const shouldUpdateCreators = finalCreatorTermIds.length > 0;
          const shouldUpdateContributors = finalContributorTermIds.length > 0;

          if (!shouldUpdateCreators && !shouldUpdateContributors) {
            summary.no_names += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              creators_before: creatorsBefore,
              contributors_before: contributorsBefore,
              creators_after: null,
              contributors_after: null,
              creator_term_ids_after: null,
              contributor_term_ids_after: null,
              creator_decisions: creatorDecisions,
              contributor_decisions: contributorDecisions,
              status: 'no_names',
            });
            continue;
          }

          summary.would_update += 1;

          // apply：更新 links + 正規化 creators/contributors；preview：也跑同樣 SQL，最後 rollback（確保報表可重現）
          if (shouldUpdateCreators) {
            await this.replaceBibNameTerms(client, orgId, bib.id, 'creator', finalCreatorTermIds);
          }
          if (shouldUpdateContributors) {
            await this.replaceBibNameTerms(client, orgId, bib.id, 'contributor', finalContributorTermIds);
          }

          // creators/contributors：只有在該 role 有值時才更新（保守：避免把「只有 link table」的資料清空）
          const setClauses: string[] = [];
          const params: unknown[] = [orgId, bib.id];
          let idx = 3;

          if (shouldUpdateCreators) {
            setClauses.push(`creators = $${idx}::text[]`);
            params.push(finalCreators);
            idx += 1;
          }
          if (shouldUpdateContributors) {
            setClauses.push(`contributors = $${idx}::text[]`);
            params.push(finalContributors);
            idx += 1;
          }
          setClauses.push('updated_at = now()');

          await client.query(
            `
            UPDATE bibliographic_records
            SET ${setClauses.join(', ')}
            WHERE organization_id = $1
              AND id = $2
            `,
            params,
          );

          rows.push({
            bibliographic_id: bib.id,
            title: bib.title,
            creators_before: creatorsBefore,
            contributors_before: contributorsBefore,
            creators_after: shouldUpdateCreators ? finalCreators : null,
            contributors_after: shouldUpdateContributors ? finalContributors : null,
            creator_term_ids_after: shouldUpdateCreators ? finalCreatorTermIds : null,
            contributor_term_ids_after: shouldUpdateContributors ? finalContributorTermIds : null,
            creator_decisions: creatorDecisions,
            contributor_decisions: contributorDecisions,
            status: 'would_update',
          });
        }

        if (input.mode === 'preview') {
          await client.query('ROLLBACK');
          return { mode: 'preview', summary, rows, next_cursor } satisfies BackfillBibNameTermsPreviewResult;
        }

        // 4) apply：寫 audit（每批次寫一筆，避免 audit 爆量）
        const audit = await client.query<{ id: string }>(
          `
          INSERT INTO audit_events (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          RETURNING id
          `,
          [
            orgId,
            input.actor_user_id,
            'catalog.backfill_name_terms',
            'maintenance_job',
            // entity_id：用 orgId + cursor（讓同 org 多次批次仍可區分）
            `${orgId}:${input.cursor ?? 'start'}`,
            JSON.stringify({
              note: input.note ?? null,
              options: {
                only_missing: onlyMissing,
                vocabulary_code_for_new: vocabularyCodeForNew,
                source_for_new: sourceForNew,
                prefer_vocabulary_codes: preferVocabularyCodes,
                limit: pageSize,
                cursor: input.cursor ?? null,
              },
              summary,
              next_cursor,
            }),
          ],
        );

        await client.query('COMMIT');
        return {
          mode: 'apply',
          summary,
          rows,
          next_cursor,
          audit_event_id: audit.rows[0]!.id,
        } satisfies BackfillBibNameTermsApplyResult;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  private extractSubfieldValuesFromMarcExtras(marcExtras: unknown, tag: string, code: string): string[] {
    // 這個 helper 專門給「migration/backfill」用：
    // - v1.3 我們把 651/655 也做成 term-based（junction table）
    // - 但既有資料很可能還停留在 marc_extras（匯入時保留的欄位）
    // - 因此 backfill 需要從 marc_extras 抽出「可治理的最小值」（通常是 $a）
    //
    // 注意：
    // - 我們只取指定子欄位 code（例如 651$a / 655$a）
    // - $x/$y/$z 等 subdivisions 暫不轉成結構化欄位（仍保留在 marc_extras；後續治理再擴充）
    const fields = sanitizeMarcExtras(marcExtras);
    const out: string[] = [];
    for (const f of fields) {
      if (f.tag !== tag) continue;
      if (!isMarcDataField(f)) continue;
      for (const sf of f.subfields ?? []) {
        if (sf.code !== code) continue;
        const v = (sf.value ?? '').trim();
        if (!v) continue;
        out.push(v);
      }
    }
    return out;
  }

  /**
   * backfillGeographicTerms
   *
   * v1.3：把 MARC 651（地理名稱）回填成 term_id-driven（比照 subjects backfill）
   *
   * 來源（優先順序）：
   * 1) bibliographic_records.geographics（如果你已經用新表單欄位編過）
   * 2) bibliographic_records.marc_extras（匯入/進階編目保留的 651$a；migration 常見）
   */
  async backfillGeographicTerms(
    orgId: string,
    input: BackfillBibGeographicTermsInput,
  ): Promise<BackfillBibGeographicTermsResult> {
    return await this.db.withClient(async (client) => {
      await this.requireStaffActor(client, orgId, input.actor_user_id);

      const pageSizeRaw = input.limit ?? 200;
      const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
      const queryLimit = pageSize + 1;

      let cursorSort: string | null = null;
      let cursorId: string | null = null;
      if (input.cursor) {
        try {
          const cursor = decodeCursorV1(input.cursor);
          cursorSort = cursor.sort;
          cursorId = cursor.id;
        } catch (error: any) {
          throw new BadRequestException({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid cursor',
              details: { reason: error?.message ?? String(error) },
            },
          });
        }
      }

      const onlyMissing = input.only_missing ?? true;
      const vocabularyCodeForNew = input.vocabulary_code_for_new?.trim() || 'local';
      const sourceForNew = input.source_for_new?.trim() || 'bib-geographic-backfill';
      const preferVocabularyCodes = (input.prefer_vocabulary_codes ?? []).map((v) => v.trim()).filter(Boolean);

      await client.query('BEGIN');

      const summary: BackfillBibGeographicTermsSummary = {
        scanned: 0,
        would_update: 0,
        skipped_invalid: 0,
        no_geographics: 0,
        labels: {
          matched_preferred: 0,
          matched_variant: 0,
          auto_created: 0,
          ambiguous_auto_created: 0,
          unmatched: 0,
          skipped_blank: 0,
        },
      };

      const rows: BackfillBibGeographicTermsRowReport[] = [];

      try {
        // 掃描 candidates：
        // - geographics 非空，或 marc_extras 非空（可能含 651$a）
        // - only_missing=true：只處理 link table 目前為空的書目（migration 常用）
        const bibs = await client.query<{
          id: string;
          title: string;
          geographics: string[] | null;
          marc_extras: unknown;
          created_at: string;
        }>(
          `
          SELECT
            b.id,
            b.title,
            b.geographics,
            b.marc_extras,
            b.created_at
          FROM bibliographic_records b
          WHERE b.organization_id = $1
            AND (
              (b.geographics IS NOT NULL AND array_length(b.geographics, 1) > 0)
              OR b.marc_extras <> '[]'::jsonb
            )
            AND (
              $2::boolean = false
              OR NOT EXISTS (
                SELECT 1
                FROM bibliographic_geographic_terms bgt
                WHERE bgt.organization_id = b.organization_id
                  AND bgt.bibliographic_id = b.id
              )
            )
            AND (
              $3::timestamptz IS NULL
              OR (b.created_at, b.id) < ($3::timestamptz, $4::uuid)
            )
          ORDER BY b.created_at DESC, b.id DESC
          LIMIT $5
          `,
          [orgId, onlyMissing, cursorSort, cursorId, queryLimit],
        );

        const items = bibs.rows.slice(0, pageSize);
        const hasMore = bibs.rows.length > pageSize;
        const last = items.at(-1) ?? null;
        const next_cursor =
          hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.id }) : null;

        for (const bib of items) {
          summary.scanned += 1;

          // 1) 優先用 geographics 欄位；若全空 → fallback 到 marc_extras 的 651$a
          let geographicsBefore = (bib.geographics ?? []).map((s) => (s ?? '').trim());
          const nonBlankFromColumn = geographicsBefore.filter(Boolean);

          if (nonBlankFromColumn.length === 0) {
            const derived = this.extractSubfieldValuesFromMarcExtras(bib.marc_extras, '651', 'a');
            if (derived.length > 0) geographicsBefore = derived.map((s) => (s ?? '').trim());
          }

          const nonBlank = geographicsBefore.filter(Boolean);

          if (nonBlank.length === 0) {
            summary.no_geographics += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              geographics_before: geographicsBefore,
              geographics_after: null,
              geographic_term_ids_after: null,
              decisions: geographicsBefore.map((l) => ({
                input_label: l,
                status: 'skipped_blank' as const,
                reason: 'blank/whitespace-only',
              })),
              status: 'no_geographics',
            });
            summary.labels.skipped_blank += geographicsBefore.length;
            continue;
          }

          // 基本格式檢查：避免把「明顯有問題的舊資料」硬轉（先讓你人工修）
          const tooLong = nonBlank.filter((l) => l.length > 200);
          if (tooLong.length > 0) {
            summary.skipped_invalid += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              geographics_before: geographicsBefore,
              geographics_after: null,
              geographic_term_ids_after: null,
              decisions: [
                ...geographicsBefore
                  .filter((l) => !l)
                  .map((l) => ({ input_label: l, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' as const })),
                ...tooLong.map((l) => ({ input_label: l, status: 'unmatched' as const, reason: 'label too long (>200)' as const })),
              ],
              status: 'skipped_invalid',
            });
            summary.labels.skipped_blank += geographicsBefore.filter((l) => !l).length;
            continue;
          }

          const labelSet = new Set(nonBlank);
          const existing = await client.query<{
            id: string;
            preferred_label: string;
            vocabulary_code: string;
            variant_labels: string[] | null;
          }>(
            `
            SELECT id, preferred_label, vocabulary_code, variant_labels
            FROM authority_terms
            WHERE organization_id = $1
              AND kind = 'geographic'::authority_term_kind
              AND (
                preferred_label = ANY($2::text[])
                OR COALESCE(variant_labels, '{}'::text[]) && $2::text[]
              )
            `,
            [orgId, Array.from(labelSet)],
          );

          const candidatesByLabel = new Map<
            string,
            Array<{ id: string; preferred_label: string; vocabulary_code: string; match: 'preferred' | 'variant' }>
          >();

          for (const t of existing.rows) {
            const pref = (t.preferred_label ?? '').trim();
            if (pref && labelSet.has(pref)) {
              const arr = candidatesByLabel.get(pref) ?? [];
              arr.push({ id: t.id, preferred_label: pref, vocabulary_code: t.vocabulary_code, match: 'preferred' });
              candidatesByLabel.set(pref, arr);
            }

            for (const v of t.variant_labels ?? []) {
              const vv = (v ?? '').trim();
              if (!vv || !labelSet.has(vv)) continue;
              const arr = candidatesByLabel.get(vv) ?? [];
              arr.push({ id: t.id, preferred_label: pref, vocabulary_code: t.vocabulary_code, match: 'variant' });
              candidatesByLabel.set(vv, arr);
            }
          }

          const labelsToCreateMissing: string[] = [];
          const labelsToCreateAmbiguous: Array<{
            label: string;
            candidates: Array<{ id: string; preferred_label: string; vocabulary_code: string }>;
          }> = [];

          const chosenByLabel = new Map<
            string,
            {
              id: string;
              preferred_label: string;
              vocabulary_code: string;
              status: 'matched_preferred' | 'matched_variant' | 'auto_created' | 'ambiguous_auto_created';
              candidates?: Array<{ id: string; preferred_label: string; vocabulary_code: string }>;
            }
          >();

          for (const label of nonBlank) {
            const candidates = candidatesByLabel.get(label) ?? [];

            if (candidates.length === 0) {
              labelsToCreateMissing.push(label);
              continue;
            }

            if (candidates.length === 1) {
              const c = candidates[0]!;
              chosenByLabel.set(label, {
                id: c.id,
                preferred_label: c.preferred_label,
                vocabulary_code: c.vocabulary_code,
                status: c.match === 'preferred' ? 'matched_preferred' : 'matched_variant',
              });
              continue;
            }

            const preferredMatches = candidates.filter((c) => c.match === 'preferred');
            if (preferredMatches.length === 1) {
              const c = preferredMatches[0]!;
              chosenByLabel.set(label, {
                id: c.id,
                preferred_label: c.preferred_label,
                vocabulary_code: c.vocabulary_code,
                status: 'matched_preferred',
              });
              continue;
            }

            let picked: { id: string; preferred_label: string; vocabulary_code: string; match: 'preferred' | 'variant' } | null = null;
            for (const prefer of preferVocabularyCodes) {
              const inVocab = candidates.filter((c) => c.vocabulary_code === prefer);
              if (inVocab.length === 1) {
                picked = inVocab[0]!;
                break;
              }
              if (inVocab.length > 1) {
                picked = null;
                break;
              }
            }

            if (picked) {
              chosenByLabel.set(label, {
                id: picked.id,
                preferred_label: picked.preferred_label,
                vocabulary_code: picked.vocabulary_code,
                status: picked.match === 'preferred' ? 'matched_preferred' : 'matched_variant',
              });
              continue;
            }

            // 模糊：先建 local term，等後續治理（merge/redirect）收斂
            labelsToCreateAmbiguous.push({
              label,
              candidates: candidates.map((c) => ({ id: c.id, preferred_label: c.preferred_label, vocabulary_code: c.vocabulary_code })),
            });
          }

          if (labelsToCreateMissing.length > 0 || labelsToCreateAmbiguous.length > 0) {
            const labelsToCreate = uniqStrings([
              ...labelsToCreateMissing,
              ...labelsToCreateAmbiguous.map((x) => x.label),
            ]);

            await this.upsertAuthorityTerms(client, orgId, 'geographic', vocabularyCodeForNew, labelsToCreate, sourceForNew);

            const created = await client.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
              `
              SELECT id, preferred_label, vocabulary_code
              FROM authority_terms
              WHERE organization_id = $1
                AND kind = 'geographic'::authority_term_kind
                AND vocabulary_code = $2
                AND preferred_label = ANY($3::text[])
              `,
              [orgId, vocabularyCodeForNew, labelsToCreate],
            );

            const createdByLabel = new Map<string, { id: string; preferred_label: string; vocabulary_code: string }>();
            for (const r of created.rows) createdByLabel.set(r.preferred_label, r);

            for (const label of labelsToCreateMissing) {
              const term = createdByLabel.get(label);
              if (!term) continue;
              chosenByLabel.set(label, { ...term, status: 'auto_created' });
            }

            for (const amb of labelsToCreateAmbiguous) {
              const term = createdByLabel.get(amb.label);
              if (!term) continue;
              chosenByLabel.set(amb.label, { ...term, status: 'ambiguous_auto_created', candidates: amb.candidates });
            }
          }

          const finalTermIds: string[] = [];
          const finalLabels: string[] = [];
          const seenTermIds = new Set<string>();
          const decisions: BackfillGeographicLabelDecision[] = [];

          for (const raw of geographicsBefore) {
            const label = (raw ?? '').trim();
            if (!label) {
              decisions.push({ input_label: raw, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' });
              summary.labels.skipped_blank += 1;
              continue;
            }

            const chosen = chosenByLabel.get(label);
            if (!chosen) {
              decisions.push({ input_label: label, status: 'unmatched' as const, reason: 'internal: label not resolved' });
              summary.labels.unmatched += 1;
              continue;
            }

            const term = { id: chosen.id, vocabulary_code: chosen.vocabulary_code, preferred_label: chosen.preferred_label };

            if (chosen.status === 'matched_preferred') {
              decisions.push({ input_label: label, status: 'matched_preferred', term });
              summary.labels.matched_preferred += 1;
            } else if (chosen.status === 'matched_variant') {
              decisions.push({ input_label: label, status: 'matched_variant', term });
              summary.labels.matched_variant += 1;
            } else if (chosen.status === 'auto_created') {
              decisions.push({ input_label: label, status: 'auto_created', term });
              summary.labels.auto_created += 1;
            } else if (chosen.status === 'ambiguous_auto_created') {
              decisions.push({
                input_label: label,
                status: 'ambiguous_auto_created',
                term,
                candidates: chosen.candidates ?? [],
              });
              summary.labels.ambiguous_auto_created += 1;
            }

            if (seenTermIds.has(term.id)) continue;
            seenTermIds.add(term.id);
            finalTermIds.push(term.id);
            finalLabels.push(term.preferred_label);
          }

          if (finalTermIds.length === 0) {
            summary.no_geographics += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              geographics_before: geographicsBefore,
              geographics_after: null,
              geographic_term_ids_after: null,
              decisions,
              status: 'no_geographics',
            });
            continue;
          }

          summary.would_update += 1;

          await this.replaceBibGeographicTerms(client, orgId, bib.id, finalTermIds);
          await client.query(
            `
            UPDATE bibliographic_records
            SET geographics = $3::text[], updated_at = now()
            WHERE organization_id = $1
              AND id = $2
            `,
            [orgId, bib.id, finalLabels],
          );

          rows.push({
            bibliographic_id: bib.id,
            title: bib.title,
            geographics_before: geographicsBefore,
            geographics_after: finalLabels,
            geographic_term_ids_after: finalTermIds,
            decisions,
            status: 'would_update',
          });
        }

        if (input.mode === 'preview') {
          await client.query('ROLLBACK');
          return { mode: 'preview', summary, rows, next_cursor } satisfies BackfillBibGeographicTermsPreviewResult;
        }

        const audit = await client.query<{ id: string }>(
          `
          INSERT INTO audit_events (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          RETURNING id
          `,
          [
            orgId,
            input.actor_user_id,
            'catalog.backfill_geographic_terms',
            'maintenance_job',
            `${orgId}:${input.cursor ?? 'start'}`,
            JSON.stringify({
              note: input.note ?? null,
              options: {
                only_missing: onlyMissing,
                vocabulary_code_for_new: vocabularyCodeForNew,
                source_for_new: sourceForNew,
                prefer_vocabulary_codes: preferVocabularyCodes,
                limit: pageSize,
                cursor: input.cursor ?? null,
              },
              summary,
              next_cursor,
            }),
          ],
        );

        await client.query('COMMIT');
        return {
          mode: 'apply',
          summary,
          rows,
          next_cursor,
          audit_event_id: audit.rows[0]!.id,
        } satisfies BackfillBibGeographicTermsApplyResult;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  /**
   * backfillGenreTerms
   *
   * v1.3：把 MARC 655（類型/體裁）回填成 term_id-driven（比照 subjects backfill）
   *
   * 來源（優先順序）：
   * 1) bibliographic_records.genres
   * 2) bibliographic_records.marc_extras 的 655$a
   */
  async backfillGenreTerms(
    orgId: string,
    input: BackfillBibGenreTermsInput,
  ): Promise<BackfillBibGenreTermsResult> {
    return await this.db.withClient(async (client) => {
      await this.requireStaffActor(client, orgId, input.actor_user_id);

      const pageSizeRaw = input.limit ?? 200;
      const pageSize = Math.max(1, Math.min(500, pageSizeRaw));
      const queryLimit = pageSize + 1;

      let cursorSort: string | null = null;
      let cursorId: string | null = null;
      if (input.cursor) {
        try {
          const cursor = decodeCursorV1(input.cursor);
          cursorSort = cursor.sort;
          cursorId = cursor.id;
        } catch (error: any) {
          throw new BadRequestException({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid cursor',
              details: { reason: error?.message ?? String(error) },
            },
          });
        }
      }

      const onlyMissing = input.only_missing ?? true;
      const vocabularyCodeForNew = input.vocabulary_code_for_new?.trim() || 'local';
      const sourceForNew = input.source_for_new?.trim() || 'bib-genre-backfill';
      const preferVocabularyCodes = (input.prefer_vocabulary_codes ?? []).map((v) => v.trim()).filter(Boolean);

      await client.query('BEGIN');

      const summary: BackfillBibGenreTermsSummary = {
        scanned: 0,
        would_update: 0,
        skipped_invalid: 0,
        no_genres: 0,
        labels: {
          matched_preferred: 0,
          matched_variant: 0,
          auto_created: 0,
          ambiguous_auto_created: 0,
          unmatched: 0,
          skipped_blank: 0,
        },
      };

      const rows: BackfillBibGenreTermsRowReport[] = [];

      try {
        const bibs = await client.query<{
          id: string;
          title: string;
          genres: string[] | null;
          marc_extras: unknown;
          created_at: string;
        }>(
          `
          SELECT
            b.id,
            b.title,
            b.genres,
            b.marc_extras,
            b.created_at
          FROM bibliographic_records b
          WHERE b.organization_id = $1
            AND (
              (b.genres IS NOT NULL AND array_length(b.genres, 1) > 0)
              OR b.marc_extras <> '[]'::jsonb
            )
            AND (
              $2::boolean = false
              OR NOT EXISTS (
                SELECT 1
                FROM bibliographic_genre_terms bgt
                WHERE bgt.organization_id = b.organization_id
                  AND bgt.bibliographic_id = b.id
              )
            )
            AND (
              $3::timestamptz IS NULL
              OR (b.created_at, b.id) < ($3::timestamptz, $4::uuid)
            )
          ORDER BY b.created_at DESC, b.id DESC
          LIMIT $5
          `,
          [orgId, onlyMissing, cursorSort, cursorId, queryLimit],
        );

        const items = bibs.rows.slice(0, pageSize);
        const hasMore = bibs.rows.length > pageSize;
        const last = items.at(-1) ?? null;
        const next_cursor =
          hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.id }) : null;

        for (const bib of items) {
          summary.scanned += 1;

          let genresBefore = (bib.genres ?? []).map((s) => (s ?? '').trim());
          const nonBlankFromColumn = genresBefore.filter(Boolean);

          if (nonBlankFromColumn.length === 0) {
            const derived = this.extractSubfieldValuesFromMarcExtras(bib.marc_extras, '655', 'a');
            if (derived.length > 0) genresBefore = derived.map((s) => (s ?? '').trim());
          }

          const nonBlank = genresBefore.filter(Boolean);

          if (nonBlank.length === 0) {
            summary.no_genres += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              genres_before: genresBefore,
              genres_after: null,
              genre_term_ids_after: null,
              decisions: genresBefore.map((l) => ({
                input_label: l,
                status: 'skipped_blank' as const,
                reason: 'blank/whitespace-only',
              })),
              status: 'no_genres',
            });
            summary.labels.skipped_blank += genresBefore.length;
            continue;
          }

          const tooLong = nonBlank.filter((l) => l.length > 200);
          if (tooLong.length > 0) {
            summary.skipped_invalid += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              genres_before: genresBefore,
              genres_after: null,
              genre_term_ids_after: null,
              decisions: [
                ...genresBefore
                  .filter((l) => !l)
                  .map((l) => ({ input_label: l, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' as const })),
                ...tooLong.map((l) => ({ input_label: l, status: 'unmatched' as const, reason: 'label too long (>200)' as const })),
              ],
              status: 'skipped_invalid',
            });
            summary.labels.skipped_blank += genresBefore.filter((l) => !l).length;
            continue;
          }

          const labelSet = new Set(nonBlank);
          const existing = await client.query<{
            id: string;
            preferred_label: string;
            vocabulary_code: string;
            variant_labels: string[] | null;
          }>(
            `
            SELECT id, preferred_label, vocabulary_code, variant_labels
            FROM authority_terms
            WHERE organization_id = $1
              AND kind = 'genre'::authority_term_kind
              AND (
                preferred_label = ANY($2::text[])
                OR COALESCE(variant_labels, '{}'::text[]) && $2::text[]
              )
            `,
            [orgId, Array.from(labelSet)],
          );

          const candidatesByLabel = new Map<
            string,
            Array<{ id: string; preferred_label: string; vocabulary_code: string; match: 'preferred' | 'variant' }>
          >();

          for (const t of existing.rows) {
            const pref = (t.preferred_label ?? '').trim();
            if (pref && labelSet.has(pref)) {
              const arr = candidatesByLabel.get(pref) ?? [];
              arr.push({ id: t.id, preferred_label: pref, vocabulary_code: t.vocabulary_code, match: 'preferred' });
              candidatesByLabel.set(pref, arr);
            }

            for (const v of t.variant_labels ?? []) {
              const vv = (v ?? '').trim();
              if (!vv || !labelSet.has(vv)) continue;
              const arr = candidatesByLabel.get(vv) ?? [];
              arr.push({ id: t.id, preferred_label: pref, vocabulary_code: t.vocabulary_code, match: 'variant' });
              candidatesByLabel.set(vv, arr);
            }
          }

          const labelsToCreateMissing: string[] = [];
          const labelsToCreateAmbiguous: Array<{
            label: string;
            candidates: Array<{ id: string; preferred_label: string; vocabulary_code: string }>;
          }> = [];

          const chosenByLabel = new Map<
            string,
            {
              id: string;
              preferred_label: string;
              vocabulary_code: string;
              status: 'matched_preferred' | 'matched_variant' | 'auto_created' | 'ambiguous_auto_created';
              candidates?: Array<{ id: string; preferred_label: string; vocabulary_code: string }>;
            }
          >();

          for (const label of nonBlank) {
            const candidates = candidatesByLabel.get(label) ?? [];

            if (candidates.length === 0) {
              labelsToCreateMissing.push(label);
              continue;
            }

            if (candidates.length === 1) {
              const c = candidates[0]!;
              chosenByLabel.set(label, {
                id: c.id,
                preferred_label: c.preferred_label,
                vocabulary_code: c.vocabulary_code,
                status: c.match === 'preferred' ? 'matched_preferred' : 'matched_variant',
              });
              continue;
            }

            const preferredMatches = candidates.filter((c) => c.match === 'preferred');
            if (preferredMatches.length === 1) {
              const c = preferredMatches[0]!;
              chosenByLabel.set(label, {
                id: c.id,
                preferred_label: c.preferred_label,
                vocabulary_code: c.vocabulary_code,
                status: 'matched_preferred',
              });
              continue;
            }

            let picked: { id: string; preferred_label: string; vocabulary_code: string; match: 'preferred' | 'variant' } | null = null;
            for (const prefer of preferVocabularyCodes) {
              const inVocab = candidates.filter((c) => c.vocabulary_code === prefer);
              if (inVocab.length === 1) {
                picked = inVocab[0]!;
                break;
              }
              if (inVocab.length > 1) {
                picked = null;
                break;
              }
            }

            if (picked) {
              chosenByLabel.set(label, {
                id: picked.id,
                preferred_label: picked.preferred_label,
                vocabulary_code: picked.vocabulary_code,
                status: picked.match === 'preferred' ? 'matched_preferred' : 'matched_variant',
              });
              continue;
            }

            labelsToCreateAmbiguous.push({
              label,
              candidates: candidates.map((c) => ({ id: c.id, preferred_label: c.preferred_label, vocabulary_code: c.vocabulary_code })),
            });
          }

          if (labelsToCreateMissing.length > 0 || labelsToCreateAmbiguous.length > 0) {
            const labelsToCreate = uniqStrings([
              ...labelsToCreateMissing,
              ...labelsToCreateAmbiguous.map((x) => x.label),
            ]);

            await this.upsertAuthorityTerms(client, orgId, 'genre', vocabularyCodeForNew, labelsToCreate, sourceForNew);

            const created = await client.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
              `
              SELECT id, preferred_label, vocabulary_code
              FROM authority_terms
              WHERE organization_id = $1
                AND kind = 'genre'::authority_term_kind
                AND vocabulary_code = $2
                AND preferred_label = ANY($3::text[])
              `,
              [orgId, vocabularyCodeForNew, labelsToCreate],
            );

            const createdByLabel = new Map<string, { id: string; preferred_label: string; vocabulary_code: string }>();
            for (const r of created.rows) createdByLabel.set(r.preferred_label, r);

            for (const label of labelsToCreateMissing) {
              const term = createdByLabel.get(label);
              if (!term) continue;
              chosenByLabel.set(label, { ...term, status: 'auto_created' });
            }

            for (const amb of labelsToCreateAmbiguous) {
              const term = createdByLabel.get(amb.label);
              if (!term) continue;
              chosenByLabel.set(amb.label, { ...term, status: 'ambiguous_auto_created', candidates: amb.candidates });
            }
          }

          const finalTermIds: string[] = [];
          const finalLabels: string[] = [];
          const seenTermIds = new Set<string>();
          const decisions: BackfillGenreLabelDecision[] = [];

          for (const raw of genresBefore) {
            const label = (raw ?? '').trim();
            if (!label) {
              decisions.push({ input_label: raw, status: 'skipped_blank' as const, reason: 'blank/whitespace-only' });
              summary.labels.skipped_blank += 1;
              continue;
            }

            const chosen = chosenByLabel.get(label);
            if (!chosen) {
              decisions.push({ input_label: label, status: 'unmatched' as const, reason: 'internal: label not resolved' });
              summary.labels.unmatched += 1;
              continue;
            }

            const term = { id: chosen.id, vocabulary_code: chosen.vocabulary_code, preferred_label: chosen.preferred_label };

            if (chosen.status === 'matched_preferred') {
              decisions.push({ input_label: label, status: 'matched_preferred', term });
              summary.labels.matched_preferred += 1;
            } else if (chosen.status === 'matched_variant') {
              decisions.push({ input_label: label, status: 'matched_variant', term });
              summary.labels.matched_variant += 1;
            } else if (chosen.status === 'auto_created') {
              decisions.push({ input_label: label, status: 'auto_created', term });
              summary.labels.auto_created += 1;
            } else if (chosen.status === 'ambiguous_auto_created') {
              decisions.push({
                input_label: label,
                status: 'ambiguous_auto_created',
                term,
                candidates: chosen.candidates ?? [],
              });
              summary.labels.ambiguous_auto_created += 1;
            }

            if (seenTermIds.has(term.id)) continue;
            seenTermIds.add(term.id);
            finalTermIds.push(term.id);
            finalLabels.push(term.preferred_label);
          }

          if (finalTermIds.length === 0) {
            summary.no_genres += 1;
            rows.push({
              bibliographic_id: bib.id,
              title: bib.title,
              genres_before: genresBefore,
              genres_after: null,
              genre_term_ids_after: null,
              decisions,
              status: 'no_genres',
            });
            continue;
          }

          summary.would_update += 1;

          await this.replaceBibGenreTerms(client, orgId, bib.id, finalTermIds);
          await client.query(
            `
            UPDATE bibliographic_records
            SET genres = $3::text[], updated_at = now()
            WHERE organization_id = $1
              AND id = $2
            `,
            [orgId, bib.id, finalLabels],
          );

          rows.push({
            bibliographic_id: bib.id,
            title: bib.title,
            genres_before: genresBefore,
            genres_after: finalLabels,
            genre_term_ids_after: finalTermIds,
            decisions,
            status: 'would_update',
          });
        }

        if (input.mode === 'preview') {
          await client.query('ROLLBACK');
          return { mode: 'preview', summary, rows, next_cursor } satisfies BackfillBibGenreTermsPreviewResult;
        }

        const audit = await client.query<{ id: string }>(
          `
          INSERT INTO audit_events (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          RETURNING id
          `,
          [
            orgId,
            input.actor_user_id,
            'catalog.backfill_genre_terms',
            'maintenance_job',
            `${orgId}:${input.cursor ?? 'start'}`,
            JSON.stringify({
              note: input.note ?? null,
              options: {
                only_missing: onlyMissing,
                vocabulary_code_for_new: vocabularyCodeForNew,
                source_for_new: sourceForNew,
                prefer_vocabulary_codes: preferVocabularyCodes,
                limit: pageSize,
                cursor: input.cursor ?? null,
              },
              summary,
              next_cursor,
            }),
          ],
        );

        await client.query('COMMIT');
        return {
          mode: 'apply',
          summary,
          rows,
          next_cursor,
          audit_event_id: audit.rows[0]!.id,
        } satisfies BackfillBibGenreTermsApplyResult;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  // ----------------------------
  // 進階編目（MARC 21 交換格式）
  // ----------------------------

  /**
   * getMarcRecord
   *
   * 目的：
   * - 把「表單欄位」轉成可交換的 MARC record（JSON 結構）
   * - 並把 bibliographic_records.marc_extras append（保留未覆蓋欄位）
   *
   * 設計取捨：
   * - 這裡只回傳「計算後」的 MARC record；真正的 DB 主資料仍是表單欄位 + marc_extras
   * - 好處：表單欄位可治理（驗證/報表/一致性），MARC 仍可匯出不丟欄位
   */
  async getMarcRecord(orgId: string, bibId: string): Promise<MarcRecord> {
    // 只取出 MARC 生成需要的欄位，避免把不必要資料帶到記憶體。
    const result = await this.db.query<BibliographicForMarc>(
      `
      SELECT
        id,
        title,
        creators,
        contributors,
        publisher,
        published_year,
        language,
        subjects,
        geographics,
        genres,
        isbn,
        classification,
        marc_extras
      FROM bibliographic_records
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, bibId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Bibliographic record not found' },
      });
    }

    const bib = result.rows[0]!;

    // 讓 650 能補上 `$2`（thesaurus/source code）與 `$0`（authority term id）：
    //
    // v0：subjects 只有 text[]，因此只能用字串比對推導（容易受 spelling/同名影響）
    // v1：新增 bibliographic_subject_terms 後，優先走 term_id linking（term_id-driven，不再靠字串長相）
    //
    // 取捨（transition）：
    // - 若某筆舊資料尚未 backfill links（link table 空），仍保留 v0 的字串推導（但只在「不模糊」時補）
    // - 一旦 links 存在，就以 links 為真相來源（並用它的 preferred_label 作為匯出 $a）
    const subjectVocabularyByLabel: Record<string, string> = {};
    const subjectAuthorityIdByLabel: Record<string, string> = {};
    const geographicVocabularyByLabel: Record<string, string> = {};
    const geographicAuthorityIdByLabel: Record<string, string> = {};
    const genreVocabularyByLabel: Record<string, string> = {};
    const genreAuthorityIdByLabel: Record<string, string> = {};
    const nameAuthorityIdByLabel: Record<string, string> = {};

    // name linking（100/700 $0）：
    // - v1：新增 bibliographic_name_terms 後，優先走 term_id linking（term_id-driven）
    // - 若尚未 backfill（link table 空），fallback 到「不模糊」的字串推導（避免錯連）
    const linkedCreators = await this.db.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
      `
      SELECT
        t.id,
        t.preferred_label,
        t.vocabulary_code
      FROM bibliographic_name_terms bnt
      JOIN authority_terms t
        ON t.organization_id = bnt.organization_id
       AND t.id = bnt.term_id
      WHERE bnt.organization_id = $1
        AND bnt.bibliographic_id = $2
        AND bnt.role = 'creator'::bibliographic_name_role
      ORDER BY bnt.position ASC
      `,
      [orgId, bibId],
    );

    const linkedContributors = await this.db.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
      `
      SELECT
        t.id,
        t.preferred_label,
        t.vocabulary_code
      FROM bibliographic_name_terms bnt
      JOIN authority_terms t
        ON t.organization_id = bnt.organization_id
       AND t.id = bnt.term_id
      WHERE bnt.organization_id = $1
        AND bnt.bibliographic_id = $2
        AND bnt.role = 'contributor'::bibliographic_name_role
      ORDER BY bnt.position ASC
      `,
      [orgId, bibId],
    );

    const hasLinkedNames = (linkedCreators.rowCount ?? 0) > 0 || (linkedContributors.rowCount ?? 0) > 0;

    const creators = hasLinkedNames
      ? linkedCreators.rows.map((r) => r.preferred_label.trim()).filter(Boolean)
      : (bib.creators ?? []).map((s) => s.trim()).filter(Boolean);

    const contributors = hasLinkedNames
      ? linkedContributors.rows.map((r) => r.preferred_label.trim()).filter(Boolean)
      : (bib.contributors ?? []).map((s) => s.trim()).filter(Boolean);

    if (hasLinkedNames) {
      for (const row of [...linkedCreators.rows, ...linkedContributors.rows]) {
        const label = row.preferred_label;
        const key = normalizeAuthorityLabel(label);
        nameAuthorityIdByLabel[label] = row.id;
        if (key) nameAuthorityIdByLabel[key] = row.id;
      }
    }

    // 1) 先嘗試用 junction table 取得「正規化後的 subjects + term_id + vocabulary_code」
    const linkedSubjects = await this.db.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
      `
      SELECT
        t.id,
        t.preferred_label,
        t.vocabulary_code
      FROM bibliographic_subject_terms bst
      JOIN authority_terms t
        ON t.organization_id = bst.organization_id
       AND t.id = bst.term_id
      WHERE bst.organization_id = $1
        AND bst.bibliographic_id = $2
      ORDER BY bst.position ASC
      `,
      [orgId, bibId],
    );

    const hasLinkedSubjects = (linkedSubjects.rowCount ?? 0) > 0;

    const subjects = hasLinkedSubjects
      ? linkedSubjects.rows.map((r) => r.preferred_label.trim()).filter(Boolean)
      : (bib.subjects ?? []).map((s) => s.trim()).filter(Boolean);

    if (hasLinkedSubjects) {
      // links → 直接建立 mapping（不會有 label 模糊問題）
      for (const row of linkedSubjects.rows) {
        const label = row.preferred_label;
        const key = normalizeAuthorityLabel(label);

        subjectVocabularyByLabel[label] = row.vocabulary_code;
        subjectAuthorityIdByLabel[label] = row.id;

        if (key) {
          subjectVocabularyByLabel[key] = row.vocabulary_code;
          subjectAuthorityIdByLabel[key] = row.id;
        }
      }
    }

    // 2) fallback：沒有 links → 用字串比對推導（僅在不模糊時補）
    // - 避免匯出出現錯誤 thesaurus code / 錯誤 authority id
    if (!hasLinkedSubjects && subjects.length > 0) {
      const terms = await this.db.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
        `
        SELECT id, preferred_label, vocabulary_code
        FROM authority_terms
        WHERE organization_id = $1
          AND kind = 'subject'
          AND preferred_label = ANY($2::text[])
        `,
        [orgId, subjects],
      );

      // group by label：避免同 label 多個 vocabulary_code 時誤判
      const byLabel = new Map<string, { codes: Set<string>; ids: Set<string> }>();
      for (const row of terms.rows) {
        const label = normalizeAuthorityLabel(row.preferred_label);
        if (!label) continue;
        const entry = byLabel.get(label) ?? { codes: new Set<string>(), ids: new Set<string>() };
        entry.codes.add(row.vocabulary_code);
        entry.ids.add(row.id);
        byLabel.set(label, entry);
      }

      for (const [label, entry] of byLabel.entries()) {
        // vocabulary_code 或 id 只要有任一邊模糊，就不推導（避免錯誤連結）
        if (entry.codes.size !== 1) continue;
        if (entry.ids.size !== 1) continue;

        const onlyCode = Array.from(entry.codes)[0]!;
        const onlyId = Array.from(entry.ids)[0]!;

        subjectVocabularyByLabel[label] = onlyCode;
        subjectAuthorityIdByLabel[label] = onlyId;
      }

      // 也補上一份「原字串」key（讓 buildMarcRecordFromBibliographic 同時能用原字串與 normalize key）
      for (const s of subjects) {
        const key = normalizeAuthorityLabel(s);
        const code = key ? subjectVocabularyByLabel[key] : undefined;
        const id = key ? subjectAuthorityIdByLabel[key] : undefined;
        if (code) subjectVocabularyByLabel[s] = code;
        if (id) subjectAuthorityIdByLabel[s] = id;
      }
    }

    // 651（geographic）：與 subjects 相同的策略
    // - 有 links → 以 links 為真相，並建立 $0/$2 mapping
    // - 無 links → 只在「不模糊」時做字串推導（避免錯連）
    const linkedGeographics = await this.db.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
      `
      SELECT
        t.id,
        t.preferred_label,
        t.vocabulary_code
      FROM bibliographic_geographic_terms bgt
      JOIN authority_terms t
        ON t.organization_id = bgt.organization_id
       AND t.id = bgt.term_id
      WHERE bgt.organization_id = $1
        AND bgt.bibliographic_id = $2
      ORDER BY bgt.position ASC
      `,
      [orgId, bibId],
    );

    const hasLinkedGeographics = (linkedGeographics.rowCount ?? 0) > 0;
    const geographics = hasLinkedGeographics
      ? linkedGeographics.rows.map((r) => r.preferred_label.trim()).filter(Boolean)
      : (bib.geographics ?? []).map((s) => s.trim()).filter(Boolean);

    if (hasLinkedGeographics) {
      for (const row of linkedGeographics.rows) {
        const label = row.preferred_label;
        const key = normalizeAuthorityLabel(label);

        geographicVocabularyByLabel[label] = row.vocabulary_code;
        geographicAuthorityIdByLabel[label] = row.id;

        if (key) {
          geographicVocabularyByLabel[key] = row.vocabulary_code;
          geographicAuthorityIdByLabel[key] = row.id;
        }
      }
    }

    if (!hasLinkedGeographics && geographics.length > 0) {
      const terms = await this.db.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
        `
        SELECT id, preferred_label, vocabulary_code
        FROM authority_terms
        WHERE organization_id = $1
          AND kind = 'geographic'
          AND preferred_label = ANY($2::text[])
        `,
        [orgId, geographics],
      );

      const byLabel = new Map<string, { codes: Set<string>; ids: Set<string> }>();
      for (const row of terms.rows) {
        const label = normalizeAuthorityLabel(row.preferred_label);
        if (!label) continue;
        const entry = byLabel.get(label) ?? { codes: new Set<string>(), ids: new Set<string>() };
        entry.codes.add(row.vocabulary_code);
        entry.ids.add(row.id);
        byLabel.set(label, entry);
      }

      for (const [label, entry] of byLabel.entries()) {
        if (entry.codes.size !== 1) continue;
        if (entry.ids.size !== 1) continue;
        geographicVocabularyByLabel[label] = Array.from(entry.codes)[0]!;
        geographicAuthorityIdByLabel[label] = Array.from(entry.ids)[0]!;
      }

      for (const s of geographics) {
        const key = normalizeAuthorityLabel(s);
        const code = key ? geographicVocabularyByLabel[key] : undefined;
        const id = key ? geographicAuthorityIdByLabel[key] : undefined;
        if (code) geographicVocabularyByLabel[s] = code;
        if (id) geographicAuthorityIdByLabel[s] = id;
      }
    }

    // 655（genre）：同樣策略
    const linkedGenres = await this.db.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
      `
      SELECT
        t.id,
        t.preferred_label,
        t.vocabulary_code
      FROM bibliographic_genre_terms bgt
      JOIN authority_terms t
        ON t.organization_id = bgt.organization_id
       AND t.id = bgt.term_id
      WHERE bgt.organization_id = $1
        AND bgt.bibliographic_id = $2
      ORDER BY bgt.position ASC
      `,
      [orgId, bibId],
    );

    const hasLinkedGenres = (linkedGenres.rowCount ?? 0) > 0;
    const genres = hasLinkedGenres
      ? linkedGenres.rows.map((r) => r.preferred_label.trim()).filter(Boolean)
      : (bib.genres ?? []).map((s) => s.trim()).filter(Boolean);

    if (hasLinkedGenres) {
      for (const row of linkedGenres.rows) {
        const label = row.preferred_label;
        const key = normalizeAuthorityLabel(label);

        genreVocabularyByLabel[label] = row.vocabulary_code;
        genreAuthorityIdByLabel[label] = row.id;

        if (key) {
          genreVocabularyByLabel[key] = row.vocabulary_code;
          genreAuthorityIdByLabel[key] = row.id;
        }
      }
    }

    if (!hasLinkedGenres && genres.length > 0) {
      const terms = await this.db.query<{ id: string; preferred_label: string; vocabulary_code: string }>(
        `
        SELECT id, preferred_label, vocabulary_code
        FROM authority_terms
        WHERE organization_id = $1
          AND kind = 'genre'
          AND preferred_label = ANY($2::text[])
        `,
        [orgId, genres],
      );

      const byLabel = new Map<string, { codes: Set<string>; ids: Set<string> }>();
      for (const row of terms.rows) {
        const label = normalizeAuthorityLabel(row.preferred_label);
        if (!label) continue;
        const entry = byLabel.get(label) ?? { codes: new Set<string>(), ids: new Set<string>() };
        entry.codes.add(row.vocabulary_code);
        entry.ids.add(row.id);
        byLabel.set(label, entry);
      }

      for (const [label, entry] of byLabel.entries()) {
        if (entry.codes.size !== 1) continue;
        if (entry.ids.size !== 1) continue;
        genreVocabularyByLabel[label] = Array.from(entry.codes)[0]!;
        genreAuthorityIdByLabel[label] = Array.from(entry.ids)[0]!;
      }

      for (const s of genres) {
        const key = normalizeAuthorityLabel(s);
        const code = key ? genreVocabularyByLabel[key] : undefined;
        const id = key ? genreAuthorityIdByLabel[key] : undefined;
        if (code) genreVocabularyByLabel[s] = code;
        if (id) genreAuthorityIdByLabel[s] = id;
      }
    }

    // buildMarcRecordFromBibliographic 會處理：
    // - marc_extras sanitize + 001/005 保護
    // - 245/264/650/651/655/700/100 的 merge（避免重複欄位且保留進階子欄位）
    const bibForMarc = {
      ...bib,
      ...(hasLinkedSubjects ? { subjects } : {}),
      ...(hasLinkedGeographics ? { geographics } : {}),
      ...(hasLinkedGenres ? { genres } : {}),
      ...(hasLinkedNames ? { creators, contributors } : {}),
    };

    // name fallback：沒有 links → 用字串比對推導（僅在不模糊時補 $0）
    if (!hasLinkedNames) {
      const allNames = uniqStrings([...(creators ?? []), ...(contributors ?? [])]);
      if (allNames.length > 0) {
        const terms = await this.db.query<{ id: string; preferred_label: string }>(
          `
          SELECT id, preferred_label
          FROM authority_terms
          WHERE organization_id = $1
            AND kind = 'name'
            AND preferred_label = ANY($2::text[])
          `,
          [orgId, allNames],
        );

        const byLabel = new Map<string, Set<string>>();
        for (const row of terms.rows) {
          const label = normalizeAuthorityLabel(row.preferred_label);
          if (!label) continue;
          const set = byLabel.get(label) ?? new Set<string>();
          set.add(row.id);
          byLabel.set(label, set);
        }

        for (const [label, ids] of byLabel.entries()) {
          if (ids.size !== 1) continue; // 模糊 → 不推導
          nameAuthorityIdByLabel[label] = Array.from(ids)[0]!;
        }

        // 也補一份原字串 key
        for (const n of allNames) {
          const key = normalizeAuthorityLabel(n);
          const id = key ? nameAuthorityIdByLabel[key] : undefined;
          if (id) nameAuthorityIdByLabel[n] = id;
        }
      }
    }

    return buildMarcRecordFromBibliographic(bibForMarc, {
      subjectVocabularyByLabel,
      subjectAuthorityIdByLabel,
      geographicVocabularyByLabel,
      geographicAuthorityIdByLabel,
      genreVocabularyByLabel,
      genreAuthorityIdByLabel,
      nameAuthorityIdByLabel,
    });
  }

  // ----------------------------
  // MARC extras：authority linking 驗證（$0=urn:uuid）
  // ----------------------------

  /**
   * parseAuthorityTermIdFromControlNumber
   *
   * 我們把 authority_terms.id（UUID）放進 MARC `$0` 時，採用：
   * - `urn:uuid:<uuid>`
   *
   * 原因：
   * - `$0` 在 MARC21 的語意是「authority record control number」
   * - 但匯入資料很常包含外部系統的 control number / URI（例如 id.loc.gov）
   * - 因此我們用 `urn:uuid:` 前綴明確標示「這是本系統的 term_id」，避免混淆。
   *
   * 注意：
   * - 只有在偵測到 `urn:uuid:` 時才回傳 term_id
   * - 其他 `$0` 值（外部 URI）一律忽略（讓匯入/地方欄位能保留）
   */
  private parseAuthorityTermIdFromControlNumber(value: unknown): string | null {
    const v = typeof value === 'string' ? value.trim() : '';
    if (!v) return null;
    if (!/^urn:uuid:/i.test(v)) return null;

    const raw = v.replace(/^urn:uuid:/i, '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return null;
    return raw;
  }

  /**
   * expectedAuthorityKindByMarcTag
   *
   * 「MARC 欄位 ↔ controlled vocab」的固定對映規則（v1 起逐步定死）：
   * - 100/700/710/711/720：name
   * - 650：subject
   * - 651：geographic
   * - 655：genre
   * - 041：language（若你真的把 `$0=urn:uuid:` 用在 041）
   *
   * 若 tag 不在清單內：
   * - 我們仍會做「term_id 必須存在於 authority_terms」的檢查
   * - 但不強制 kind（避免誤擋還沒定規則的欄位）
   */
  private expectedAuthorityKindByMarcTag(tag: string): AuthorityTermKind | null {
    switch ((tag ?? '').trim()) {
      case '100':
      case '700':
      case '710':
      case '711':
      case '720':
        return 'name';
      case '650':
        return 'subject';
      case '651':
        return 'geographic';
      case '655':
        return 'genre';
      case '041':
        return 'language';
      default:
        return null;
    }
  }

  /**
   * collectAuthorityTermIdsFromMarcExtras
   *
   * 從 `marc_extras` 抽出所有 `$0=urn:uuid:<term_id>` 的 UUID（去重後）
   * - 用於「一次查 DB」避免逐欄位 query 造成 N+1
   */
  private collectAuthorityTermIdsFromMarcExtras(marcExtras: MarcField[]): string[] {
    const ids: string[] = [];
    for (const field of marcExtras) {
      if (!isMarcDataField(field)) continue;
      for (const sf of field.subfields ?? []) {
        if (String((sf as any)?.code ?? '').trim() !== '0') continue;
        const id = this.parseAuthorityTermIdFromControlNumber((sf as any)?.value);
        if (id) ids.push(id);
      }
    }
    return uniqStrings(ids);
  }

  /**
   * getAuthorityTermsByIds
   *
   * 只查最小欄位集，供：
   * - marc_extras `$0=urn:uuid:` 的存在性驗證
   * - tag-kind 對映驗證
   * - `$2`（vocabulary_code）一致性檢查（若有提供）
   */
  private async getAuthorityTermsByIds(
    client: PoolClient,
    orgId: string,
    ids: string[],
  ): Promise<Map<string, AuthorityTermLookupRow>> {
    if (ids.length === 0) return new Map();

    const result = await client.query<AuthorityTermLookupRow>(
      `
      SELECT id, kind, vocabulary_code, status
      FROM authority_terms
      WHERE organization_id = $1
        AND id = ANY($2::uuid[])
      `,
      [orgId, ids],
    );

    const byId = new Map<string, AuthorityTermLookupRow>();
    for (const row of result.rows) byId.set(row.id, row);
    return byId;
  }

  /**
   * validateMarcExtrasAuthorityLinksAgainstMap
   *
   * 給定「已查好的 termsById」，逐欄位檢查：
   * 1) `$0=urn:uuid:` 指到的 term_id 必須存在於本 org
   * 2) 若 tag 有固定對映（expected kind），則 term.kind 必須符合
   * 3) 若該欄位提供 `$2`（source/vocabulary code），則必須與 term.vocabulary_code 一致
   *
   * 回傳 violations 而不是直接 throw 的原因：
   * - import-marc 的 preview 需要「逐筆報錯」而不是整包 fail-fast
   */
  private validateMarcExtrasAuthorityLinksAgainstMap(
    marcExtras: MarcField[],
    termsById: Map<string, AuthorityTermLookupRow>,
  ): MarcAuthorityLinkViolation[] {
    const violations: MarcAuthorityLinkViolation[] = [];

    for (let fieldIndex = 0; fieldIndex < marcExtras.length; fieldIndex += 1) {
      const field = marcExtras[fieldIndex]!;
      if (!isMarcDataField(field)) continue;

      const tag = String((field as any)?.tag ?? '').trim();
      const expectedKind = this.expectedAuthorityKindByMarcTag(tag);

      // 1) 先收集這個欄位內所有 `$0=urn:uuid:`（可能多筆）
      const linked: Array<{ term_id: string; subfield_index: number }> = [];
      const subfields = field.subfields ?? [];
      for (let sfIndex = 0; sfIndex < subfields.length; sfIndex += 1) {
        const sf = subfields[sfIndex]!;
        if (String((sf as any)?.code ?? '').trim() !== '0') continue;
        const termId = this.parseAuthorityTermIdFromControlNumber((sf as any)?.value);
        if (!termId) continue;
        linked.push({ term_id: termId, subfield_index: sfIndex });
      }
      if (linked.length === 0) continue;

      // 2) `$2`（vocabulary_code）一致性：若欄位提供 $2，必須與所有 linked term 一致
      const fieldVocab = subfields
        .filter((sf) => String((sf as any)?.code ?? '').trim() === '2')
        .map((sf) => String((sf as any)?.value ?? '').trim())
        .find(Boolean);

      for (const ref of linked) {
        const term = termsById.get(ref.term_id);
        if (!term) {
          violations.push({
            code: 'AUTHORITY_TERM_NOT_FOUND',
            message: 'marc_extras contains $0=urn:uuid that does not exist in authority_terms',
            details: { tag, field_index: fieldIndex, subfield_index: ref.subfield_index, term_id: ref.term_id },
          });
          continue;
        }

        if (expectedKind && term.kind !== expectedKind) {
          violations.push({
            code: 'AUTHORITY_KIND_MISMATCH',
            message: 'authority term kind does not match MARC tag mapping',
            details: {
              tag,
              field_index: fieldIndex,
              subfield_index: ref.subfield_index,
              term_id: ref.term_id,
              expected_kind: expectedKind,
              actual_kind: term.kind,
            },
          });
        }

        if (fieldVocab && term.vocabulary_code !== fieldVocab) {
          violations.push({
            code: 'AUTHORITY_VOCAB_MISMATCH',
            message: 'authority term vocabulary_code does not match MARC $2',
            details: {
              tag,
              field_index: fieldIndex,
              subfield_index: ref.subfield_index,
              term_id: ref.term_id,
              expected_vocabulary_code: term.vocabulary_code,
              actual_vocabulary_code: fieldVocab,
            },
          });
        }
      }
    }

    return violations;
  }

  private async validateMarcExtrasAuthorityLinksWithClient(
    client: PoolClient,
    orgId: string,
    marcExtras: MarcField[],
  ): Promise<MarcAuthorityLinkViolation[]> {
    const ids = this.collectAuthorityTermIdsFromMarcExtras(marcExtras);
    if (ids.length === 0) return [];

    const termsById = await this.getAuthorityTermsByIds(client, orgId, ids);
    return this.validateMarcExtrasAuthorityLinksAgainstMap(marcExtras, termsById);
  }

  /**
   * getMarcExtras
   *
   * 目的：
   * - 讓前端能讀取「未做成表單」的 MARC 欄位（例如 5XX/6XX 進階子欄位）
   * - 方便後續做 MARC 編輯器/authority control 時，有一個可演進的落地點
   *
   * 回傳：
   * - 一律回傳 sanitize 後的 `MarcField[]`（不合法的 element 會被丟掉）
   */
  async getMarcExtras(orgId: string, bibId: string): Promise<MarcField[]> {
    const result = await this.db.query<{ marc_extras: unknown }>(
      `
      SELECT marc_extras
      FROM bibliographic_records
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, bibId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Bibliographic record not found' },
      });
    }

    // pg 通常會把 jsonb 直接 parse 成 JS object，但我們仍做保險處理：若是字串就嘗試 JSON.parse
    const raw = result.rows[0]!.marc_extras;
    const parsed = typeof raw === 'string' ? safeJsonParse(raw) : raw;
    const extras = sanitizeMarcExtras(parsed);

    // 001/005：系統管理欄位（控制號/時間戳），不應存在於 marc_extras；若歷史資料有混入，讀取時先濾掉。
    // 000：leader 不是 field tag；避免混進前端編輯器造成混亂。
    return extras.filter((f) => f.tag !== '000' && f.tag !== '001' && f.tag !== '005');
  }

  /**
   * updateMarcExtras
   *
   * 設計：
   * - 這是一個「純資料更新」：只更新 marc_extras + updated_at
   * - 不在這裡做「MARC 欄位自動推導」（那些屬於 MARC 編輯器/authority pipeline）
   *
   * 但我們會做一個「必要的 referential validation」：
   * - 若欄位包含 `$0=urn:uuid:<term_id>`（代表使用本系統的 authority linking）
   *   → 必須確保 term_id 存在且 tag-kind 對映正確（避免寫出壞連結）
   */
  async updateMarcExtras(orgId: string, bibId: string, marcExtras: MarcField[]): Promise<MarcField[]> {
    return await this.db.withClient(async (client) => {
      const violations = await this.validateMarcExtrasAuthorityLinksWithClient(client, orgId, marcExtras);
      if (violations.length > 0) {
        throw new BadRequestException({
          error: {
            code: 'MARC_AUTHORITY_LINK_INVALID',
            message: 'Invalid authority links in marc_extras ($0=urn:uuid:...)',
            details: { violations },
          },
        });
      }

      const result = await client.query<{ marc_extras: unknown }>(
        `
        UPDATE bibliographic_records
        SET
          marc_extras = $3::jsonb,
          updated_at = now()
        WHERE organization_id = $1
          AND id = $2
        RETURNING marc_extras
        `,
        // 注意：pg 對 JS array 的預設序列化是「Postgres array literal」；
        // 因此這裡用 JSON.stringify + ::jsonb，確保落地型別正確。
        [orgId, bibId, JSON.stringify(marcExtras)],
      );

      if (result.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Bibliographic record not found' },
        });
      }

      const raw = result.rows[0]!.marc_extras;
      const parsed = typeof raw === 'string' ? safeJsonParse(raw) : raw;
      return sanitizeMarcExtras(parsed);
    });
  }

  /**
   * MARC 批次匯入（preview/apply）
   *
   * POST /api/v1/orgs/:orgId/bibs/import-marc
   *
   * 目標：
   * - 讓 staff 一次匯入多筆 MARC record（前端已解析成 bib + marc_extras）
   * - preview：回傳去重結果與建議動作（create/update/skip）+ 錯誤清單
   * - apply：只有在無錯誤時才寫入（交易），並寫一筆 audit_events 方便追溯
   *
   * 去重策略（v0 → v1）：
   * - ISBN：比對 bibliographic_records.isbn
   * - 035：比對 bibliographic_identifiers(scheme='035', value)
   */
  async importMarcBatch(orgId: string, input: ImportMarcBatchInput): Promise<MarcImportResult> {
    const mode = input.mode;

    // options：給預設值，避免前端沒送就變 undefined
    const saveMarcExtras = input.options?.save_marc_extras ?? true;
    const upsertAuthorityTerms = input.options?.upsert_authority_terms ?? false;
    const authorityVocabularyCode = input.options?.authority_vocabulary_code?.trim() || 'local';

    // sha256：追溯「匯入的是哪一份 payload」（不存原文 .mrc，避免過大）
    const sha256 = createHash('sha256').update(JSON.stringify(input.records), 'utf8').digest('hex');

    const run = async (client: PoolClient): Promise<MarcImportResult> => {
      // 權限：匯入者必須是 staff（admin/librarian 且 active）
      await this.requireStaffActor(client, orgId, input.actor_user_id);

      // decisions：index -> override（apply 時才會真的用到；preview 也回傳 decision 欄位方便 UI 呈現）
      const decisionOverrides = new Map<number, { decision: MarcImportDecision; target_bib_id: string | null }>();
      for (const d of input.decisions ?? []) {
        decisionOverrides.set(d.index, { decision: d.decision, target_bib_id: d.target_bib_id ?? null });
      }

      // 1) Extract identifiers：ISBN + 035
      const isbns = uniqStrings(input.records.map((r) => r.bib.isbn ?? null).filter(Boolean));
      const all035 = uniqStrings(input.records.flatMap((r) => extract035Values(r.marc_extras ?? null)));

      // 2) Lookup existing bibs by identifiers（一次查完，避免 per record N queries）
      const bibIdsByIsbn = await this.getBibsByIsbns(client, orgId, isbns);
      const bibIdsBy035 = await this.getBibsByIdentifiers(client, orgId, '035', all035);

      // 3) Build plan（含 errors）
      const warnings: MarcImportRecordError[] = [];
      const errors: MarcImportRecordError[] = [];
      const plans: MarcImportRecordPlan[] = [];

      let matchedByIsbn = 0;
      let matchedBy035 = 0;

      for (let i = 0; i < input.records.length; i += 1) {
        const rec = input.records[i]!;
        const isbn = rec.bib.isbn?.trim() || null;
        const values035 = extract035Values(rec.marc_extras ?? null);

        let match: MarcImportMatch = {
          by: null,
          bib_id: null,
          bib_title: null,
          bib_isbn: null,
          matched_values: [],
        };

        // 3.1 ISBN match（精確）
        if (isbn) {
          const ids = bibIdsByIsbn.get(isbn) ?? [];
          if (ids.length === 1) {
            match = { ...match, by: 'isbn', bib_id: ids[0]!, matched_values: [isbn] };
            matchedByIsbn += 1;
          } else if (ids.length > 1) {
            warnings.push({
              record_index: i,
              code: 'DEDUP_AMBIGUOUS_ISBN',
              message: 'Multiple bibs matched by ISBN',
              details: { isbn, bib_ids: ids },
            });
          }
        }

        // 3.2 035 match（若 ISBN 未命中）
        if (!match.bib_id && values035.length > 0) {
          const ids = new Set<string>();
          const matchedValues: string[] = [];

          for (const v of values035) {
            const list = bibIdsBy035.get(v) ?? [];
            if (list.length > 0) matchedValues.push(v);
            for (const id of list) ids.add(id);
          }

          if (ids.size === 1) {
            const only = Array.from(ids)[0]!;
            match = { ...match, by: '035', bib_id: only, matched_values: matchedValues };
            matchedBy035 += 1;
          } else if (ids.size > 1) {
            warnings.push({
              record_index: i,
              code: 'DEDUP_AMBIGUOUS_035',
              message: 'Multiple bibs matched by 035 identifiers',
              details: { identifiers_035: values035, matched_bib_ids: Array.from(ids) },
            });
          }
        }

        const suggested: MarcImportDecision = match.bib_id ? 'update' : 'create';

        // UI 若提供 override，則使用它；否則沿用 suggested
        const override = decisionOverrides.get(i) ?? null;
        const decision = override?.decision ?? suggested;

        let targetBibId: string | null = null;
        if (decision === 'update') {
          targetBibId = override?.target_bib_id ?? match.bib_id;
          if (!targetBibId) {
            errors.push({
              record_index: i,
              code: 'MISSING_TARGET_BIB_ID',
              message: 'decision=update requires target_bib_id (or a dedupe match)',
            });
          }
        }

        plans.push({
          record_index: i,
          bib: rec.bib,
          marc_extras_count: rec.marc_extras?.length ?? 0,
          isbn,
          identifiers_035: values035,
          match,
          suggested_decision: suggested,
          decision,
          target_bib_id: targetBibId,
        });
      }

      // 4) 取回 match bib 的摘要（title/isbn），讓 preview 更好讀
      const matchedIds = uniqStrings(plans.map((p) => p.match.bib_id).filter(Boolean));
      const summaries = await this.getBibSummariesByIds(client, orgId, matchedIds);
      for (const p of plans) {
        if (!p.match.bib_id) continue;
        const s = summaries.get(p.match.bib_id);
        if (!s) continue;
        p.match = { ...p.match, bib_title: s.title, bib_isbn: s.isbn };
      }

      // 4.5) marc_extras：authority linking 驗證（$0=urn:uuid）
      //
      // 你要的方向是「不要再靠字串長相」，而是逐步改成 term_id-driven。
      // 在 marc_extras 這條管線，我們把 term_id 放在 `$0=urn:uuid:<term_id>`：
      // - 因此在匯入 preview/apply 前，必須確保：
      //   1) term_id 存在（同 org）
      //   2) tag-kind 對映正確（例如 651 必須指到 kind=geographic）
      //   3) 若提供 `$2`，必須與 term.vocabulary_code 一致
      //
      // 注意：
      // - 只檢查 `urn:uuid:`（本系統 term_id）；外部 `$0` URI 不在這裡驗證（避免誤擋匯入資料）
      // - 只驗 decision!=skip 的 records（避免對「不會寫入」的資料報錯造成混亂）
      if (saveMarcExtras) {
        const recordsToValidate = plans
          .filter((p) => p.decision !== 'skip')
          .map((p) => ({ record_index: p.record_index, marc_extras: input.records[p.record_index]?.marc_extras ?? null }))
          .filter((x): x is { record_index: number; marc_extras: MarcField[] } => Array.isArray(x.marc_extras));

        const allTermIds = uniqStrings(
          recordsToValidate.flatMap((r) => this.collectAuthorityTermIdsFromMarcExtras(r.marc_extras)),
        );
        const termsById = await this.getAuthorityTermsByIds(client, orgId, allTermIds);

        for (const r of recordsToValidate) {
          const violations = this.validateMarcExtrasAuthorityLinksAgainstMap(r.marc_extras, termsById);
          for (const v of violations) {
            errors.push({
              record_index: r.record_index,
              code: `MARC_EXTRAS_${v.code}`,
              message: v.message,
              details: v.details,
            });
          }
        }
      }

      // 5) summary
      const toCreate = plans.filter((p) => p.decision === 'create').length;
      const toUpdate = plans.filter((p) => p.decision === 'update').length;
      const toSkip = plans.filter((p) => p.decision === 'skip').length;

      const errorRecordIndexes = new Set(errors.map((e) => e.record_index));
      const invalidRecords = errorRecordIndexes.size;
      const validRecords = plans.length - invalidRecords;

      const summary: MarcImportSummary = {
        total_records: plans.length,
        valid_records: validRecords,
        invalid_records: invalidRecords,
        to_create: toCreate,
        to_update: toUpdate,
        to_skip: toSkip,
        matched_by_isbn: matchedByIsbn,
        matched_by_035: matchedBy035,
      };

      const preview: MarcImportPreviewResult = {
        mode: 'preview',
        source: { records: plans.length, sha256, source_filename: input.source_filename ?? null },
        options: { save_marc_extras: saveMarcExtras, upsert_authority_terms: upsertAuthorityTerms, authority_vocabulary_code: authorityVocabularyCode },
        summary,
        warnings,
        errors,
        records: plans,
      };

      if (mode === 'preview') return preview;

      // apply：若 preview 有任何錯誤，就拒絕寫入（避免半套/半成功）
      if (errors.length > 0) {
        throw new BadRequestException({
          error: {
            code: 'MARC_IMPORT_HAS_ERRORS',
            message: 'MARC import has errors; fix them in preview before apply',
            details: { errors },
          },
        });
      }

      // apply：再做一次「target bib 是否存在」驗證（避免傳入不存在的 id）
      const targetIds = uniqStrings(plans.map((p) => p.target_bib_id).filter(Boolean));
      const existingTargetIds = await this.getBibsByIds(client, orgId, targetIds);
      for (const p of plans) {
        if (p.decision !== 'update') continue;
        if (!p.target_bib_id) continue;
        if (!existingTargetIds.has(p.target_bib_id)) {
          throw new NotFoundException({
            error: { code: 'NOT_FOUND', message: 'Target bibliographic record not found', details: { record_index: p.record_index, bib_id: p.target_bib_id } },
          });
        }
      }

      // 6) 可選：補齊 authority terms（一次塞完，避免逐筆 INSERT 太慢）
      if (upsertAuthorityTerms) {
        const names = uniqStrings(
          plans
            .filter((p) => p.decision !== 'skip')
            .flatMap((p) => [...(p.bib.creators ?? []), ...(p.bib.contributors ?? [])]),
        );
        const subjects = uniqStrings(plans.filter((p) => p.decision !== 'skip').flatMap((p) => p.bib.subjects ?? []));
        const geographics = uniqStrings(plans.filter((p) => p.decision !== 'skip').flatMap((p) => p.bib.geographics ?? []));
        const genres = uniqStrings(plans.filter((p) => p.decision !== 'skip').flatMap((p) => p.bib.genres ?? []));

        await this.upsertAuthorityTerms(client, orgId, 'name', authorityVocabularyCode, names, 'marc-import-batch');
        await this.upsertAuthorityTerms(client, orgId, 'subject', authorityVocabularyCode, subjects, 'marc-import-batch');
        await this.upsertAuthorityTerms(client, orgId, 'geographic', authorityVocabularyCode, geographics, 'marc-import-batch');
        await this.upsertAuthorityTerms(client, orgId, 'genre', authorityVocabularyCode, genres, 'marc-import-batch');
      }

      // 7) 寫入 bibs（交易內）
      const results: Array<{ record_index: number; decision: MarcImportDecision; bib_id: string | null }> = [];

      for (const p of plans) {
        const rec = input.records[p.record_index]!;

        if (p.decision === 'skip') {
          results.push({ record_index: p.record_index, decision: 'skip', bib_id: null });
          continue;
        }

        if (p.decision === 'create') {
          // create：先建一筆「最小書目」，再用 updateBibliographicInTransaction 做正規化/authority linking
          // - 好處：匯入與一般 update 走同一套規則（subjects + names + 651/655）
          // - 也避免這裡重複寫一套「欄位/links 同步」的邏輯
          const created = await client.query<{ id: string }>(
            `
            INSERT INTO bibliographic_records (
              organization_id,
              title
            )
            VALUES ($1, $2)
            RETURNING id
            `,
            [orgId, rec.bib.title],
          );

          const bibId = created.rows[0]!.id;

          await this.updateBibliographicInTransaction(
            client,
            orgId,
            bibId,
            rec.bib,
            { vocabulary_code_for_new: authorityVocabularyCode, source_for_new: 'marc-import-batch' },
          );

          if (saveMarcExtras && rec.marc_extras) {
            await client.query(
              `
              UPDATE bibliographic_records
              SET marc_extras = $3::jsonb, updated_at = now()
              WHERE organization_id = $1
                AND id = $2
              `,
              [orgId, bibId, JSON.stringify(rec.marc_extras)],
            );
          }

          // 035 identifiers：用於後續 dedupe（不要求 unique；同 bib 內先去重）
          await this.replaceBibIdentifiers(client, orgId, bibId, '035', extract035Values(rec.marc_extras ?? null));

          results.push({ record_index: p.record_index, decision: 'create', bib_id: bibId });
          continue;
        }

        // update
        const targetBibId = p.target_bib_id!;

        await this.updateBibliographicInTransaction(
          client,
          orgId,
          targetBibId,
          rec.bib,
          { vocabulary_code_for_new: authorityVocabularyCode, source_for_new: 'marc-import-batch' },
        );

        if (saveMarcExtras && rec.marc_extras) {
          await client.query(
            `
            UPDATE bibliographic_records
            SET marc_extras = $3::jsonb, updated_at = now()
            WHERE organization_id = $1
              AND id = $2
            `,
            [orgId, targetBibId, JSON.stringify(rec.marc_extras)],
          );
        }

        await this.replaceBibIdentifiers(client, orgId, targetBibId, '035', extract035Values(rec.marc_extras ?? null));

        results.push({ record_index: p.record_index, decision: 'update', bib_id: targetBibId });
      }

      // 8) 寫 audit（批次匯入只寫一筆，避免 audit 表爆量）
      const audit = await client.query<{ id: string }>(
        `
        INSERT INTO audit_events (
          organization_id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING id
        `,
        [
          orgId,
          input.actor_user_id,
          'catalog.import_marc',
          'catalog_import',
          sha256,
          JSON.stringify({
            source_filename: input.source_filename ?? null,
            source_note: input.source_note ?? null,
            options: {
              save_marc_extras: saveMarcExtras,
              upsert_authority_terms: upsertAuthorityTerms,
              authority_vocabulary_code: authorityVocabularyCode,
            },
            summary,
          }),
        ],
      );

      const applyResult: MarcImportApplyResult = { mode: 'apply', summary, audit_event_id: audit.rows[0]!.id, results };
      return applyResult;
    };

    // preview：只需要 read-only；apply：需要交易（BEGIN/COMMIT）
    if (mode === 'preview') return await this.db.withClient(run);
    return await this.db.transaction(run);
  }

  /**
   * US-022：書目/冊 CSV 匯入（preview/apply）
   *
   * POST /api/v1/orgs/:orgId/bibs/import
   *
   * 設計（沿用 users/import 模式）：
   * - preview：不寫 DB，只回傳「會新增/更新」的計畫與錯誤
   * - apply：寫 DB + 寫 audit_events（action=catalog.import_csv）
   */
  async importCatalogCsv(orgId: string, input: ImportCatalogCsvInput): Promise<CatalogCsvImportResult> {
    // 這個 method 會做大量 DB 讀寫，因此用 try/catch 把常見的 Postgres 格式錯誤轉成 400
    // - 例如 location_id/bibliographic_id 不是 UUID、acquired_at 不是有效日期
    try {
      return await this.db.transaction(async (client) => {
      // 1) 權限（MVP）：匯入者必須是 staff（admin/librarian 且 active）
      await this.requireStaffActor(client, orgId, input.actor_user_id);

      // 2) 解析 CSV → header + data rows
      const parsed = parseCsv(input.csv_text);
      if (parsed.records.length === 0) {
        throw new BadRequestException({
          error: { code: 'CSV_EMPTY', message: 'CSV is empty' },
        });
      }

      const header = (parsed.records[0] ?? []).map((h) => h.trim());
      if (header.length === 0 || header.every((h) => !h)) {
        throw new BadRequestException({
          error: { code: 'CSV_HEADER_EMPTY', message: 'CSV header row is empty' },
        });
      }

      // sha256：追溯「匯入的是哪一份內容」（不存原文，避免太大/含敏感資訊）
      const sha256 = createHash('sha256').update(input.csv_text, 'utf8').digest('hex');

      // 3) header mapping：把不同命名映射成 canonical columns
      const columnIndex = this.resolveCatalogImportColumns(header);

      // 4) 必要欄位檢查（至少要有 barcode + call_number）
      if (columnIndex.barcode === null || columnIndex.call_number === null) {
        throw new BadRequestException({
          error: {
            code: 'CSV_MISSING_REQUIRED_COLUMNS',
            message: 'CSV must include required columns: barcode, call_number',
            details: { required: ['barcode', 'call_number'], header },
          },
        });
      }

      // 5) 匯入選項（提供預設值，避免前端沒送就變成 undefined）
      const defaultLocationId = input.default_location_id ?? null;
      const updateExistingItems = input.update_existing_items ?? true;
      const allowRelinkBibliographic = input.allow_relink_bibliographic ?? false;

      // 若使用 default_location_id，先驗證它存在且 active（避免整批資料都掉到停用館別）
      if (defaultLocationId) {
        await this.assertLocationIdActive(client, orgId, defaultLocationId);
      }

      // 6) 逐列解析 + 檔案層驗證（不含 DB 狀態）
      const errors: ImportRowError[] = [];
      const normalizedRows: NormalizedRow[] = [];

      const dataRows = parsed.records.slice(1);

      // barcode 在 CSV 內也必須唯一（避免同一冊被兩列不同資料互相覆蓋）
      const barcodeSeen = new Set<string>();

      for (let i = 0; i < dataRows.length; i += 1) {
        const row = dataRows[i] ?? [];
        const rowNumber = i + 2;

        if (row.length !== header.length) {
          errors.push({
            row_number: rowNumber,
            code: 'CSV_COLUMN_COUNT_MISMATCH',
            message: `Column count mismatch: expected ${header.length}, got ${row.length}`,
            field: 'csv',
          });
        }

        const getCell = (idx: number | null) => {
          if (idx === null) return '';
          return (row[idx] ?? '').trim();
        };

        const barcode = getCell(columnIndex.barcode);
        const callNumber = getCell(columnIndex.call_number);

        if (!barcode) {
          errors.push({
            row_number: rowNumber,
            code: 'MISSING_BARCODE',
            message: 'barcode is required',
            field: 'barcode',
          });
          continue;
        }
        if (barcode.length > 64) {
          errors.push({
            row_number: rowNumber,
            code: 'BARCODE_TOO_LONG',
            message: 'barcode is too long (max 64)',
            field: 'barcode',
          });
          continue;
        }
        if (barcodeSeen.has(barcode)) {
          errors.push({
            row_number: rowNumber,
            code: 'DUPLICATE_BARCODE_IN_CSV',
            message: 'barcode is duplicated in CSV',
            field: 'barcode',
            details: { barcode },
          });
          continue;
        }
        barcodeSeen.add(barcode);

        if (!callNumber) {
          errors.push({
            row_number: rowNumber,
            code: 'MISSING_CALL_NUMBER',
            message: 'call_number is required',
            field: 'call_number',
          });
          continue;
        }
        if (callNumber.length > 200) {
          errors.push({
            row_number: rowNumber,
            code: 'CALL_NUMBER_TOO_LONG',
            message: 'call_number is too long (max 200)',
            field: 'call_number',
          });
          continue;
        }

        // location：可用 location_id / location_code / default_location_id 三擇一
        const locationIdFromCsv = getCell(columnIndex.location_id);
        const locationCodeFromCsv = getCell(columnIndex.location_code);

        if (locationIdFromCsv && !isUuid(locationIdFromCsv)) {
          errors.push({
            row_number: rowNumber,
            code: 'INVALID_LOCATION_ID',
            message: 'location_id must be a UUID',
            field: 'location_id',
            details: { value: locationIdFromCsv },
          });
          continue;
        }

        const locationId =
          locationIdFromCsv || (locationCodeFromCsv ? `code:${locationCodeFromCsv}` : '') || defaultLocationId || '';

        if (!locationId) {
          errors.push({
            row_number: rowNumber,
            code: 'MISSING_LOCATION',
            message: 'location_id/location_code is required (or provide default_location_id)',
            field: 'location_id',
          });
          continue;
        }

        // status：MVP 匯入只允許「主檔狀態」（避免把交易狀態塞進來）
        const statusRaw = getCell(columnIndex.status);
        const status = this.parseItemStatusForImport(statusRaw);
        if (!status) {
          errors.push({
            row_number: rowNumber,
            code: 'INVALID_ITEM_STATUS',
            message: 'Invalid item status for import',
            field: 'status',
            details: { value: statusRaw },
          });
          continue;
        }

        // acquired_at：先留字串，交給 DB parse（apply 時若格式錯會回 22P02/22007）
        const acquiredAtRaw = getCell(columnIndex.acquired_at);
        if (acquiredAtRaw) {
          const d = new Date(acquiredAtRaw);
          if (Number.isNaN(d.getTime())) {
            errors.push({
              row_number: rowNumber,
              code: 'INVALID_ACQUIRED_AT',
              message: 'acquired_at must be a valid datetime string (recommended: ISO 8601)',
              field: 'acquired_at',
              details: { value: acquiredAtRaw },
            });
            continue;
          }
        }
        const acquiredAt = acquiredAtRaw ? acquiredAtRaw : null;

        const notesRaw = getCell(columnIndex.notes);
        const notes = notesRaw ? notesRaw : null;

        // bib reference / fields
        const bibIdRaw = getCell(columnIndex.bibliographic_id);
        if (bibIdRaw && !isUuid(bibIdRaw)) {
          errors.push({
            row_number: rowNumber,
            code: 'INVALID_BIBLIOGRAPHIC_ID',
            message: 'bibliographic_id must be a UUID',
            field: 'bibliographic_id',
            details: { value: bibIdRaw },
          });
          continue;
        }
        const isbnRaw = getCell(columnIndex.isbn);
        const titleRaw = getCell(columnIndex.title);

        const creatorsRaw = getCell(columnIndex.creators);
        const subjectsRaw = getCell(columnIndex.subjects);

        const publisherRaw = getCell(columnIndex.publisher);
        const publishedYearRaw = getCell(columnIndex.published_year);
        const languageRaw = getCell(columnIndex.language);
        const classificationRaw = getCell(columnIndex.classification);

        // published_year：若有提供，必須可轉 int
        let publishedYearParsed: number | null = null;
        if (publishedYearRaw) {
          const n = Number.parseInt(publishedYearRaw, 10);
          if (!Number.isFinite(n) || n < 0) {
            errors.push({
              row_number: rowNumber,
              code: 'INVALID_PUBLISHED_YEAR',
              message: 'published_year must be an integer',
              field: 'published_year',
              details: { value: publishedYearRaw },
            });
            continue;
          }
          publishedYearParsed = n;
        }

        // 如果沒有 bibliographic_id 也沒有 isbn，就必須要有 title 才能建立新書目
        if (!bibIdRaw && !isbnRaw && !titleRaw) {
          errors.push({
            row_number: rowNumber,
            code: 'MISSING_BIB_REFERENCE',
            message: 'bibliographic_id or isbn or title is required to link/create bibliographic record',
            field: 'bibliographic_id',
          });
          continue;
        }

        normalizedRows.push({
          row_number: rowNumber,
          barcode,
          call_number: callNumber,
          // location_id 這裡先用「可能是 UUID 或 code:xxx」的暫存值，稍後再解析成真正 UUID
          location_id: locationId,
          status,
          acquired_at: acquiredAt,
          notes,
          bibliographic_id: bibIdRaw || null,
          isbn: isbnRaw || null,
          title: titleRaw || null,
          creators: creatorsRaw ? this.parseList(creatorsRaw) : null,
          publisher: publisherRaw || null,
          published_year: publishedYearParsed ?? null,
          language: languageRaw || null,
          subjects: subjectsRaw ? this.parseList(subjectsRaw) : null,
          classification: classificationRaw || null,
        });
      }

      // 7) DB 狀態查詢（批次查，避免 N+1）
      const barcodes = normalizedRows.map((r) => r.barcode);
      const existingItems = await this.getItemsByBarcodes(client, orgId, barcodes);

      // locations：支援 location_code
      const locationCodes = normalizedRows
        .map((r) => (r.location_id.startsWith('code:') ? r.location_id.slice('code:'.length) : ''))
        .filter((v) => v);
      const locationsByCode = await this.getLocationsByCodes(client, orgId, locationCodes);

      const locationIdsFromCsv = normalizedRows
        .map((r) => (!r.location_id.startsWith('code:') ? r.location_id : ''))
        .filter((v) => v && v !== defaultLocationId);
      const locationsById = await this.getLocationsByIds(client, orgId, locationIdsFromCsv);

      // bibs：bibliographic_id / isbn 兩種 lookup
      const bibIds = normalizedRows.map((r) => r.bibliographic_id).filter((v): v is string => Boolean(v));
      const bibsById = await this.getBibsByIds(client, orgId, bibIds);

      const isbns = normalizedRows
        .map((r) => r.isbn)
        .filter((v): v is string => Boolean(v));
      const bibsByIsbn = await this.getBibsByIsbns(client, orgId, isbns);

      // 8) 建立 row plans（合併檔案層 + DB 層結果）
      const plans: RowPlan[] = [];

      // toCreateBibs：bib_key → 待建立書目資料（apply 時一次建立）
      const bibsToCreate = new Map<string, Pick<NormalizedRow, 'title' | 'creators' | 'publisher' | 'published_year' | 'language' | 'subjects' | 'isbn' | 'classification'>>();

      for (const row of normalizedRows) {
        // location_id resolve
        let locationIdResolved: string | null = null;
        if (row.location_id.startsWith('code:')) {
          const code = row.location_id.slice('code:'.length);
          const found = locationsByCode.get(code);
          if (!found) {
            errors.push({
              row_number: row.row_number,
              code: 'LOCATION_CODE_NOT_FOUND',
              message: 'location_code not found',
              field: 'location_code',
              details: { code },
            });
            continue;
          }
          locationIdResolved = found.id;
        } else {
          // location_id 直接給 UUID
          if (defaultLocationId && row.location_id === defaultLocationId) {
            locationIdResolved = defaultLocationId;
          } else {
            const exists = locationsById.has(row.location_id);
            if (!exists) {
              errors.push({
                row_number: row.row_number,
                code: 'LOCATION_ID_NOT_FOUND',
                message: 'location_id not found',
                field: 'location_id',
                details: { location_id: row.location_id },
              });
              continue;
            }
            locationIdResolved = row.location_id;
          }
        }

        // bib resolve
        let bibAction: RowPlan['bib_action'] = 'use_existing';
        let bibKey = '';
        let resolvedBibId: string | null = null;

        if (row.bibliographic_id) {
          if (!bibsById.has(row.bibliographic_id)) {
            errors.push({
              row_number: row.row_number,
              code: 'BIB_ID_NOT_FOUND',
              message: 'bibliographic_id not found',
              field: 'bibliographic_id',
              details: { bibliographic_id: row.bibliographic_id },
            });
            continue;
          }
          resolvedBibId = row.bibliographic_id;
          bibKey = `id:${row.bibliographic_id}`;
        } else if (row.isbn) {
          const ids = bibsByIsbn.get(row.isbn) ?? [];
          if (ids.length > 1) {
            errors.push({
              row_number: row.row_number,
              code: 'DUPLICATE_ISBN_IN_DB',
              message: 'Multiple bibliographic records found for same ISBN; cannot decide which to use',
              field: 'isbn',
              details: { isbn: row.isbn, bib_ids: ids },
            });
            continue;
          }
          if (ids.length === 1) {
            resolvedBibId = ids[0]!;
            bibKey = `isbn:${row.isbn}`;
          } else {
            // ISBN 不存在 → 需要建立新書目
            bibAction = 'create_new';
            bibKey = `isbn:${row.isbn}`;
          }
        } else {
          // 沒有 bibliographic_id、沒有 isbn：以 title 建立新書目
          bibAction = 'create_new';
          bibKey = `title:${hashDedupeKey({
            title: row.title ?? '',
            creators: row.creators ?? [],
            publisher: row.publisher ?? '',
            published_year: row.published_year ?? null,
          })}`;
        }

        // 若需要建立新書目，title 必須存在（否則無法建立）
        if (bibAction === 'create_new') {
          if (!row.title) {
            errors.push({
              row_number: row.row_number,
              code: 'MISSING_TITLE_FOR_NEW_BIB',
              message: 'title is required to create bibliographic record',
              field: 'title',
            });
            continue;
          }

          // 去重：同一 bib_key 只建立一次（apply 時會一次 insert）
          if (!bibsToCreate.has(bibKey)) {
            bibsToCreate.set(bibKey, {
              title: row.title,
              creators: row.creators,
              publisher: row.publisher,
              published_year: row.published_year,
              language: row.language,
              subjects: row.subjects,
              isbn: row.isbn,
              classification: row.classification,
            });
          }
        }

        // item action
        const existing = existingItems.get(row.barcode) ?? null;
        let itemAction: RowPlan['item_action'] = existing ? 'update' : 'create';

        if (existing && !updateExistingItems) {
          // MVP：若不允許更新，直接視為 invalid（因為使用者通常期待「匯入會生效」）
          errors.push({
            row_number: row.row_number,
            code: 'ITEM_EXISTS_UPDATE_DISABLED',
            message: 'Item already exists but update_existing_items=false',
            field: 'barcode',
            details: { barcode: row.barcode, item_id: existing.id },
          });
          continue;
        }

        // 若 item 已存在且不允許 relink，但本次匯入要指向不同 bib → 擋下
        // - 這是高風險操作（會讓既有借還歷史「看起來像換了一本書」）
        if (existing && !allowRelinkBibliographic) {
          // resolvedBibId：只有在 use_existing 時才一定有；create_new 的 bib 會在 apply 才產生 id
          if (bibAction !== 'use_existing') {
            errors.push({
              row_number: row.row_number,
              code: 'ITEM_EXISTS_BIB_RELINK_NOT_ALLOWED',
              message: 'Existing item cannot be relinked to a new bibliographic record (allow_relink_bibliographic=false)',
              field: 'bibliographic_id',
              details: { barcode: row.barcode, existing_bibliographic_id: existing.bibliographic_id },
            });
            continue;
          }

          if (resolvedBibId && existing.bibliographic_id !== resolvedBibId) {
            errors.push({
              row_number: row.row_number,
              code: 'ITEM_EXISTS_BIB_MISMATCH',
              message: 'Existing item is linked to a different bibliographic record',
              field: 'bibliographic_id',
              details: {
                barcode: row.barcode,
                existing_bibliographic_id: existing.bibliographic_id,
                requested_bibliographic_id: resolvedBibId,
              },
            });
            continue;
          }
        }

        plans.push({
          ...row,
          location_id: locationIdResolved,
          bibliographic_id: resolvedBibId,
          bib_action: bibAction,
          bib_key: bibKey,
          item_action: itemAction,
        });
      }

      // 9) summary
      const summary: ImportSummary = {
        total_rows: dataRows.length,
        valid_rows: plans.length,
        invalid_rows: Math.max(0, dataRows.length - plans.length),
        bibs_to_create: bibsToCreate.size,
        items_to_create: plans.filter((p) => p.item_action === 'create').length,
        items_to_update: plans.filter((p) => p.item_action === 'update').length,
      };

      // preview：只回傳計畫與錯誤（不寫入）
      if (input.mode === 'preview') {
        const bibsToCreatePreview = Array.from(bibsToCreate.entries())
          .slice(0, 50)
          .map(([bib_key, bib]) => ({ bib_key, title: bib.title, isbn: bib.isbn ?? null }));

        return {
          mode: 'preview',
          csv: { header, sha256 },
          options: {
            default_location_id: defaultLocationId,
            update_existing_items: updateExistingItems,
            allow_relink_bibliographic: allowRelinkBibliographic,
          },
          summary,
          errors,
          rows: plans.slice(0, 200),
          bibs_to_create_preview: bibsToCreatePreview,
        };
      }

      // apply：若仍有錯誤，拒絕寫入（讓前端能把錯誤列出來修 CSV）
      if (errors.length > 0) {
        throw new BadRequestException({
          error: {
            code: 'CSV_HAS_ERRORS',
            message: 'CSV has errors; fix them before apply',
            details: { errors },
          },
        });
      }

      // 10) apply：先建立所有需要的新書目（集中建立，避免同一本建多次）
      const createdBibIds = new Map<string, string>();
      for (const [bibKey, bib] of bibsToCreate.entries()) {
        // subjects 正規化 + term_id linking（CSV 匯入也要落實「先正規化再落庫」）
        const resolvedSubjects = await this.resolveSubjectTermsForWrite(
          client,
          orgId,
          { subjects: bib.subjects },
          { vocabulary_code_for_new: 'local', source_for_new: 'csv-import' },
        );

        const inserted = await client.query<{ id: string }>(
          `
          INSERT INTO bibliographic_records (
            organization_id,
            title,
            creators,
            publisher,
            published_year,
            language,
            subjects,
            isbn,
            classification
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
          `,
          [
            orgId,
            bib.title,
            bib.creators ?? null,
            bib.publisher ?? null,
            bib.published_year ?? null,
            bib.language ?? null,
            resolvedSubjects !== null ? resolvedSubjects.subjects : bib.subjects ?? null,
            bib.isbn ?? null,
            bib.classification ?? null,
          ],
        );

        const bibId = inserted.rows[0]!.id;
        createdBibIds.set(bibKey, bibId);

        if (resolvedSubjects) {
          await this.replaceBibSubjectTerms(client, orgId, bibId, resolvedSubjects.subject_term_ids);
        }
      }

      // 11) apply：upsert items（以 barcode 作為唯一鍵）
      // - allow_relink_bibliographic=false 時，update 不改 bibliographic_id（前面已驗證不會 mismatch）
      for (const plan of plans) {
        const bibId =
          plan.bibliographic_id ??
          createdBibIds.get(plan.bib_key) ??
          null;

        if (!bibId) {
          // 理論上不會發生（因為 plan 已建立 bib_key），這裡保留保險防呆
          throw new BadRequestException({
            error: { code: 'BIB_RESOLUTION_FAILED', message: 'Failed to resolve bibliographic_id for item' },
          });
        }

        // upsert：如果已存在就更新（或不更新 bibliographic_id）
        await client.query(
          `
          INSERT INTO item_copies (
            organization_id,
            bibliographic_id,
            barcode,
            call_number,
            location_id,
            status,
            acquired_at,
            notes
          )
          VALUES ($1, $2, $3, $4, $5, $6::item_status, $7::timestamptz, $8)
          ON CONFLICT (organization_id, barcode)
          DO UPDATE SET
            call_number = EXCLUDED.call_number,
            location_id = EXCLUDED.location_id,
            status = EXCLUDED.status,
            acquired_at = EXCLUDED.acquired_at,
            notes = EXCLUDED.notes,
            updated_at = now()
            ${allowRelinkBibliographic ? ', bibliographic_id = EXCLUDED.bibliographic_id' : ''}
          `,
          [
            orgId,
            bibId,
            plan.barcode,
            plan.call_number,
            plan.location_id,
            plan.status,
            plan.acquired_at,
            plan.notes,
          ],
        );
      }

      // 12) 寫 audit（批次匯入只寫一筆，避免 audit 表爆量）
      const audit = await client.query<{ id: string }>(
        `
        INSERT INTO audit_events (
          organization_id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING id
        `,
        [
          orgId,
          input.actor_user_id,
          'catalog.import_csv',
          'catalog_import',
          sha256,
          JSON.stringify({
            csv_sha256: sha256,
            source_filename: input.source_filename ?? null,
            source_note: input.source_note ?? null,
            options: {
              default_location_id: defaultLocationId,
              update_existing_items: updateExistingItems,
              allow_relink_bibliographic: allowRelinkBibliographic,
            },
            summary,
          }),
        ],
      );

      return { mode: 'apply', summary, audit_event_id: audit.rows[0]!.id };
      });
    } catch (error: any) {
      // 22P02：UUID/enum 轉型失敗；22007：日期格式錯誤（timestamptz）
      if (error?.code === '22P02' || error?.code === '22007') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid CSV format' },
        });
      }
      throw error;
    }
  }

  // ----------------------------
  // helpers（US-022）
  // ----------------------------

  private async requireStaffActor(client: PoolClient, orgId: string, actorUserId: string) {
    const result = await client.query<ActorRow>(
      `
      SELECT id, role, status
      FROM users
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, actorUserId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Actor user not found' },
      });
    }

    const actor = result.rows[0]!;

    if (actor.status !== 'active') {
      throw new ConflictException({
        error: { code: 'USER_INACTIVE', message: 'Actor user is inactive' },
      });
    }

    if (!STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to import catalog' },
      });
    }

    return actor;
  }

  /**
   * header mapping：把 CSV header 映射成 canonical columns
   *
   * 目標：容忍學校現場常見的 header 命名差異（中文/英文、底線/大小寫）
   */
  private resolveCatalogImportColumns(header: string[]): Record<CatalogCanonicalColumn, number | null> {
    const columns: CatalogCanonicalColumn[] = [
      'barcode',
      'call_number',
      'location_code',
      'location_id',
      'status',
      'acquired_at',
      'notes',
      'bibliographic_id',
      'title',
      'creators',
      'publisher',
      'published_year',
      'language',
      'subjects',
      'isbn',
      'classification',
    ];

    const index: Record<CatalogCanonicalColumn, number | null> = Object.fromEntries(
      columns.map((c) => [c, null]),
    ) as Record<CatalogCanonicalColumn, number | null>;

    const normalizeKey = (raw: string) =>
      raw
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[_-]/g, '');

    const aliasToCanonical: Record<string, CatalogCanonicalColumn> = {
      // item
      barcode: 'barcode',
      itembarcode: 'barcode',
      冊條碼: 'barcode',
      條碼: 'barcode',

      callnumber: 'call_number',
      call_number: 'call_number',
      索書號: 'call_number',

      locationcode: 'location_code',
      location_code: 'location_code',
      館別: 'location_code',
      位置: 'location_code',
      館別代碼: 'location_code',

      locationid: 'location_id',
      location_id: 'location_id',

      status: 'status',
      itemstatus: 'status',
      冊狀態: 'status',

      acquiredat: 'acquired_at',
      acquired_at: 'acquired_at',
      入館日期: 'acquired_at',
      購置日期: 'acquired_at',

      notes: 'notes',
      備註: 'notes',

      // bib link
      bibliographicid: 'bibliographic_id',
      bibliographic_id: 'bibliographic_id',
      bibid: 'bibliographic_id',
      書目id: 'bibliographic_id',
      書目ID: 'bibliographic_id',

      // bib fields
      title: 'title',
      題名: 'title',
      書名: 'title',

      creators: 'creators',
      author: 'creators',
      作者: 'creators',
      著者: 'creators',

      publisher: 'publisher',
      出版者: 'publisher',

      publishedyear: 'published_year',
      published_year: 'published_year',
      出版年: 'published_year',
      年份: 'published_year',

      language: 'language',
      語言: 'language',

      subjects: 'subjects',
      subject: 'subjects',
      主題: 'subjects',
      主題詞: 'subjects',

      isbn: 'isbn',
      ISBN: 'isbn',

      classification: 'classification',
      分類: 'classification',
      分類號: 'classification',
    };

    for (let i = 0; i < header.length; i += 1) {
      const raw = header[i] ?? '';
      const key = normalizeKey(raw);
      if (!key) continue;

      const canonical = aliasToCanonical[key];
      if (!canonical) continue;

      if (index[canonical] !== null) {
        throw new BadRequestException({
          error: {
            code: 'CSV_DUPLICATE_HEADER',
            message: `CSV header has duplicated mapping for column: ${canonical}`,
            details: { header },
          },
        });
      }

      index[canonical] = i;
    }

    return index;
  }

  private parseItemStatusForImport(value: string): ItemStatus | null {
    const trimmed = value.trim();

    // 空白：預設 available（最常見）
    if (!trimmed) return 'available';

    const lowered = trimmed.toLowerCase();

    // 匯入允許的狀態（主檔狀態）
    if (lowered === 'available') return 'available';
    if (lowered === 'lost') return 'lost';
    if (lowered === 'withdrawn') return 'withdrawn';
    if (lowered === 'repair') return 'repair';

    // 中文常見
    if (trimmed === '在架') return 'available';
    if (trimmed === '可借') return 'available';
    if (trimmed === '遺失') return 'lost';
    if (trimmed === '報廢') return 'withdrawn';
    if (trimmed === '修復') return 'repair';
    if (trimmed === '修復中') return 'repair';

    // 交易狀態（checked_out/on_hold）不允許由匯入直接設定
    // - 避免把「借還流程」繞過、造成 loans/items/holds 不一致
    if (lowered === 'checked_out' || lowered === 'on_hold') return null;

    return null;
  }

  private parseList(value: string): string[] {
    // 支援常見分隔：; | 、 （學校 Excel 轉出常見）
    const parts = value
      .split(/[;|、]/g)
      .map((p) => p.trim())
      .filter((p) => p);

    // 去重（保持順序），避免 text[] 內大量重複
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
    return out;
  }

  private async getItemsByBarcodes(client: PoolClient, orgId: string, barcodes: string[]) {
    if (barcodes.length === 0) return new Map<string, ExistingItemByBarcodeRow>();

    const result = await client.query<ExistingItemByBarcodeRow>(
      `
      SELECT id, barcode, bibliographic_id
      FROM item_copies
      WHERE organization_id = $1
        AND barcode = ANY($2::text[])
      `,
      [orgId, barcodes],
    );

    const map = new Map<string, ExistingItemByBarcodeRow>();
    for (const row of result.rows) map.set(row.barcode, row);
    return map;
  }

  private async getLocationsByCodes(client: PoolClient, orgId: string, codes: string[]) {
    if (codes.length === 0) return new Map<string, LocationByCodeRow>();

    const result = await client.query<LocationByCodeRow>(
      `
      SELECT id, code
      FROM locations
      WHERE organization_id = $1
        AND code = ANY($2::text[])
        AND status = 'active'
      `,
      [orgId, codes],
    );

    const map = new Map<string, LocationByCodeRow>();
    for (const row of result.rows) map.set(row.code, row);
    return map;
  }

  private async getLocationsByIds(client: PoolClient, orgId: string, ids: string[]) {
    if (ids.length === 0) return new Set<string>();

    const result = await client.query<LocationByIdRow>(
      `
      SELECT id
      FROM locations
      WHERE organization_id = $1
        AND id = ANY($2::uuid[])
        AND status = 'active'
      `,
      [orgId, ids],
    );

    return new Set(result.rows.map((r) => r.id));
  }

  /**
   * assertLocationIdActive：驗證 location 存在且 active（Catalog Import 用）
   *
   * 需求（US-001 + 匯入）：
   * - locations.status=inactive 代表「已停用」
   * - 停用 location 不應再被用於「新增冊」或「CSV 匯入新冊」
   */
  private async assertLocationIdActive(client: PoolClient, orgId: string, locationId: string) {
    const result = await client.query<{ id: string; status: 'active' | 'inactive' }>(
      `
      SELECT id, status
      FROM locations
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, locationId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Location not found' },
      });
    }

    const location = result.rows[0]!;
    if (location.status !== 'active') {
      throw new ConflictException({
        error: { code: 'LOCATION_INACTIVE', message: 'Location is inactive' },
      });
    }
  }

  private async getBibsByIds(client: PoolClient, orgId: string, ids: string[]) {
    if (ids.length === 0) return new Set<string>();

    const result = await client.query<ExistingBibByIdRow>(
      `
      SELECT id
      FROM bibliographic_records
      WHERE organization_id = $1
        AND id = ANY($2::uuid[])
      `,
      [orgId, ids],
    );

    return new Set(result.rows.map((r) => r.id));
  }

  private async getBibsByIsbns(client: PoolClient, orgId: string, isbns: string[]) {
    if (isbns.length === 0) return new Map<string, string[]>();

    const result = await client.query<ExistingBibByIsbnRow>(
      `
      SELECT id, isbn
      FROM bibliographic_records
      WHERE organization_id = $1
        AND isbn = ANY($2::text[])
      `,
      [orgId, isbns],
    );

    // Map isbn -> bib ids（可能 >1；我們會在上層擋掉）
    const map = new Map<string, string[]>();
    for (const row of result.rows) {
      const list = map.get(row.isbn) ?? [];
      list.push(row.id);
      map.set(row.isbn, list);
    }
    return map;
  }

  private async getBibsByIdentifiers(
    client: PoolClient,
    orgId: string,
    scheme: string,
    values: string[],
  ): Promise<Map<string, string[]>> {
    if (values.length === 0) return new Map<string, string[]>();

    const result = await client.query<{ bibliographic_id: string; value: string }>(
      `
      SELECT bibliographic_id, value
      FROM bibliographic_identifiers
      WHERE organization_id = $1
        AND scheme = $2
        AND value = ANY($3::text[])
      `,
      [orgId, scheme, values],
    );

    // Map value -> bib ids（可能 >1；上層會回報模糊匹配）
    const map = new Map<string, string[]>();
    for (const row of result.rows) {
      const list = map.get(row.value) ?? [];
      list.push(row.bibliographic_id);
      map.set(row.value, list);
    }
    return map;
  }

  private async getBibSummariesByIds(
    client: PoolClient,
    orgId: string,
    ids: string[],
  ): Promise<Map<string, { title: string; isbn: string | null }>> {
    if (ids.length === 0) return new Map();

    const result = await client.query<{ id: string; title: string; isbn: string | null }>(
      `
      SELECT id, title, isbn
      FROM bibliographic_records
      WHERE organization_id = $1
        AND id = ANY($2::uuid[])
      `,
      [orgId, ids],
    );

    const map = new Map<string, { title: string; isbn: string | null }>();
    for (const row of result.rows) map.set(row.id, { title: row.title, isbn: row.isbn });
    return map;
  }

  private async upsertAuthorityTerms(
    client: PoolClient,
    orgId: string,
    kind: 'name' | 'subject' | 'geographic' | 'genre',
    vocabularyCode: string,
    labels: string[],
    source: string,
  ) {
    // labels 若太多，分批避免 query 參數/封包過大
    const chunks = chunkArray(labels, 2000);
    for (const batch of chunks) {
      if (batch.length === 0) continue;
      await client.query(
        `
        INSERT INTO authority_terms (
          organization_id,
          kind,
          vocabulary_code,
          preferred_label,
          source,
          status
        )
        SELECT
          $1,
          $2::authority_term_kind,
          $3,
          x,
          $4,
          'active'::user_status
        FROM unnest($5::text[]) AS x
        ON CONFLICT (organization_id, kind, vocabulary_code, preferred_label)
        DO NOTHING
        `,
        [orgId, kind, vocabularyCode, source, batch],
      );
    }
  }

  private async replaceBibIdentifiers(
    client: PoolClient,
    orgId: string,
    bibId: string,
    scheme: string,
    values: string[],
  ) {
    // 先刪後插（避免留下舊識別碼，也避免需要 diff）
    await client.query(
      `
      DELETE FROM bibliographic_identifiers
      WHERE organization_id = $1
        AND bibliographic_id = $2
        AND scheme = $3
      `,
      [orgId, bibId, scheme],
    );

    const uniq = uniqStrings(values);
    const chunks = chunkArray(uniq, 2000);
    for (const batch of chunks) {
      if (batch.length === 0) continue;
      await client.query(
        `
        INSERT INTO bibliographic_identifiers (
          organization_id,
          bibliographic_id,
          scheme,
          value
        )
        SELECT $1, $2, $3, x
        FROM unnest($4::text[]) AS x
        `,
        [orgId, bibId, scheme, batch],
      );
    }
  }

  private async updateBibliographicInTransaction(
    client: PoolClient,
    orgId: string,
    bibId: string,
    input: CreateBibliographicInput,
    subjectResolveOptions: { vocabulary_code_for_new: string; source_for_new: string },
  ) {
    // 這裡故意做成「partial update」：
    // - 讓 MARC 匯入更新時，不會因為某些欄位缺值就把既有資料清空
    const setClauses: string[] = [];
    const params: any[] = [orgId, bibId];
    let idx = 3;

    // title：create schema 會保證存在，但我們仍用 if 保險（避免未來 schema 演進）
    if (typeof input.title === 'string') {
      setClauses.push(`title = $${idx}`);
      params.push(input.title);
      idx += 1;
    }

    // creators/contributors：匯入/更新也走 term resolve（避免繞過治理規則）
    const resolvedCreators = await this.resolveNameTermsForWrite(
      client,
      orgId,
      { labels: input.creators, term_ids: input.creator_term_ids },
      {
        vocabulary_code_for_new: subjectResolveOptions.vocabulary_code_for_new,
        source_for_new: subjectResolveOptions.source_for_new,
        field: 'creators',
      },
    );
    if (resolvedCreators !== null) {
      setClauses.push(`creators = $${idx}`);
      params.push(resolvedCreators.labels);
      idx += 1;
    }

    const resolvedContributors = await this.resolveNameTermsForWrite(
      client,
      orgId,
      { labels: input.contributors, term_ids: input.contributor_term_ids },
      {
        vocabulary_code_for_new: subjectResolveOptions.vocabulary_code_for_new,
        source_for_new: subjectResolveOptions.source_for_new,
        field: 'contributors',
      },
    );
    if (resolvedContributors !== null) {
      setClauses.push(`contributors = $${idx}`);
      params.push(resolvedContributors.labels);
      idx += 1;
    }

    if (input.publisher !== undefined) {
      setClauses.push(`publisher = $${idx}`);
      params.push(input.publisher ?? null);
      idx += 1;
    }

    if (input.published_year !== undefined) {
      setClauses.push(`published_year = $${idx}`);
      params.push(input.published_year ?? null);
      idx += 1;
    }

    if (input.language !== undefined) {
      setClauses.push(`language = $${idx}`);
      params.push(input.language ?? null);
      idx += 1;
    }

    // subjects：MARC 匯入更新也要做正規化 + term_id linking（避免匯入繞過治理規則）
    const resolvedSubjects = await this.resolveSubjectTermsForWrite(
      client,
      orgId,
      { subjects: input.subjects, subject_term_ids: input.subject_term_ids },
      subjectResolveOptions,
    );
    if (resolvedSubjects !== null) {
      setClauses.push(`subjects = $${idx}`);
      params.push(resolvedSubjects.subjects);
      idx += 1;
    }

    // geographics/genres：MARC 匯入也一起做 authority linking（讓 651/655 逐步 term-based）
    const resolvedGeographics = await this.resolveGeographicTermsForWrite(
      client,
      orgId,
      { geographics: input.geographics, geographic_term_ids: input.geographic_term_ids },
      subjectResolveOptions,
    );
    if (resolvedGeographics !== null) {
      setClauses.push(`geographics = $${idx}`);
      params.push(resolvedGeographics.geographics);
      idx += 1;
    }

    const resolvedGenres = await this.resolveGenreTermsForWrite(
      client,
      orgId,
      { genres: input.genres, genre_term_ids: input.genre_term_ids },
      subjectResolveOptions,
    );
    if (resolvedGenres !== null) {
      setClauses.push(`genres = $${idx}`);
      params.push(resolvedGenres.genres);
      idx += 1;
    }

    if (input.isbn !== undefined) {
      setClauses.push(`isbn = $${idx}`);
      params.push(input.isbn ?? null);
      idx += 1;
    }

    if (input.classification !== undefined) {
      setClauses.push(`classification = $${idx}`);
      params.push(input.classification ?? null);
      idx += 1;
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = now()');

    await client.query(
      `
      UPDATE bibliographic_records
      SET ${setClauses.join(', ')}
      WHERE organization_id = $1
        AND id = $2
      `,
      params,
    );

    if (resolvedSubjects) {
      await this.replaceBibSubjectTerms(client, orgId, bibId, resolvedSubjects.subject_term_ids);
    }

    if (resolvedGeographics) {
      await this.replaceBibGeographicTerms(client, orgId, bibId, resolvedGeographics.geographic_term_ids);
    }

    if (resolvedGenres) {
      await this.replaceBibGenreTerms(client, orgId, bibId, resolvedGenres.genre_term_ids);
    }

    if (resolvedCreators) {
      await this.replaceBibNameTerms(client, orgId, bibId, 'creator', resolvedCreators.term_ids);
    }
    if (resolvedContributors) {
      await this.replaceBibNameTerms(client, orgId, bibId, 'contributor', resolvedContributors.term_ids);
    }
  }
}

function safeJsonParse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function normalizeAuthorityLabel(value: string) {
  // 讓 string heading 的比對更穩定：
  // - trim
  // - 去掉常見結尾標點（MARC heading 常見 "..." / "...."）
  // - lower（英文）
  //
  // 注意：
  // - 這不是「真正的 authority normalization」（例如中文斷詞/同義詞/規範款目）
  // - 只是避免同一個 label 因為多一個句點/空白就 miss vocabulary_code 推導
  const v = (value ?? '').trim();
  if (!v) return '';
  return v.replace(/[\\s\\/:;,.]+$/g, '').trim().toLowerCase();
}

function uniqStrings(values: Array<string | null | undefined>) {
  // 保留原順序的 uniq（用於 identifiers/authority terms 等）
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = (raw ?? '').trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function chunkArray<T>(items: T[], size: number) {
  if (items.length === 0) return [];
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeIdentifierValue(value: string) {
  // 目前先保守：trim 即可
  // - 若未來要支援 `(OCoLC)123` vs `123` 的 normalization，可在這裡擴充
  return (value ?? '').trim();
}

function extract035Values(marcExtras: MarcField[] | null) {
  // 從 marc_extras 抽出 035$a（可能多筆）
  // - 這裡只抽 `$a`，因為多數來源會把系統號碼放在 $a
  // - 若遇到其他 subfield 需求（例如 $z cancelled），再擴充
  const out: string[] = [];
  const seen = new Set<string>();

  for (const f of marcExtras ?? []) {
    if (f.tag !== '035') continue;
    if (!isMarcDataField(f)) continue;

    for (const sf of f.subfields ?? []) {
      if (sf.code !== 'a') continue;
      const v = normalizeIdentifierValue(sf.value);
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }

  return out;
}

/**
 * hashDedupeKey：把「可能重複的書目資訊」做成穩定 key
 *
 * 用途：
 * - 當 CSV 沒有 bibliographic_id、也沒有 isbn 時，我們仍想避免「同一本書在同一份 CSV 被建多次」
 * - 這不是完美去重（因為 title 可能同名），但對學校現場的初次匯入已能大幅減少重複
 */
function hashDedupeKey(input: { title: string; creators: string[]; publisher: string; published_year: number | null }) {
  const canonical = JSON.stringify({
    title: input.title.trim(),
    creators: input.creators.map((c) => c.trim()).filter((c) => c),
    publisher: input.publisher.trim(),
    published_year: input.published_year,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 16);
}

function isUuid(value: string) {
  // MVP：用 regex 做「最低限度」驗證，避免把非 UUID 丟進 `::uuid` 造成 22P02
  // - 不做更進階的版本驗證（v1/v4），因為 Postgres 會再做一次 parse
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}
