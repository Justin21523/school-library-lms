/**
 * Web → API Client（fetch wrapper）
 *
 * 目標：
 * - 把「呼叫 API 的細節」集中在這裡（baseUrl、錯誤格式、JSON parse）
 * - 讓 page/component 只關心「要呼叫哪個端點」與「如何顯示資料」
 *
 * 設計原則（對齊目前 API 的實作）：
 * - API 路由以 `/api/v1/...` 為前綴
 * - 錯誤回應多為 `{ error: { code, message, details? } }`
 * - MVP 仍保留 `actor_user_id`（用於寫 audit / RBAC），但會逐步收斂到「由登入身分推導」
 *
 * 本專案已導入「Staff Auth（Web Console 登入）」：
 * - Web 端會把 access_token 存在 localStorage（依 orgId 分開）
 * - API client 會自動帶上 `Authorization: Bearer <token>`
 * - 後端的 StaffAuthGuard 會要求：actor_user_id 必須等於登入者（避免冒用）
 *
 * 本專案也開始導入「Patron Auth（OPAC Account / 讀者登入）」：
 * - OPAC 端會把 access_token 存在 localStorage（依 orgId 分開）
 * - `/api/v1/orgs/:orgId/me/*` 由 PatronAuthGuard 保護，必須帶「讀者 token」
 */

import { getOpacAccessToken } from './opac-session';
import { getStaffAccessToken } from './staff-session';

// 這些型別是「Web 端看到的 API 回傳形狀」；
// 目前 API 直接回傳 SQL row，因此欄位是 snake_case（例如 created_at）。
export type Organization = {
  id: string;
  name: string;
  code: string | null;
  created_at: string;
  updated_at: string;
};

export type Location = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  area: string | null;
  shelf_code: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  organization_id: string;
  external_id: string;
  name: string;
  role: 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
  org_unit: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

/**
 * CursorPage（前端看到的 cursor pagination envelope）
 *
 * 後端 list endpoints（users/bibs/items/loans/holds）在大量資料（scale seed）下會回傳：
 * - items：本頁資料（最多 limit 筆）
 * - next_cursor：下一頁游標（沒有下一頁則為 null）
 *
 * 前端不需要理解 cursor 的內容，只要在「載入更多」時把 next_cursor 帶回 API 即可。
 */
export type CursorPage<T> = {
  items: T[];
  next_cursor: string | null;
};

// ----------------------------
// Authority / Vocabulary（權威控制檔 / controlled vocab）
// ----------------------------

export type AuthorityTerm = {
  id: string;
  organization_id: string;
  kind: 'name' | 'subject' | 'geographic' | 'genre' | 'language' | 'relator';
  vocabulary_code: string;
  preferred_label: string;
  variant_labels: string[] | null;
  note: string | null;
  source: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type AuthorityTermSummary = {
  id: string;
  kind: AuthorityTerm['kind'];
  vocabulary_code: string;
  preferred_label: string;
  status: AuthorityTerm['status'];
  source: string;
};

export type AuthorityTermDetail = {
  term: AuthorityTerm;
  relations: {
    broader: Array<{ relation_id: string; term: AuthorityTermSummary }>;
    narrower: Array<{ relation_id: string; term: AuthorityTermSummary }>;
    related: Array<{ relation_id: string; term: AuthorityTermSummary }>;
  };
};

// Governance：usage + merge/redirect（term 治理）
export type AuthorityTermUsageItem = {
  bibliographic_id: string;
  title: string;
  isbn: string | null;
  classification: string | null;
  created_at: string;
  // roles：只有 name term 會回傳（因為 bibliographic_name_terms 有 role 維度）
  roles?: Array<'creator' | 'contributor'>;
};

export type AuthorityTermUsageResult = CursorPage<AuthorityTermUsageItem> & {
  term_id: string;
  total_bibs: number;
};

export type MergeAuthorityTermPreviewResult = {
  mode: 'preview';
  source_term: AuthorityTerm;
  target_term: AuthorityTerm;
  summary: {
    bibs_affected: number;
    bibs_updated: number;
    variant_labels_added: number;
    relations: {
      moved: boolean;
      skipped_due_to_vocab_mismatch: boolean;
      considered: number;
      inserted: number;
      deleted: number;
    };
    warnings: string[];
  };
};

// 注意：不能用 intersection 直接覆蓋 mode，因為 'preview' & 'apply' 會變成 never（TS 交集型別）
export type MergeAuthorityTermApplyResult = Omit<MergeAuthorityTermPreviewResult, 'mode'> & {
  mode: 'apply';
  audit_event_id: string;
};

export type ThesaurusRelationKind = 'broader' | 'narrower' | 'related';

export type ThesaurusExpandResult = {
  term: AuthorityTerm;
  include: Array<'self' | 'variants' | 'broader' | 'narrower' | 'related'>;
  depth: number;
  labels: string[];
  term_ids: string[];
  broader_terms: AuthorityTermSummary[];
  narrower_terms: AuthorityTermSummary[];
  related_terms: AuthorityTermSummary[];
  variant_labels: string[];
};

// ----------------------------
// Thesaurus v1.1：Hierarchy browsing + governance
// ----------------------------

export type ThesaurusNodeSummary = AuthorityTermSummary & {
  broader_count: number;
  narrower_count: number;
  has_children: boolean;
};

export type ThesaurusRootsPage = CursorPage<ThesaurusNodeSummary>;

export type ThesaurusChildrenPage = CursorPage<{
  relation_id: string;
  term: ThesaurusNodeSummary;
}>;

export type ThesaurusAncestorsResult = {
  term: AuthorityTermSummary;
  depth: number;
  max_paths: number;
  truncated: boolean;
  paths: Array<{ is_complete: boolean; nodes: AuthorityTermSummary[] }>;
};

export type ThesaurusGraphResult = {
  term: AuthorityTermSummary;
  direction: 'narrower' | 'broader';
  depth: number;
  max_nodes: number;
  max_edges: number;
  truncated: boolean;
  nodes: AuthorityTermSummary[];
  edges: Array<{ relation_id: string; from_term_id: string; to_term_id: string; relation_type: 'broader' }>;
};

export type ThesaurusQualityIssueType = 'orphans' | 'multi_broader' | 'unused_with_relations';
export type ThesaurusQualityItem = ThesaurusNodeSummary & { issue_type: ThesaurusQualityIssueType };
export type ThesaurusQualityPage = CursorPage<ThesaurusQualityItem>;

export type ThesaurusRelationsImportResult =
  | {
      mode: 'preview';
      summary: {
        total_rows: number;
        create_count: number;
        skip_existing_count: number;
        error_count: number;
      };
      rows: Array<{
        row_number: number;
        relation_type: 'broader' | 'related' | null;
        from_term_id: string | null;
        to_term_id: string | null;
        status: 'create' | 'skip_existing' | 'error';
        error?: { code: string; message: string };
      }>;
    }
  | {
      mode: 'apply';
      summary: {
        total_rows: number;
        create_count: number;
        skip_existing_count: number;
        error_count: number;
      };
    };

// ----------------------------
// US-010：Users CSV Import（名冊匯入）
// ----------------------------

// roster_role：名冊匯入的角色範圍（US-010：student/teacher）
export type RosterRole = 'student' | 'teacher';

export type UsersCsvImportMode = 'preview' | 'apply';

export type UsersCsvImportRowError = {
  row_number: number;
  code: string;
  message: string;
  field?: string;
  details?: unknown;
};

export type UsersCsvImportRowPlan = {
  row_number: number;
  external_id: string;
  name: string;
  role: RosterRole;
  org_unit: string | null | undefined;
  status: User['status'] | undefined;
  action: 'create' | 'update' | 'unchanged' | 'invalid';
  changes: Array<'external_id' | 'name' | 'role' | 'org_unit' | 'status'>;
};

export type UsersCsvImportSummary = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  to_create: number;
  to_update: number;
  unchanged: number;
  to_deactivate: number;
};

export type UsersCsvImportPreviewResult = {
  mode: 'preview';
  csv: { header: string[]; sha256: string };
  options: {
    deactivate_missing: boolean;
    deactivate_missing_roles: RosterRole[];
    default_role: RosterRole | null;
    update_status: boolean;
    update_org_unit: boolean;
  };
  summary: UsersCsvImportSummary;
  errors: UsersCsvImportRowError[];
  rows: UsersCsvImportRowPlan[];
  to_deactivate_preview: Array<{
    id: string;
    external_id: string;
    name: string;
    role: RosterRole;
    status: User['status'];
  }>;
};

export type UsersCsvImportApplyResult = {
  mode: 'apply';
  summary: UsersCsvImportSummary;
  audit_event_id: string;
};

export type UsersCsvImportResult = UsersCsvImportPreviewResult | UsersCsvImportApplyResult;

// ----------------------------
// US-022：Catalog CSV Import（書目/冊 匯入）
// ----------------------------

export type CatalogCsvImportMode = 'preview' | 'apply';

export type CatalogCsvImportRowError = {
  row_number: number;
  code: string;
  message: string;
  field?: string;
  details?: unknown;
};

export type CatalogCsvImportRowPlan = {
  row_number: number;

  // item
  barcode: string;
  call_number: string;
  location_id: string;
  status: ItemStatus;
  acquired_at: string | null;
  notes: string | null;

  // bib
  bibliographic_id: string | null;
  isbn: string | null;
  title: string | null;
  creators: string[] | null;
  publisher: string | null;
  published_year: number | null;
  language: string | null;
  subjects: string[] | null;
  classification: string | null;

  // plan
  bib_action: 'use_existing' | 'create_new' | 'invalid';
  bib_key: string;
  item_action: 'create' | 'update' | 'invalid';
};

export type CatalogCsvImportSummary = {
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
  summary: CatalogCsvImportSummary;
  errors: CatalogCsvImportRowError[];
  rows: CatalogCsvImportRowPlan[];
  bibs_to_create_preview: Array<{ bib_key: string; title: string | null; isbn: string | null }>;
};

export type CatalogCsvImportApplyResult = {
  mode: 'apply';
  summary: CatalogCsvImportSummary;
  audit_event_id: string;
};

export type CatalogCsvImportResult = CatalogCsvImportPreviewResult | CatalogCsvImportApplyResult;

export type CirculationPolicy = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  audience_role: 'student' | 'teacher';
  loan_days: number;
  max_loans: number;
  max_renewals: number;
  max_holds: number;
  hold_pickup_days: number;
  overdue_block_days: number;
  // is_active：同一 org + role 目前生效的那一套政策（後端會保證同 role 同時只能有一筆）
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BibliographicRecord = {
  id: string;
  organization_id: string;
  title: string;
  creators: string[] | null;
  // creator_term_ids/creator_terms：authority linking v1（name term_id-driven；對應 creators）
  creator_term_ids?: string[];
  creator_terms?: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  contributors: string[] | null;
  // contributor_term_ids/contributor_terms：authority linking v1（name term_id-driven；對應 contributors）
  contributor_term_ids?: string[];
  contributor_terms?: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  publisher: string | null;
  published_year: number | null;
  language: string | null;
  subjects: string[] | null;
  // subject_term_ids/subject_terms：authority linking v1（term_id-driven）
  // - 若尚未 backfill（或尚未以 term-based UI 編輯過），可能是空陣列或 undefined
  subject_term_ids?: string[];
  subject_terms?: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  geographics: string[] | null;
  geographic_term_ids?: string[];
  geographic_terms?: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  genres: string[] | null;
  genre_term_ids?: string[];
  genre_terms?: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
  isbn: string | null;
  classification: string | null;
  created_at: string;
  updated_at: string;
};

export type BibliographicRecordWithCounts = BibliographicRecord & {
  total_items: number;
  available_items: number;
};

// ----------------------------
// Bibs Maintenance：subjects backfill（既有資料 → authority linking）
// ----------------------------

export type BackfillSubjectLabelDecision =
  | {
      input_label: string;
      status: 'matched_preferred' | 'matched_variant' | 'auto_created';
      term: { id: string; vocabulary_code: string; preferred_label: string };
    }
  | {
      input_label: string;
      status: 'ambiguous_auto_created';
      term: { id: string; vocabulary_code: string; preferred_label: string };
      candidates: Array<{ id: string; vocabulary_code: string; preferred_label: string }>;
    }
  | { input_label: string; status: 'skipped_blank' | 'unmatched'; reason: string };

export type BackfillBibSubjectTermsRowReport = {
  bibliographic_id: string;
  title: string;
  subjects_before: string[];
  subjects_after: string[] | null;
  subject_term_ids_after: string[] | null;
  decisions: BackfillSubjectLabelDecision[];
  status: 'would_update' | 'skipped_invalid' | 'no_subjects';
};

export type BackfillBibSubjectTermsSummary = {
  scanned: number;
  would_update: number;
  skipped_invalid: number;
  no_subjects: number;
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

export type BackfillBibGeographicTermsRowReport = {
  bibliographic_id: string;
  title: string;
  geographics_before: string[];
  geographics_after: string[] | null;
  geographic_term_ids_after: string[] | null;
  decisions: BackfillSubjectLabelDecision[];
  status: 'would_update' | 'skipped_invalid' | 'no_geographics';
};

export type BackfillBibGeographicTermsSummary = {
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

export type BackfillBibGenreTermsRowReport = {
  bibliographic_id: string;
  title: string;
  genres_before: string[];
  genres_after: string[] | null;
  genre_term_ids_after: string[] | null;
  decisions: BackfillSubjectLabelDecision[];
  status: 'would_update' | 'skipped_invalid' | 'no_genres';
};

export type BackfillBibGenreTermsSummary = {
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

// ----------------------------
// Bibs Maintenance：names backfill（既有 creators/contributors → name linking v1）
// ----------------------------

export type BackfillBibNameTermsRowReport = {
  bibliographic_id: string;
  title: string;

  creators_before: string[];
  contributors_before: string[];

  creators_after: string[] | null;
  contributors_after: string[] | null;

  creator_term_ids_after: string[] | null;
  contributor_term_ids_after: string[] | null;

  creator_decisions: BackfillSubjectLabelDecision[];
  contributor_decisions: BackfillSubjectLabelDecision[];

  status: 'would_update' | 'skipped_invalid' | 'no_names';
};

export type BackfillBibNameTermsSummary = {
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

// ----------------------------
// MARC 21（進階編目：交換格式）
// ----------------------------

/**
 * MARC types（Web 端）
 *
 * 注意：
 * - 這裡先「複製一份」最小型別，而不是直接從 packages/shared 共用，
 *   原因是：目前 apps/api 是 CommonJS、packages/shared 是 ESM，runtime 直接共用容易踩到模組系統坑。
 * - 若未來要共用，建議只共用「純 type（.d.ts）或 TS source」並確保 build/emit 策略一致。
 */
export type MarcSubfield = { code: string; value: string };

export type MarcControlField = { tag: string; value: string };

export type MarcDataField = {
  tag: string;
  ind1: string;
  ind2: string;
  subfields: MarcSubfield[];
};

export type MarcField = MarcControlField | MarcDataField;

export type MarcRecord = {
  leader: string;
  fields: MarcField[];
};

// ----------------------------
// MARC Batch Import（preview/apply；去重 ISBN/035）
// ----------------------------

export type MarcImportMode = 'preview' | 'apply';
export type MarcImportDecision = 'create' | 'update' | 'skip';

export type MarcImportRecordError = {
  record_index: number;
  code: string;
  message: string;
  details?: unknown;
};

export type MarcImportMatch = {
  by: 'isbn' | '035' | null;
  bib_id: string | null;
  bib_title: string | null;
  bib_isbn: string | null;
  matched_values: string[];
};

export type MarcImportRecordPlan = {
  record_index: number;
  bib: {
    title: string;
    creators?: string[];
    contributors?: string[];
    publisher?: string;
    published_year?: number;
    language?: string;
    subjects?: string[];
    isbn?: string;
    classification?: string;
  };
  marc_extras_count: number;
  isbn: string | null;
  identifiers_035: string[];
  match: MarcImportMatch;
  suggested_decision: MarcImportDecision;
  decision: MarcImportDecision;
  target_bib_id: string | null;
};

export type MarcImportSummary = {
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

export type ItemStatus =
  | 'available'
  | 'checked_out'
  | 'on_hold'
  | 'lost'
  | 'withdrawn'
  | 'repair';

export type ItemCopy = {
  id: string;
  organization_id: string;
  bibliographic_id: string;
  barcode: string;
  call_number: string;
  location_id: string;
  status: ItemStatus;
  acquired_at: string | null;
  last_inventory_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * ItemDetail（冊詳情：含「組合狀態」）
 *
 * 後端會在 item detail 一次回傳：
 * - item：冊主檔
 * - current_loan：若此冊目前被借出（open loan），回傳借閱者與到期日
 * - assigned_hold：若此冊目前被指派給某筆 ready hold（取書架），回傳預約者與取書期限
 */
export type ItemDetail = {
  item: ItemCopy;
  current_loan: null | {
    id: string;
    user_id: string;
    user_external_id: string;
    user_name: string;
    checked_out_at: string;
    due_at: string;
  };
  assigned_hold: null | {
    id: string;
    user_id: string;
    user_external_id: string;
    user_name: string;
    bibliographic_id: string;
    pickup_location_id: string;
    placed_at: string;
    ready_at: string | null;
    ready_until: string | null;
  };
};

export type CheckoutResult = {
  loan_id: string;
  item_id: string;
  user_id: string;
  due_at: string;
};

export type CheckinResult = {
  loan_id: string;
  item_id: string;
  item_status: ItemStatus;
  hold_id: string | null;
  ready_until: string | null;
};

export type LoanStatus = 'open' | 'closed';

// loans list 會回「loan + borrower + item + bib title」，方便 UI 顯示。
export type LoanWithDetails = {
  // loan
  id: string;
  organization_id: string;
  item_id: string;
  user_id: string;
  checked_out_at: string;
  due_at: string;
  returned_at: string | null;
  renewed_count: number;
  status: LoanStatus;
  is_overdue: boolean;

  // borrower
  user_external_id: string;
  user_name: string;
  user_role: User['role'];
  user_status: User['status'];

  // item
  item_barcode: string;
  item_status: ItemStatus;
  item_call_number: string;
  item_location_id: string;

  // bib
  bibliographic_id: string;
  bibliographic_title: string;
};

export type RenewResult = {
  loan_id: string;
  item_id: string;
  user_id: string;
  due_at: string;
  renewed_count: number;
};

// loans maintenance：借閱歷史保存期限（US-061）
export type PurgeLoanHistoryPreviewRow = {
  loan_id: string;
  checked_out_at: string;
  returned_at: string;
  user_external_id: string;
  user_name: string;
  user_role: User['role'];
  user_org_unit: string | null;
  item_barcode: string;
  bibliographic_title: string;
};

export type PurgeLoanHistoryPreviewResult = {
  mode: 'preview';
  as_of: string;
  retention_days: number;
  cutoff: string;
  limit: number;
  include_audit_events: boolean;
  candidates_total: number;
  loans: PurgeLoanHistoryPreviewRow[];
};

export type PurgeLoanHistoryApplyResult = {
  mode: 'apply';
  as_of: string;
  retention_days: number;
  cutoff: string;
  limit: number;
  include_audit_events: boolean;
  summary: {
    candidates_total: number;
    deleted_loans: number;
    deleted_audit_events: number;
  };
  audit_event_id: string | null;
  deleted_loan_ids: string[];
};

export type PurgeLoanHistoryResult = PurgeLoanHistoryPreviewResult | PurgeLoanHistoryApplyResult;

// holds（預約/保留）
// - status 與 db/schema.sql 的 hold_status enum 對齊
export type HoldStatus = 'queued' | 'ready' | 'cancelled' | 'fulfilled' | 'expired';

// list/create/cancel 會回傳「hold + borrower + bib title + pickup location + assigned item」的組合資料
// - 這是 API 端直接 join 出來的 row（snake_case）
export type HoldWithDetails = {
  // hold
  id: string;
  organization_id: string;
  bibliographic_id: string;
  user_id: string;
  pickup_location_id: string;
  placed_at: string;
  status: HoldStatus;
  assigned_item_id: string | null;
  ready_at: string | null;
  ready_until: string | null;
  cancelled_at: string | null;
  fulfilled_at: string | null;

  // borrower
  user_external_id: string;
  user_name: string;
  user_role: User['role'];

  // bib
  bibliographic_title: string;

  // pickup location
  pickup_location_code: string;
  pickup_location_name: string;

  // assigned item（可能為 NULL）
  assigned_item_barcode: string | null;
  assigned_item_status: ItemStatus | null;
};

// holds maintenance：到期處理（ready_until → expired）
export type ExpireReadyHoldsPreviewResult = {
  mode: 'preview';
  as_of: string;
  limit: number;
  candidates_total: number;
  holds: HoldWithDetails[];
};

export type ExpireReadyHoldsApplyRow = {
  hold_id: string;
  assigned_item_id: string | null;
  assigned_item_barcode: string | null;
  item_status_before: ItemStatus | null;
  item_status_after: ItemStatus | null;
  transferred_to_hold_id: string | null;
  audit_event_id: string;
};

export type ExpireReadyHoldsApplyResult = {
  mode: 'apply';
  as_of: string;
  limit: number;
  summary: {
    candidates_total: number;
    processed: number;
    transferred: number;
    released: number;
    skipped_item_action: number;
  };
  results: ExpireReadyHoldsApplyRow[];
};

export type ExpireReadyHoldsResult = ExpireReadyHoldsPreviewResult | ExpireReadyHoldsApplyResult;

// fulfill 的回傳是「動作結果」：成功建立 loan 後，回傳 loan 與 item 的關鍵欄位
export type FulfillHoldResult = {
  hold_id: string;
  loan_id: string;
  item_id: string;
  item_barcode: string;
  user_id: string;
  due_at: string;
};

// ----------------------------
// Inventory（盤點）
// ----------------------------

/**
 * InventorySessionWithDetails：盤點 session（含 location/actor/stats）
 *
 * 對應 API：
 * - POST /inventory/sessions
 * - GET  /inventory/sessions
 */
export type InventorySessionWithDetails = {
  id: string;
  organization_id: string;
  location_id: string;
  actor_user_id: string;
  note: string | null;
  started_at: string;
  closed_at: string | null;

  // join fields：方便 UI 顯示
  location_code: string;
  location_name: string;
  actor_external_id: string;
  actor_name: string;

  // stats：方便 UI 顯示盤點進度
  scanned_count: number;
  unexpected_count: number;
};

export type InventoryScannedItem = {
  id: string;
  barcode: string;
  call_number: string;
  status: ItemStatus;
  location_id: string;
  location_code: string;
  location_name: string;
  bibliographic_id: string;
  bibliographic_title: string;
  last_inventory_at: string | null;
};

export type InventoryScanResult = {
  scan_id: string;
  session_id: string;
  scanned_at: string;
  flags: { location_mismatch: boolean; status_unexpected: boolean };
  item: InventoryScannedItem;
  session_location: { id: string; code: string; name: string };
};

export type CloseInventorySessionResult = {
  ok: true;
  session: {
    id: string;
    organization_id: string;
    location_id: string;
    actor_user_id: string;
    note: string | null;
    started_at: string;
    closed_at: string;
  };
  summary: {
    expected_available_count: number;
    scanned_count: number;
    missing_count: number;
    unexpected_count: number;
  };
  audit_event_id: string;
};

// reports：Inventory Diff（盤點差異清單）
export type InventoryDiffSession = {
  inventory_session_id: string;
  location_id: string;
  location_code: string;
  location_name: string;
  actor_user_id: string;
  actor_external_id: string;
  actor_name: string;
  note: string | null;
  started_at: string;
  closed_at: string | null;
};

export type InventoryDiffSummary = {
  expected_available_count: number;
  scanned_count: number;
  missing_count: number;
  unexpected_count: number;
};

export type InventoryMissingRow = {
  item_id: string;
  item_barcode: string;
  item_call_number: string;
  item_status: ItemStatus;
  item_location_code: string;
  item_location_name: string;
  last_inventory_at: string | null;
  bibliographic_id: string;
  bibliographic_title: string;
};

export type InventoryUnexpectedRow = {
  scan_id: string;
  scanned_at: string;
  item_id: string;
  item_barcode: string;
  item_call_number: string;
  item_status: ItemStatus;
  item_location_id: string;
  item_location_code: string;
  item_location_name: string;
  last_inventory_at: string | null;
  bibliographic_id: string;
  bibliographic_title: string;
  location_mismatch: boolean;
  status_unexpected: boolean;
};

export type InventoryDiffResult = {
  session: InventoryDiffSession;
  summary: InventoryDiffSummary;
  missing: InventoryMissingRow[];
  unexpected: InventoryUnexpectedRow[];
};

// reports：取書架清單（Ready Holds / Pickup Shelf List）
export type ReadyHoldsReportRow = {
  // hold
  hold_id: string;
  ready_at: string | null;
  ready_until: string | null;

  // derived（用 as_of 推導）
  is_expired: boolean;
  days_until_expire: number | null;

  // borrower
  user_id: string;
  user_external_id: string;
  user_name: string;
  user_role: User['role'];
  user_org_unit: string | null;

  // bib
  bibliographic_id: string;
  bibliographic_title: string;

  // pickup location
  pickup_location_id: string;
  pickup_location_code: string;
  pickup_location_name: string;

  // assigned item（可能為 NULL）
  assigned_item_id: string | null;
  assigned_item_barcode: string | null;
  assigned_item_call_number: string | null;
  assigned_item_status: ItemStatus | null;
  assigned_item_location_code: string | null;
  assigned_item_location_name: string | null;
};

// reports：逾期清單（Overdue List）
export type OverdueReportRow = {
  // loan
  loan_id: string;
  checked_out_at: string;
  due_at: string;
  days_overdue: number;

  // borrower
  user_id: string;
  user_external_id: string;
  user_name: string;
  user_role: User['role'];
  user_org_unit: string | null;

  // item
  item_id: string;
  item_barcode: string;
  item_call_number: string;
  item_status: ItemStatus;
  item_location_id: string;
  item_location_code: string;
  item_location_name: string;

  // bib
  bibliographic_id: string;
  bibliographic_title: string;
};

// reports：US-050 熱門書（Top Circulation）
export type TopCirculationRow = {
  bibliographic_id: string;
  bibliographic_title: string;
  loan_count: number;
  unique_borrowers: number;
};

// reports：US-050 借閱量彙總（Circulation Summary）
export type CirculationSummaryRow = {
  bucket_start: string;
  loan_count: number;
};

// reports：US-051 零借閱清單（Zero Circulation）
export type ZeroCirculationReportRow = {
  bibliographic_id: string;
  bibliographic_title: string;
  isbn: string | null;
  classification: string | null;
  published_year: number | null;
  total_items: number;
  available_items: number;
  loan_count_in_range: number;
  last_checked_out_at: string | null;
};

// audit：稽核事件查詢
export type AuditEventRow = {
  // audit_event
  id: string;
  organization_id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: unknown | null;
  created_at: string;

  // actor（事件操作者）的可顯示資訊
  actor_external_id: string;
  actor_name: string;
  actor_role: User['role'];
  actor_status: User['status'];
};

// API 錯誤格式（MVP 版本：以 error 物件包起來）
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// auth：Staff login（最小可用）
export type StaffLoginResult = {
  access_token: string;
  expires_at: string;
  user: {
    id: string;
    organization_id: string;
    external_id: string;
    name: string;
    role: User['role'];
    status: User['status'];
  };
};

// Patron login（OPAC Account）回傳：
// - 後端實作上與 StaffLoginResult 同形狀，但 role 會被 PatronAuthGuard 限制為 student/teacher。
export type PatronLoginResult = {
  access_token: string;
  expires_at: string;
  user: {
    id: string;
    organization_id: string;
    external_id: string;
    name: string;
    role: 'student' | 'teacher';
    status: User['status'];
  };
};

/**
 * ApiError：把 HTTP status 與 API 的 error body 綁在一起，方便 UI 顯示。
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(message: string, status: number, body: ApiErrorBody | null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * API base URL 的來源：
 * - 優先使用 `NEXT_PUBLIC_API_BASE_URL`（讓你在不同環境可切換 API 位址）
 * - 若未設定，開發環境預設 `http://localhost:3001`
 *
 * 注意：NEXT_PUBLIC 代表「會被打包進前端」；因此不要放 secret。
 */
function getApiBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;
  return 'http://localhost:3001';
}

/**
 * 把 query object 轉成 URLSearchParams（只保留有值的欄位）
 *
 * 這個小工具能避免：
 * - 一堆 `if (x) url += ...` 的樣板碼
 * - 把 undefined/null 拼進 query string（變成 "undefined"）
 */
type QueryValue = string | number | boolean | undefined | null;

function toSearchParams(query: Record<string, QueryValue>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    // QueryParam 一律以字串送出：
    // - string：trim 後送出
    // - number/boolean：轉成字串後送出（例如 limit=200, overdue=true）
    const trimmed = (typeof value === 'string' ? value : String(value)).trim();
    if (!trimmed) continue;
    params.set(key, trimmed);
  }

  return params;
}

/**
 * 低階 request：負責
 * - 組 URL
 * - 呼叫 fetch
 * - JSON parse（成功/失敗都盡量 parse）
 * - 不 OK 時丟出 ApiError
 */
async function requestJson<T>(
  path: string,
  options: { method: string; query?: Record<string, QueryValue>; body?: unknown },
): Promise<T> {
  // 1) 組出完整 URL（base + path + query）
  const baseUrl = getApiBaseUrl();
  const url = new URL(path, baseUrl);

  if (options.query) {
    const params = toSearchParams(options.query);
    const queryString = params.toString();
    if (queryString) url.search = queryString;
  }

  // 2) 組 fetch init（MVP：只處理 JSON）
  const init: RequestInit = {
    method: options.method,
    headers: { 'content-type': 'application/json' },
  };

  // 2.1) Auth：若該 path 是 org scoped，嘗試自動帶上 Bearer token
  //
  // 重要：同一個瀏覽器可能同時有 staff token 與 OPAC token。
  // - staff token：用於後台（/orgs/...）受 StaffAuthGuard 保護的端點
  // - OPAC token：用於讀者端（/opac/...）受 PatronAuthGuard 保護的 /me 端點
  //
  // 因此我們以「API path」決定要帶哪一種 token：
  // - `/api/v1/orgs/:orgId/me/*` → 帶 OPAC token
  // - 其他 org scoped 端點 → 帶 staff token（若有）
  const orgIdForAuth = extractOrgIdFromApiPath(path);
  const token = orgIdForAuth
    ? isPatronMeApiPath(path, orgIdForAuth)
      ? getOpacAccessToken(orgIdForAuth)
      : getStaffAccessToken(orgIdForAuth)
    : null;
  if (token) (init.headers as Record<string, string>)['authorization'] = `Bearer ${token}`;

  // body 只有在需要時才帶（GET/HEAD 不應帶 body）。
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  // 3) 發出 request
  let response: Response;
  try {
    response = await fetch(url.toString(), init);
  } catch (error) {
    // fetch 失敗通常是「網路/連線」問題（例如 API 沒開）
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      null,
    );
  }

  // 4) 盡量 parse JSON（即使 response.ok=false，也可能有 error body）
  const text = await response.text();

  // 空字串代表 API 沒回 body；這裡用 null 表示「沒有 JSON」。
  //
  // 重要：不要讓 JSON.parse 直接丟 SyntaxError（會讓 UI 顯示成「壞掉」且訊息不友善）。
  // - 常見原因：API base URL 指到錯的服務、或反向代理回了 HTML 404/502
  // - 我們把它轉成 ApiError，讓每頁既有的 try/catch 能一致顯示錯誤
  let json: unknown = null;
  let jsonParseFailed = false;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
      jsonParseFailed = true;
    }
  }

  // 5) 如果 HTTP status 非 2xx，統一丟出 ApiError 讓 UI 捕捉
  if (!response.ok) {
    const body = isApiErrorBody(json) ? json : null;
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  // 6) 成功但不是合法 JSON：視為錯誤（避免頁面用到 undefined/null 而 crash）
  if (jsonParseFailed) {
    throw new ApiError(
      `Invalid JSON response from API (base=${baseUrl}; path=${path})`,
      response.status,
      null,
    );
  }

  // 6) 成功：把 json 當成 T 回傳
  return json as T;
}

/**
 * 低階 request（text 版本）：用於下載 CSV 這類「非 JSON」回應
 *
 * 設計重點：
 * - 仍沿用與 requestJson 相同的錯誤處理（盡量 parse `{ error: ... }`）
 * - 成功時回傳純文字（例如 CSV）
 */
async function requestText(
  path: string,
  options: { method: string; query?: Record<string, QueryValue>; body?: unknown; accept?: string },
): Promise<{ text: string; contentType: string | null }> {
  // 1) 組出完整 URL（base + path + query）
  const baseUrl = getApiBaseUrl();
  const url = new URL(path, baseUrl);

  if (options.query) {
    const params = toSearchParams(options.query);
    const queryString = params.toString();
    if (queryString) url.search = queryString;
  }

  // 2) 組 fetch init
  const headers: Record<string, string> = {};

  // accept：讓後端知道我們想要的格式（例如 text/csv）
  if (options.accept) headers['accept'] = options.accept;

  // Auth：邏輯同 requestJson（/me 帶 OPAC token，其它帶 staff token）
  const orgIdForAuth = extractOrgIdFromApiPath(path);
  const token = orgIdForAuth
    ? isPatronMeApiPath(path, orgIdForAuth)
      ? getOpacAccessToken(orgIdForAuth)
      : getStaffAccessToken(orgIdForAuth)
    : null;
  if (token) headers['authorization'] = `Bearer ${token}`;

  // body：若有 body（通常是 POST），才宣告 content-type 並送 JSON
  const init: RequestInit = { method: options.method, headers };
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  // 3) 發出 request
  let response: Response;
  try {
    response = await fetch(url.toString(), init);
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      null,
    );
  }

  // 4) 讀取 body（文字）
  const text = await response.text();

  // 5) 如果 HTTP status 非 2xx，統一丟出 ApiError
  if (!response.ok) {
    // 錯誤 body 可能是 JSON，也可能是純文字；這裡盡量 parse JSON 以取得 `{ error: ... }`
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      json = null;
    }

    const body = isApiErrorBody(json) ? json : null;
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  return { text, contentType: response.headers.get('content-type') };
}

/**
 * 低階 request（bytes 版本）：用於下載 .mrc 這類二進位回應
 *
 * 設計：
 * - 成功時回傳 ArrayBuffer（交給 UI 用 Blob 下載）
 * - 失敗時盡量 parse JSON error body（與 requestJson/requestText 一致）
 */
async function requestBytes(
  path: string,
  options: { method: string; query?: Record<string, QueryValue>; body?: unknown; accept?: string },
): Promise<{ bytes: ArrayBuffer; contentType: string | null }> {
  const baseUrl = getApiBaseUrl();
  const url = new URL(path, baseUrl);

  if (options.query) {
    const params = toSearchParams(options.query);
    const queryString = params.toString();
    if (queryString) url.search = queryString;
  }

  const headers: Record<string, string> = {};
  if (options.accept) headers['accept'] = options.accept;

  // Auth：邏輯同 requestJson/requestText
  const orgIdForAuth = extractOrgIdFromApiPath(path);
  const token = orgIdForAuth
    ? isPatronMeApiPath(path, orgIdForAuth)
      ? getOpacAccessToken(orgIdForAuth)
      : getStaffAccessToken(orgIdForAuth)
    : null;
  if (token) headers['authorization'] = `Bearer ${token}`;

  const init: RequestInit = { method: options.method, headers };
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), init);
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      null,
    );
  }

  // error：用 text 讀 body（通常是 JSON），避免把錯誤當成 bytes 下載
  if (!response.ok) {
    const text = await response.text();

    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      json = null;
    }

    const body = isApiErrorBody(json) ? json : null;
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  const bytes = await response.arrayBuffer();
  return { bytes, contentType: response.headers.get('content-type') };
}

/**
 * runtime type guard：判斷一個 unknown 是否符合 ApiErrorBody。
 * - 這讓我們在顯示錯誤時更安全，不會因為 shape 不符就 crash。
 */
function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const error = record['error'];
  if (!error || typeof error !== 'object') return false;
  const errorRecord = error as Record<string, unknown>;
  return typeof errorRecord['code'] === 'string' && typeof errorRecord['message'] === 'string';
}

/**
 * extractOrgIdFromApiPath：從 `/api/v1/orgs/:orgId/...` 中取出 orgId
 *
 * 目的：
 * - Web Console 的 staff session 是「依 orgId」保存的
 * - API client 需要知道「這次請求屬於哪個 org」，才能選對 token
 *
 * 注意：
 * - 這裡只做最小解析；若 path 不是 org scoped，就回傳 null
 */
function extractOrgIdFromApiPath(path: string) {
  const prefix = '/api/v1/orgs/';
  if (!path.startsWith(prefix)) return null;

  const rest = path.slice(prefix.length);
  const orgId = rest.split('/')[0]?.trim() ?? '';
  return orgId || null;
}

/**
 * isPatronMeApiPath：判斷一個 API path 是否屬於 OPAC（Patron）端點
 *
 * 規則（MVP）：
 * - 只要是 `/api/v1/orgs/:orgId/me` 開頭，就視為 patron-only
 *
 * 為什麼不用「是否在 /opac 路由」判斷？
 * - Web 與 API client 是共用的（/orgs 與 /opac 都會 import 同一支 api.ts）
 * - 判斷 request 的目標（API path）才是最穩定的方式
 */
function isPatronMeApiPath(path: string, orgId: string) {
  return path.startsWith(`/api/v1/orgs/${orgId}/me`);
}

/**
 * 對外的 domain functions：讓頁面用「語意化函式」呼叫 API。
 * 這比在每個 page 裡硬寫 URL 更容易維護與重構。
 */

export async function listOrganizations() {
  return await requestJson<Organization[]>('/api/v1/orgs', { method: 'GET' });
}

export async function createOrganization(input: { name: string; code?: string }) {
  return await requestJson<Organization>('/api/v1/orgs', {
    method: 'POST',
    body: input,
  });
}

// ----------------------------
// Auth（Staff / Patron）
// ----------------------------

export async function staffLogin(
  orgId: string,
  input: { external_id: string; password: string },
) {
  return await requestJson<StaffLoginResult>(`/api/v1/orgs/${orgId}/auth/login`, {
    method: 'POST',
    body: input,
  });
}

export async function patronLogin(
  orgId: string,
  input: { external_id: string; password: string },
) {
  // 注意：後端為了「前端共用」刻意回傳與 staffLogin 相同的 shape，
  // 但我們在 Web 端把 role 收斂成 student/teacher（避免 OPAC session 誤存 staff role）。
  return await requestJson<PatronLoginResult>(`/api/v1/orgs/${orgId}/auth/patron-login`, {
    method: 'POST',
    body: input,
  });
}

export async function setStaffPassword(
  orgId: string,
  input: { actor_user_id: string; target_user_id: string; new_password: string; note?: string },
) {
  return await requestJson<{ ok: true }>(`/api/v1/orgs/${orgId}/auth/set-password`, {
    method: 'POST',
    body: input,
  });
}

export async function bootstrapSetStaffPassword(
  orgId: string,
  input: { bootstrap_secret: string; target_external_id: string; new_password: string; note?: string },
) {
  return await requestJson<{ ok: true }>(`/api/v1/orgs/${orgId}/auth/bootstrap-set-password`, {
    method: 'POST',
    body: input,
  });
}

// ----------------------------
// OPAC Account（/me：登入後的讀者自助 API）
// ----------------------------

export type MeUser = {
  id: string;
  organization_id: string;
  external_id: string;
  name: string;
  role: 'student' | 'teacher';
  status: 'active' | 'inactive';
};

export async function getMe(orgId: string) {
  return await requestJson<MeUser>(`/api/v1/orgs/${orgId}/me`, { method: 'GET' });
}

export async function listMyLoans(
  orgId: string,
  query?: { status?: 'open' | 'closed' | 'all'; limit?: number; cursor?: string },
) {
  return await requestJson<CursorPage<LoanWithDetails>>(`/api/v1/orgs/${orgId}/me/loans`, {
    method: 'GET',
    query: query ?? {},
  });
}

export async function listMyHolds(
  orgId: string,
  query?: { status?: HoldStatus | 'all'; limit?: number; cursor?: string },
) {
  return await requestJson<CursorPage<HoldWithDetails>>(`/api/v1/orgs/${orgId}/me/holds`, {
    method: 'GET',
    query: query ?? {},
  });
}

export async function placeMyHold(
  orgId: string,
  input: { bibliographic_id: string; pickup_location_id: string },
) {
  return await requestJson<HoldWithDetails>(`/api/v1/orgs/${orgId}/me/holds`, {
    method: 'POST',
    body: input,
  });
}

export async function cancelMyHold(orgId: string, holdId: string) {
  return await requestJson<HoldWithDetails>(`/api/v1/orgs/${orgId}/me/holds/${holdId}/cancel`, {
    method: 'POST',
  });
}

export async function getOrganization(orgId: string) {
  return await requestJson<Organization>(`/api/v1/orgs/${orgId}`, { method: 'GET' });
}

export async function listLocations(orgId: string) {
  return await requestJson<Location[]>(`/api/v1/orgs/${orgId}/locations`, { method: 'GET' });
}

export async function createLocation(
  orgId: string,
  input: { code: string; name: string; area?: string; shelf_code?: string },
) {
  return await requestJson<Location>(`/api/v1/orgs/${orgId}/locations`, {
    method: 'POST',
    body: input,
  });
}

export async function updateLocation(
  orgId: string,
  locationId: string,
  input: {
    code?: string;
    name?: string;
    area?: string | null;
    shelf_code?: string | null;
    status?: Location['status'];
  },
) {
  return await requestJson<Location>(`/api/v1/orgs/${orgId}/locations/${locationId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function listUsers(
  orgId: string,
  queryOrFilters?:
    | string
    | { query?: string; role?: User['role']; status?: User['status']; limit?: number; cursor?: string },
) {
  // Backward-compatible signature：
  // - 早期版本只支援 listUsers(orgId, query?: string)
  // - US-011 之後支援 role/status/limit 等 filter
  //
  // 為了不一次改爆所有頁面，我們允許第二個參數既可以是 string，也可以是 filters object。
  const filters =
    typeof queryOrFilters === 'string' ? { query: queryOrFilters } : (queryOrFilters ?? {});

  return await requestJson<CursorPage<User>>(`/api/v1/orgs/${orgId}/users`, {
    method: 'GET',
    query: filters,
  });
}

export async function createUser(
  orgId: string,
  input: { external_id: string; name: string; role: User['role']; org_unit?: string },
) {
  return await requestJson<User>(`/api/v1/orgs/${orgId}/users`, {
    method: 'POST',
    body: input,
  });
}

export async function updateUser(
  orgId: string,
  userId: string,
  input: {
    actor_user_id: string;
    name?: string;
    role?: User['role'];
    org_unit?: string | null;
    status?: User['status'];
    note?: string;
  },
) {
  return await requestJson<User>(`/api/v1/orgs/${orgId}/users/${userId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function previewUsersCsvImport(
  orgId: string,
  input: {
    actor_user_id: string;
    csv_text: string;
    default_role?: RosterRole;
    deactivate_missing?: boolean;
    deactivate_missing_roles?: RosterRole[];
    source_filename?: string;
    source_note?: string;
  },
) {
  return await requestJson<UsersCsvImportPreviewResult>(`/api/v1/orgs/${orgId}/users/import`, {
    method: 'POST',
    body: { ...input, mode: 'preview' satisfies UsersCsvImportMode },
  });
}

export async function applyUsersCsvImport(
  orgId: string,
  input: {
    actor_user_id: string;
    csv_text: string;
    default_role?: RosterRole;
    deactivate_missing?: boolean;
    deactivate_missing_roles?: RosterRole[];
    source_filename?: string;
    source_note?: string;
  },
) {
  return await requestJson<UsersCsvImportApplyResult>(`/api/v1/orgs/${orgId}/users/import`, {
    method: 'POST',
    body: { ...input, mode: 'apply' satisfies UsersCsvImportMode },
  });
}

// ----------------------------
// US-022：Catalog CSV Import（書目/冊 匯入）
// ----------------------------

export async function previewCatalogCsvImport(
  orgId: string,
  input: {
    actor_user_id: string;
    csv_text: string;
    default_location_id?: string;
    update_existing_items?: boolean;
    allow_relink_bibliographic?: boolean;
    source_filename?: string;
    source_note?: string;
  },
) {
  return await requestJson<CatalogCsvImportPreviewResult>(`/api/v1/orgs/${orgId}/bibs/import`, {
    method: 'POST',
    body: { ...input, mode: 'preview' satisfies CatalogCsvImportMode },
  });
}

export async function applyCatalogCsvImport(
  orgId: string,
  input: {
    actor_user_id: string;
    csv_text: string;
    default_location_id?: string;
    update_existing_items?: boolean;
    allow_relink_bibliographic?: boolean;
    source_filename?: string;
    source_note?: string;
  },
) {
  return await requestJson<CatalogCsvImportApplyResult>(`/api/v1/orgs/${orgId}/bibs/import`, {
    method: 'POST',
    body: { ...input, mode: 'apply' satisfies CatalogCsvImportMode },
  });
}

export async function listPolicies(orgId: string) {
  return await requestJson<CirculationPolicy[]>(
    `/api/v1/orgs/${orgId}/circulation-policies`,
    { method: 'GET' },
  );
}

export async function createPolicy(
  orgId: string,
  input: {
    code: string;
    name: string;
    audience_role: CirculationPolicy['audience_role'];
    loan_days: number;
    max_loans: number;
    max_renewals: number;
    max_holds: number;
    hold_pickup_days: number;
    overdue_block_days: number;
  },
) {
  return await requestJson<CirculationPolicy>(
    `/api/v1/orgs/${orgId}/circulation-policies`,
    { method: 'POST', body: input },
  );
}

export async function updatePolicy(
  orgId: string,
  policyId: string,
  input: {
    code?: string;
    name?: string;
    loan_days?: number;
    max_loans?: number;
    max_renewals?: number;
    max_holds?: number;
    hold_pickup_days?: number;
    overdue_block_days?: number;
    // is_active：只允許 true（設為有效）；停用由啟用另一筆政策完成
    is_active?: true;
  },
) {
  return await requestJson<CirculationPolicy>(
    `/api/v1/orgs/${orgId}/circulation-policies/${policyId}`,
    { method: 'PATCH', body: input },
  );
}

export async function listBibs(
  orgId: string,
  filters: {
    query?: string;
    // subjects_any：主題詞擴充查詢（thesaurus expand 後的 labels[]；用逗號串起來送出）
    subjects_any?: string;
    // subject_term_ids_any：term_id-driven 的主題詞擴充查詢（UUID[]；用逗號串起來送出）
    subject_term_ids_any?: string;
    // subject_term_ids：alias（同 subject_term_ids_any；行為為 ANY / 任一命中）
    subject_term_ids?: string;
    // geographics_any / geographic_term_ids_any：MARC 651（地理名稱）擴充查詢
    geographics_any?: string;
    geographic_term_ids_any?: string;
    geographic_term_ids?: string;
    // genres_any / genre_term_ids_any：MARC 655（類型/體裁）擴充查詢
    genres_any?: string;
    genre_term_ids_any?: string;
    genre_term_ids?: string;
    isbn?: string;
    classification?: string;
    limit?: number;
    cursor?: string;
  },
) {
  return await requestJson<CursorPage<BibliographicRecordWithCounts>>(`/api/v1/orgs/${orgId}/bibs`, {
    method: 'GET',
    query: filters,
  });
}

export async function createBib(
  orgId: string,
  input: {
    title: string;
    creators?: string[];
    creator_term_ids?: string[];
    contributors?: string[];
    contributor_term_ids?: string[];
    publisher?: string;
    published_year?: number;
    language?: string;
    subjects?: string[];
    subject_term_ids?: string[];
    geographics?: string[];
    geographic_term_ids?: string[];
    genres?: string[];
    genre_term_ids?: string[];
    isbn?: string;
    classification?: string;
  },
) {
  return await requestJson<BibliographicRecord>(`/api/v1/orgs/${orgId}/bibs`, {
    method: 'POST',
    body: input,
  });
}

export async function getBib(orgId: string, bibId: string) {
  return await requestJson<BibliographicRecordWithCounts>(
    `/api/v1/orgs/${orgId}/bibs/${bibId}`,
    { method: 'GET' },
  );
}

export async function updateBib(
  orgId: string,
  bibId: string,
  input: {
    title?: string;
    creators?: string[] | null;
    creator_term_ids?: string[] | null;
    contributors?: string[] | null;
    contributor_term_ids?: string[] | null;
    publisher?: string | null;
    published_year?: number | null;
    language?: string | null;
    subjects?: string[] | null;
    subject_term_ids?: string[] | null;
    geographics?: string[] | null;
    geographic_term_ids?: string[] | null;
    genres?: string[] | null;
    genre_term_ids?: string[] | null;
    isbn?: string | null;
    classification?: string | null;
  },
) {
  return await requestJson<BibliographicRecord>(
    `/api/v1/orgs/${orgId}/bibs/${bibId}`,
    { method: 'PATCH', body: input },
  );
}

export async function previewBackfillBibSubjectTerms(
  orgId: string,
  input: {
    actor_user_id: string;
    limit?: number;
    cursor?: string;
    only_missing?: boolean;
    vocabulary_code_for_new?: string;
    source_for_new?: string;
    prefer_vocabulary_codes?: string[];
    note?: string;
  },
) {
  return await requestJson<BackfillBibSubjectTermsPreviewResult>(
    `/api/v1/orgs/${orgId}/bibs/maintenance/backfill-subject-terms`,
    { method: 'POST', body: { ...input, mode: 'preview' } },
  );
}

export async function applyBackfillBibSubjectTerms(
  orgId: string,
  input: {
    actor_user_id: string;
    limit?: number;
    cursor?: string;
    only_missing?: boolean;
    vocabulary_code_for_new?: string;
    source_for_new?: string;
    prefer_vocabulary_codes?: string[];
    note?: string;
  },
) {
  return await requestJson<BackfillBibSubjectTermsApplyResult>(
    `/api/v1/orgs/${orgId}/bibs/maintenance/backfill-subject-terms`,
    { method: 'POST', body: { ...input, mode: 'apply' } },
  );
}

export async function previewBackfillBibNameTerms(
  orgId: string,
  input: {
    actor_user_id: string;
    limit?: number;
    cursor?: string;
    only_missing?: boolean;
    vocabulary_code_for_new?: string;
    source_for_new?: string;
    prefer_vocabulary_codes?: string[];
    note?: string;
  },
) {
  return await requestJson<BackfillBibNameTermsPreviewResult>(
    `/api/v1/orgs/${orgId}/bibs/maintenance/backfill-name-terms`,
    { method: 'POST', body: { ...input, mode: 'preview' } },
  );
}

export async function applyBackfillBibNameTerms(
  orgId: string,
  input: {
    actor_user_id: string;
    limit?: number;
    cursor?: string;
    only_missing?: boolean;
    vocabulary_code_for_new?: string;
    source_for_new?: string;
    prefer_vocabulary_codes?: string[];
    note?: string;
  },
) {
  return await requestJson<BackfillBibNameTermsApplyResult>(
    `/api/v1/orgs/${orgId}/bibs/maintenance/backfill-name-terms`,
    { method: 'POST', body: { ...input, mode: 'apply' } },
  );
}

export async function previewBackfillBibGeographicTerms(
  orgId: string,
  input: {
    actor_user_id: string;
    limit?: number;
    cursor?: string;
    only_missing?: boolean;
    vocabulary_code_for_new?: string;
    source_for_new?: string;
    prefer_vocabulary_codes?: string[];
    note?: string;
  },
) {
  return await requestJson<BackfillBibGeographicTermsPreviewResult>(
    `/api/v1/orgs/${orgId}/bibs/maintenance/backfill-geographic-terms`,
    { method: 'POST', body: { ...input, mode: 'preview' } },
  );
}

export async function applyBackfillBibGeographicTerms(
  orgId: string,
  input: {
    actor_user_id: string;
    limit?: number;
    cursor?: string;
    only_missing?: boolean;
    vocabulary_code_for_new?: string;
    source_for_new?: string;
    prefer_vocabulary_codes?: string[];
    note?: string;
  },
) {
  return await requestJson<BackfillBibGeographicTermsApplyResult>(
    `/api/v1/orgs/${orgId}/bibs/maintenance/backfill-geographic-terms`,
    { method: 'POST', body: { ...input, mode: 'apply' } },
  );
}

export async function previewBackfillBibGenreTerms(
  orgId: string,
  input: {
    actor_user_id: string;
    limit?: number;
    cursor?: string;
    only_missing?: boolean;
    vocabulary_code_for_new?: string;
    source_for_new?: string;
    prefer_vocabulary_codes?: string[];
    note?: string;
  },
) {
  return await requestJson<BackfillBibGenreTermsPreviewResult>(
    `/api/v1/orgs/${orgId}/bibs/maintenance/backfill-genre-terms`,
    { method: 'POST', body: { ...input, mode: 'preview' } },
  );
}

export async function applyBackfillBibGenreTerms(
  orgId: string,
  input: {
    actor_user_id: string;
    limit?: number;
    cursor?: string;
    only_missing?: boolean;
    vocabulary_code_for_new?: string;
    source_for_new?: string;
    prefer_vocabulary_codes?: string[];
    note?: string;
  },
) {
  return await requestJson<BackfillBibGenreTermsApplyResult>(
    `/api/v1/orgs/${orgId}/bibs/maintenance/backfill-genre-terms`,
    { method: 'POST', body: { ...input, mode: 'apply' } },
  );
}

// ----------------------------
// Bib → MARC 21 export + marc_extras
// ----------------------------

export async function getBibMarc(orgId: string, bibId: string) {
  return await requestJson<MarcRecord>(`/api/v1/orgs/${orgId}/bibs/${bibId}/marc`, {
    method: 'GET',
    query: { format: 'json' },
  });
}

export async function getBibMarcXml(orgId: string, bibId: string) {
  const result = await requestText(`/api/v1/orgs/${orgId}/bibs/${bibId}/marc`, {
    method: 'GET',
    query: { format: 'xml' },
    accept: 'application/marcxml+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
  });
  return result.text;
}

export async function getBibMarcMrc(orgId: string, bibId: string) {
  const result = await requestBytes(`/api/v1/orgs/${orgId}/bibs/${bibId}/marc`, {
    method: 'GET',
    query: { format: 'mrc' },
    accept: 'application/octet-stream, application/marc;q=0.9, */*;q=0.1',
  });
  return result.bytes;
}

export async function getBibMarcExtras(orgId: string, bibId: string) {
  return await requestJson<MarcField[]>(`/api/v1/orgs/${orgId}/bibs/${bibId}/marc-extras`, {
    method: 'GET',
  });
}

export async function updateBibMarcExtras(orgId: string, bibId: string, marc_extras: MarcField[]) {
  return await requestJson<MarcField[]>(`/api/v1/orgs/${orgId}/bibs/${bibId}/marc-extras`, {
    method: 'PUT',
    body: { marc_extras },
  });
}

export async function importMarcBatch(
  orgId: string,
  input: {
    actor_user_id: string;
    mode: MarcImportMode;
    records: Array<{
      bib: {
        title: string;
        creators?: string[];
        contributors?: string[];
        publisher?: string;
        published_year?: number;
        language?: string;
        subjects?: string[];
        geographics?: string[];
        genres?: string[];
        isbn?: string;
        classification?: string;
      };
      marc_extras?: MarcField[];
    }>;
    options?: {
      save_marc_extras?: boolean;
      upsert_authority_terms?: boolean;
      authority_vocabulary_code?: string;
    };
    decisions?: Array<{ index: number; decision: MarcImportDecision; target_bib_id?: string }>;
    source_filename?: string;
    source_note?: string;
  },
) {
  return await requestJson<MarcImportResult>(`/api/v1/orgs/${orgId}/bibs/import-marc`, {
    method: 'POST',
    body: input,
  });
}

// ----------------------------
// Authority / Vocabulary v0
// ----------------------------

export async function listAuthorityTerms(
  orgId: string,
  query: {
    kind: AuthorityTerm['kind'];
    query?: string;
    vocabulary_code?: string;
    status?: 'active' | 'inactive' | 'all';
    limit?: number;
    cursor?: string;
  },
) {
  return await requestJson<CursorPage<AuthorityTerm>>(`/api/v1/orgs/${orgId}/authority-terms`, {
    method: 'GET',
    query,
  });
}

export async function suggestAuthorityTerms(
  orgId: string,
  query: {
    kind: AuthorityTerm['kind'];
    q: string;
    vocabulary_code?: string;
    limit?: number;
  },
) {
  return await requestJson<AuthorityTerm[]>(`/api/v1/orgs/${orgId}/authority-terms/suggest`, {
    method: 'GET',
    query,
  });
}

export async function createAuthorityTerm(
  orgId: string,
  input: {
    kind: AuthorityTerm['kind'];
    preferred_label: string;
    vocabulary_code?: string;
    variant_labels?: string[];
    note?: string;
    status?: AuthorityTerm['status'];
    source?: string;
  },
) {
  return await requestJson<AuthorityTerm>(`/api/v1/orgs/${orgId}/authority-terms`, {
    method: 'POST',
    body: input,
  });
}

export async function updateAuthorityTerm(
  orgId: string,
  termId: string,
  input: {
    preferred_label?: string;
    vocabulary_code?: string;
    variant_labels?: string[] | null;
    note?: string | null;
    status?: AuthorityTerm['status'];
    source?: string;
  },
) {
  return await requestJson<AuthorityTerm>(`/api/v1/orgs/${orgId}/authority-terms/${termId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function getAuthorityTerm(orgId: string, termId: string) {
  return await requestJson<AuthorityTermDetail>(`/api/v1/orgs/${orgId}/authority-terms/${termId}`, {
    method: 'GET',
  });
}

export async function getAuthorityTermUsage(
  orgId: string,
  termId: string,
  query?: { limit?: number; cursor?: string },
) {
  return await requestJson<AuthorityTermUsageResult>(
    `/api/v1/orgs/${orgId}/authority-terms/${termId}/usage`,
    { method: 'GET', query: query ?? {} },
  );
}

export async function previewMergeAuthorityTerm(
  orgId: string,
  sourceTermId: string,
  input: {
    actor_user_id: string;
    target_term_id: string;
    deactivate_source_term?: boolean;
    merge_variant_labels?: boolean;
    move_relations?: boolean;
    note?: string;
  },
) {
  return await requestJson<MergeAuthorityTermPreviewResult>(
    `/api/v1/orgs/${orgId}/authority-terms/${sourceTermId}/merge`,
    { method: 'POST', body: { ...input, mode: 'preview' } },
  );
}

export async function applyMergeAuthorityTerm(
  orgId: string,
  sourceTermId: string,
  input: {
    actor_user_id: string;
    target_term_id: string;
    deactivate_source_term?: boolean;
    merge_variant_labels?: boolean;
    move_relations?: boolean;
    note?: string;
  },
) {
  return await requestJson<MergeAuthorityTermApplyResult>(
    `/api/v1/orgs/${orgId}/authority-terms/${sourceTermId}/merge`,
    { method: 'POST', body: { ...input, mode: 'apply' } },
  );
}

export async function addAuthorityTermRelation(
  orgId: string,
  termId: string,
  input: { kind: ThesaurusRelationKind; target_term_id: string },
) {
  return await requestJson<AuthorityTermDetail>(`/api/v1/orgs/${orgId}/authority-terms/${termId}/relations`, {
    method: 'POST',
    body: input,
  });
}

export async function deleteAuthorityTermRelation(orgId: string, termId: string, relationId: string) {
  return await requestJson<AuthorityTermDetail>(
    `/api/v1/orgs/${orgId}/authority-terms/${termId}/relations/${relationId}`,
    { method: 'DELETE' },
  );
}

export async function expandAuthorityTerm(orgId: string, termId: string, query?: { include?: string; depth?: number }) {
  return await requestJson<ThesaurusExpandResult>(`/api/v1/orgs/${orgId}/authority-terms/${termId}/expand`, {
    method: 'GET',
    query,
  });
}

export async function listThesaurusRoots(
  orgId: string,
  query: {
    kind: 'subject' | 'geographic' | 'genre';
    vocabulary_code: string;
    status?: 'active' | 'inactive' | 'all';
    query?: string;
    limit?: number;
    cursor?: string;
  },
) {
  return await requestJson<ThesaurusRootsPage>(`/api/v1/orgs/${orgId}/authority-terms/thesaurus/roots`, {
    method: 'GET',
    query,
  });
}

export async function listThesaurusChildren(
  orgId: string,
  termId: string,
  query?: { status?: 'active' | 'inactive' | 'all'; limit?: number; cursor?: string },
) {
  return await requestJson<ThesaurusChildrenPage>(`/api/v1/orgs/${orgId}/authority-terms/${termId}/thesaurus/children`, {
    method: 'GET',
    query: query ?? {},
  });
}

export async function getThesaurusAncestors(orgId: string, termId: string, query?: { depth?: number; max_paths?: number }) {
  return await requestJson<ThesaurusAncestorsResult>(`/api/v1/orgs/${orgId}/authority-terms/${termId}/thesaurus/ancestors`, {
    method: 'GET',
    query: query ?? {},
  });
}

export async function getThesaurusGraph(
  orgId: string,
  termId: string,
  query?: { direction?: 'narrower' | 'broader'; depth?: number; max_nodes?: number; max_edges?: number },
) {
  return await requestJson<ThesaurusGraphResult>(`/api/v1/orgs/${orgId}/authority-terms/${termId}/thesaurus/graph`, {
    method: 'GET',
    query: query ?? {},
  });
}

export async function getThesaurusQuality(
  orgId: string,
  query: {
    kind: 'subject' | 'geographic' | 'genre';
    vocabulary_code: string;
    status?: 'active' | 'inactive' | 'all';
    type: ThesaurusQualityIssueType;
    limit?: number;
    cursor?: string;
  },
) {
  return await requestJson<ThesaurusQualityPage>(`/api/v1/orgs/${orgId}/authority-terms/thesaurus/quality`, {
    method: 'GET',
    query,
  });
}

export async function exportThesaurusRelationsCsv(
  orgId: string,
  query: { kind: 'subject' | 'geographic' | 'genre'; vocabulary_code: string },
) {
  return await requestText(`/api/v1/orgs/${orgId}/authority-terms/thesaurus/relations/export`, {
    method: 'GET',
    query,
    accept: 'text/csv',
  });
}

export async function importThesaurusRelations(
  orgId: string,
  input: { kind: 'subject' | 'geographic' | 'genre'; vocabulary_code: string; mode: 'preview' | 'apply'; csv_text: string },
) {
  return await requestJson<ThesaurusRelationsImportResult>(`/api/v1/orgs/${orgId}/authority-terms/thesaurus/relations/import`, {
    method: 'POST',
    body: input,
  });
}

export async function listItems(
  orgId: string,
  filters: {
    barcode?: string;
    status?: ItemStatus;
    location_id?: string;
    bibliographic_id?: string;
    limit?: number;
    cursor?: string;
  },
) {
  return await requestJson<CursorPage<ItemCopy>>(`/api/v1/orgs/${orgId}/items`, {
    method: 'GET',
    query: filters,
  });
}

export async function createItem(
  orgId: string,
  bibId: string,
  input: {
    barcode: string;
    call_number: string;
    location_id: string;
    status?: ItemStatus;
    acquired_at?: string;
    last_inventory_at?: string;
    notes?: string;
  },
) {
  return await requestJson<ItemCopy>(`/api/v1/orgs/${orgId}/bibs/${bibId}/items`, {
    method: 'POST',
    body: input,
  });
}

export async function getItem(orgId: string, itemId: string) {
  return await requestJson<ItemDetail>(`/api/v1/orgs/${orgId}/items/${itemId}`, {
    method: 'GET',
  });
}

export async function updateItem(
  orgId: string,
  itemId: string,
  input: {
    barcode?: string;
    call_number?: string;
    location_id?: string;
    acquired_at?: string | null;
    last_inventory_at?: string | null;
    notes?: string | null;
  },
) {
  return await requestJson<ItemCopy>(`/api/v1/orgs/${orgId}/items/${itemId}`, {
    method: 'PATCH',
    body: input,
  });
}

/**
 * Item status actions（冊異常狀態動作）
 *
 * 注意：這些動作會影響流通與報表，因此：
 * - 需要 actor_user_id（館員/管理者）
 * - 後端會寫入 audit_events，方便在 `/audit-events` 追溯
 */

export async function markItemLost(
  orgId: string,
  itemId: string,
  input: { actor_user_id: string; note?: string },
) {
  return await requestJson<ItemCopy>(`/api/v1/orgs/${orgId}/items/${itemId}/mark-lost`, {
    method: 'POST',
    body: input,
  });
}

export async function markItemRepair(
  orgId: string,
  itemId: string,
  input: { actor_user_id: string; note?: string },
) {
  return await requestJson<ItemCopy>(`/api/v1/orgs/${orgId}/items/${itemId}/mark-repair`, {
    method: 'POST',
    body: input,
  });
}

export async function markItemWithdrawn(
  orgId: string,
  itemId: string,
  input: { actor_user_id: string; note?: string },
) {
  return await requestJson<ItemCopy>(
    `/api/v1/orgs/${orgId}/items/${itemId}/mark-withdrawn`,
    {
      method: 'POST',
      body: input,
    },
  );
}

// ----------------------------
// Inventory（盤點）
// ----------------------------

export async function createInventorySession(
  orgId: string,
  input: { actor_user_id: string; location_id: string; note?: string },
) {
  return await requestJson<InventorySessionWithDetails>(`/api/v1/orgs/${orgId}/inventory/sessions`, {
    method: 'POST',
    body: input,
  });
}

export async function listInventorySessions(
  orgId: string,
  query?: { location_id?: string; status?: 'open' | 'closed' | 'all'; limit?: number },
) {
  return await requestJson<InventorySessionWithDetails[]>(`/api/v1/orgs/${orgId}/inventory/sessions`, {
    method: 'GET',
    query: query ?? {},
  });
}

export async function scanInventoryItem(
  orgId: string,
  sessionId: string,
  input: { actor_user_id: string; item_barcode: string },
) {
  return await requestJson<InventoryScanResult>(
    `/api/v1/orgs/${orgId}/inventory/sessions/${sessionId}/scan`,
    {
      method: 'POST',
      body: input,
    },
  );
}

export async function closeInventorySession(
  orgId: string,
  sessionId: string,
  input: { actor_user_id: string; note?: string },
) {
  return await requestJson<CloseInventorySessionResult>(
    `/api/v1/orgs/${orgId}/inventory/sessions/${sessionId}/close`,
    {
      method: 'POST',
      body: input,
    },
  );
}

export async function checkout(
  orgId: string,
  input: { user_external_id: string; item_barcode: string; actor_user_id: string },
) {
  return await requestJson<CheckoutResult>(`/api/v1/orgs/${orgId}/circulation/checkout`, {
    method: 'POST',
    body: input,
  });
}

export async function checkin(
  orgId: string,
  input: { item_barcode: string; actor_user_id: string },
) {
  return await requestJson<CheckinResult>(`/api/v1/orgs/${orgId}/circulation/checkin`, {
    method: 'POST',
    body: input,
  });
}

export async function listLoans(
  orgId: string,
  filters: {
    status?: 'open' | 'closed' | 'all';
    user_external_id?: string;
    item_barcode?: string;
    limit?: number;
    cursor?: string;
  },
) {
  return await requestJson<CursorPage<LoanWithDetails>>(`/api/v1/orgs/${orgId}/loans`, {
    method: 'GET',
    query: filters,
  });
}

export async function renewLoan(
  orgId: string,
  input: { loan_id: string; actor_user_id: string },
) {
  return await requestJson<RenewResult>(`/api/v1/orgs/${orgId}/circulation/renew`, {
    method: 'POST',
    body: input,
  });
}

// loans maintenance：借閱歷史保存期限（US-061）
export async function previewPurgeLoanHistory(
  orgId: string,
  input: {
    actor_user_id: string;
    retention_days: number;
    as_of?: string;
    limit?: number;
    include_audit_events?: boolean;
    note?: string;
  },
) {
  return await requestJson<PurgeLoanHistoryPreviewResult>(`/api/v1/orgs/${orgId}/loans/purge-history`, {
    method: 'POST',
    body: { ...input, mode: 'preview' as const },
  });
}

export async function applyPurgeLoanHistory(
  orgId: string,
  input: {
    actor_user_id: string;
    retention_days: number;
    as_of?: string;
    limit?: number;
    include_audit_events?: boolean;
    note?: string;
  },
) {
  return await requestJson<PurgeLoanHistoryApplyResult>(`/api/v1/orgs/${orgId}/loans/purge-history`, {
    method: 'POST',
    body: { ...input, mode: 'apply' as const },
  });
}

/**
 * Holds（預約/保留）
 *
 * 這組 API 同時支援：
 * - Web Console（館員）：會傳 actor_user_id（admin/librarian），便於 audit
 * - OPAC 自助：不傳 actor_user_id（MVP 無登入，後端視為 borrower 本人）
 */

export async function listHolds(
  orgId: string,
  filters: {
    status?: HoldStatus | 'all';
    user_external_id?: string;
    item_barcode?: string;
    bibliographic_id?: string;
    pickup_location_id?: string;
    limit?: number;
    cursor?: string;
  },
) {
  return await requestJson<CursorPage<HoldWithDetails>>(`/api/v1/orgs/${orgId}/holds`, {
    method: 'GET',
    query: filters,
  });
}

export async function createHold(
  orgId: string,
  input: {
    bibliographic_id: string;
    user_external_id: string;
    pickup_location_id: string;
    actor_user_id?: string;
  },
) {
  return await requestJson<HoldWithDetails>(`/api/v1/orgs/${orgId}/holds`, {
    method: 'POST',
    body: input,
  });
}

export async function cancelHold(
  orgId: string,
  holdId: string,
  input: { actor_user_id?: string },
) {
  return await requestJson<HoldWithDetails>(`/api/v1/orgs/${orgId}/holds/${holdId}/cancel`, {
    method: 'POST',
    body: input,
  });
}

export async function fulfillHold(
  orgId: string,
  holdId: string,
  input: { actor_user_id: string },
) {
  return await requestJson<FulfillHoldResult>(`/api/v1/orgs/${orgId}/holds/${holdId}/fulfill`, {
    method: 'POST',
    body: input,
  });
}

export async function previewExpireReadyHolds(
  orgId: string,
  input: { actor_user_id: string; as_of?: string; limit?: number; note?: string },
) {
  return await requestJson<ExpireReadyHoldsPreviewResult>(`/api/v1/orgs/${orgId}/holds/expire-ready`, {
    method: 'POST',
    body: { ...input, mode: 'preview' as const },
  });
}

export async function applyExpireReadyHolds(
  orgId: string,
  input: { actor_user_id: string; as_of?: string; limit?: number; note?: string },
) {
  return await requestJson<ExpireReadyHoldsApplyResult>(`/api/v1/orgs/${orgId}/holds/expire-ready`, {
    method: 'POST',
    body: { ...input, mode: 'apply' as const },
  });
}

/**
 * Reports（報表）
 *
 * MVP 先把「學校每天會用」的查詢做成可匯出（JSON/CSV）的報表：
 * - ready-holds：取書架清單（可取書）
 * - overdue：逾期清單
 * - inventory-diff：盤點差異清單
 * - US-050：熱門書、借閱量彙總
 *
 * 設計：
 * - 報表通常包含敏感資料，因此要求 `actor_user_id`（admin/librarian）
 * - 同一個 endpoint 可用 `format=csv` 下載 CSV
 */

export async function getInventoryDiffReport(
  orgId: string,
  filters: { actor_user_id: string; inventory_session_id: string; limit?: number },
) {
  return await requestJson<InventoryDiffResult>(`/api/v1/orgs/${orgId}/reports/inventory-diff`, {
    method: 'GET',
    query: { ...filters, format: 'json' },
  });
}

export async function downloadInventoryDiffReportCsv(
  orgId: string,
  filters: { actor_user_id: string; inventory_session_id: string; limit?: number },
) {
  const result = await requestText(`/api/v1/orgs/${orgId}/reports/inventory-diff`, {
    method: 'GET',
    query: { ...filters, format: 'csv' },
    accept: 'text/csv',
  });

  return result.text;
}

export async function listReadyHoldsReport(
  orgId: string,
  filters: {
    actor_user_id: string;
    as_of?: string;
    pickup_location_id?: string;
    limit?: number;
  },
) {
  return await requestJson<ReadyHoldsReportRow[]>(`/api/v1/orgs/${orgId}/reports/ready-holds`, {
    method: 'GET',
    query: { ...filters, format: 'json' },
  });
}

export async function downloadReadyHoldsReportCsv(
  orgId: string,
  filters: {
    actor_user_id: string;
    as_of?: string;
    pickup_location_id?: string;
    limit?: number;
  },
) {
  const result = await requestText(`/api/v1/orgs/${orgId}/reports/ready-holds`, {
    method: 'GET',
    query: { ...filters, format: 'csv' },
    accept: 'text/csv',
  });

  return result.text;
}

export async function listOverdueReport(
  orgId: string,
  filters: {
    actor_user_id: string;
    as_of?: string;
    org_unit?: string;
    limit?: number;
  },
) {
  return await requestJson<OverdueReportRow[]>(`/api/v1/orgs/${orgId}/reports/overdue`, {
    method: 'GET',
    query: { ...filters, format: 'json' },
  });
}

export async function downloadOverdueReportCsv(
  orgId: string,
  filters: {
    actor_user_id: string;
    as_of?: string;
    org_unit?: string;
    limit?: number;
  },
) {
  const result = await requestText(`/api/v1/orgs/${orgId}/reports/overdue`, {
    method: 'GET',
    query: { ...filters, format: 'csv' },
    accept: 'text/csv',
  });

  return result.text;
}

export async function listZeroCirculationReport(
  orgId: string,
  filters: { actor_user_id: string; from: string; to: string; limit?: number },
) {
  return await requestJson<ZeroCirculationReportRow[]>(
    `/api/v1/orgs/${orgId}/reports/zero-circulation`,
    {
      method: 'GET',
      query: { ...filters, format: 'json' },
    },
  );
}

export async function downloadZeroCirculationReportCsv(
  orgId: string,
  filters: { actor_user_id: string; from: string; to: string; limit?: number },
) {
  const result = await requestText(`/api/v1/orgs/${orgId}/reports/zero-circulation`, {
    method: 'GET',
    query: { ...filters, format: 'csv' },
    accept: 'text/csv',
  });

  return result.text;
}

export async function listTopCirculationReport(
  orgId: string,
  filters: { actor_user_id: string; from: string; to: string; limit?: number },
) {
  return await requestJson<TopCirculationRow[]>(
    `/api/v1/orgs/${orgId}/reports/top-circulation`,
    {
      method: 'GET',
      query: { ...filters, format: 'json' },
    },
  );
}

export async function downloadTopCirculationReportCsv(
  orgId: string,
  filters: { actor_user_id: string; from: string; to: string; limit?: number },
) {
  const result = await requestText(`/api/v1/orgs/${orgId}/reports/top-circulation`, {
    method: 'GET',
    query: { ...filters, format: 'csv' },
    accept: 'text/csv',
  });

  return result.text;
}

export async function listCirculationSummaryReport(
  orgId: string,
  filters: { actor_user_id: string; from: string; to: string; group_by: 'day' | 'week' | 'month' },
) {
  return await requestJson<CirculationSummaryRow[]>(
    `/api/v1/orgs/${orgId}/reports/circulation-summary`,
    {
      method: 'GET',
      query: { ...filters, format: 'json' },
    },
  );
}

export async function downloadCirculationSummaryReportCsv(
  orgId: string,
  filters: { actor_user_id: string; from: string; to: string; group_by: 'day' | 'week' | 'month' },
) {
  const result = await requestText(`/api/v1/orgs/${orgId}/reports/circulation-summary`, {
    method: 'GET',
    query: { ...filters, format: 'csv' },
    accept: 'text/csv',
  });

  return result.text;
}

/**
 * Audit Events（稽核事件）
 *
 * - 查詢端點：`GET /api/v1/orgs/:orgId/audit-events`
 * - MVP 權限：要求 `actor_user_id`（查詢者）為 admin/librarian
 */

export async function listAuditEvents(
  orgId: string,
  filters: {
    actor_user_id: string;
    from?: string;
    to?: string;
    action?: string;
    entity_type?: string;
    entity_id?: string;
    actor_query?: string;
    limit?: number;
  },
) {
  return await requestJson<AuditEventRow[]>(`/api/v1/orgs/${orgId}/audit-events`, {
    method: 'GET',
    query: filters,
  });
}
