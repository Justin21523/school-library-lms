/**
 * AuthorityService
 *
 * 這個 service 管「authority_terms（controlled vocab 主檔）」與 thesaurus 關係：
 * - CRUD + 搜尋/建議（autocomplete / 管理頁 / 編目輔助）
 * - subject thesaurus：BT/NT/RT + expand（檢索擴充）
 * - governance：usage + merge/redirect（v1.3：subject/geographic/genre 已可用；其他 kinds 依需求擴充）
 *
 * v1 的核心方向：
 * - 編目逐步改成 term_id-driven（避免靠字串長相）：
 *   - subjects：`bibliographic_subject_terms`
 *   - names：`bibliographic_name_terms`
 * - 本檔仍維持「主檔與關係治理」的角色；書目寫入/回寫由 BibsService 負責。
 */

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { parseCsv } from '../common/csv';
import {
  decodeCursorTextV1,
  decodeCursorV1,
  encodeCursorTextV1,
  encodeCursorV1,
  normalizeSortToIso,
  type CursorPage,
} from '../common/cursor';
import { DbService } from '../db/db.service';
import type {
  AuthorityTermKind,
  AuthorityTermUsageQuery,
  CreateAuthorityTermInput,
  CreateThesaurusRelationInput,
  ExportThesaurusRelationsQuery,
  ExpandThesaurusQuery,
  ImportThesaurusRelationsInput,
  ListAuthorityTermsQuery,
  ListThesaurusChildrenQuery,
  ListThesaurusRootsQuery,
  MergeAuthorityTermInput,
  SuggestAuthorityTermsQuery,
  ThesaurusAncestorsQuery,
  ThesaurusGraphQuery,
  ThesaurusQualityQuery,
  UpdateAuthorityTermInput,
} from './authority.schemas';

// AuthorityTermRow：對應 authority_terms 欄位（snake_case 對齊 SQL）
export type AuthorityTermRow = {
  id: string;
  organization_id: string;
  kind: AuthorityTermKind;
  vocabulary_code: string;
  preferred_label: string;
  variant_labels: string[] | null;
  note: string | null;
  source: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type AuthorityTermSummaryRow = {
  id: string;
  kind: AuthorityTermKind;
  vocabulary_code: string;
  preferred_label: string;
  status: 'active' | 'inactive';
  source: string;
};

type AuthorityTermRelationType = 'broader' | 'related';

type AuthorityTermRelationRow = {
  id: string;
  organization_id: string;
  from_term_id: string;
  relation_type: AuthorityTermRelationType;
  to_term_id: string;
  created_at: string;
  updated_at: string;
};

export type AuthorityTermDetailResult = {
  term: AuthorityTermRow;
  relations: {
    broader: Array<{ relation_id: string; term: AuthorityTermSummaryRow }>;
    narrower: Array<{ relation_id: string; term: AuthorityTermSummaryRow }>;
    related: Array<{ relation_id: string; term: AuthorityTermSummaryRow }>;
  };
};

export type ThesaurusExpandResult = {
  term: AuthorityTermRow;
  include: Array<'self' | 'variants' | 'broader' | 'narrower' | 'related'>;
  depth: number;
  labels: string[];
  // term_ids：供 term_id-driven 檢索擴充使用（對應 labels 的「terms 集合」，不含 variants 的獨立 id）
  // - include 含 self 或 variants 時，term_ids 會包含 term.id（因為 variants 仍指向同一個 term）
  // - broader/narrower/related 會加入對應 terms 的 id
  term_ids: string[];
  broader_terms: AuthorityTermSummaryRow[];
  narrower_terms: AuthorityTermSummaryRow[];
  related_terms: AuthorityTermSummaryRow[];
  variant_labels: string[];
};

export type ThesaurusNodeSummary = AuthorityTermSummaryRow & {
  // broader_count：這個 term 有幾個 BT（polyhierarchy 時可能 > 1）
  broader_count: number;
  // narrower_count：這個 term 有幾個直接 NT（children）
  narrower_count: number;
  // has_children：UI 展開用（比 children_count 更常用）
  has_children: boolean;
};

export type ThesaurusRootsResult = CursorPage<ThesaurusNodeSummary>;

export type ThesaurusChildrenResult = CursorPage<{
  relation_id: string;
  term: ThesaurusNodeSummary;
}>;

export type ThesaurusAncestorsResult = {
  term: AuthorityTermSummaryRow;
  depth: number;
  max_paths: number;
  truncated: boolean;
  // paths：root → ... → term（polyhierarchy 可能多條）
  paths: Array<{ is_complete: boolean; nodes: AuthorityTermSummaryRow[] }>;
};

export type ThesaurusGraphResult = {
  term: AuthorityTermSummaryRow;
  direction: 'narrower' | 'broader';
  depth: number;
  max_nodes: number;
  max_edges: number;
  truncated: boolean;
  nodes: AuthorityTermSummaryRow[];
  edges: Array<{ relation_id: string; from_term_id: string; to_term_id: string; relation_type: 'broader' }>;
};

export type ThesaurusQualityResult = CursorPage<
  ThesaurusNodeSummary & {
    issue_type: 'orphans' | 'multi_broader' | 'unused_with_relations';
  }
>;

export type ImportThesaurusRelationsPreviewResult = {
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
};

export type ImportThesaurusRelationsApplyResult = {
  mode: 'apply';
  summary: {
    total_rows: number;
    create_count: number;
    skip_existing_count: number;
    error_count: number;
  };
};

export type ImportThesaurusRelationsResult = ImportThesaurusRelationsPreviewResult | ImportThesaurusRelationsApplyResult;

// ----------------------------
// Governance：usage + merge/redirect（subject term）
// ----------------------------

export type AuthorityTermUsageItem = {
  bibliographic_id: string;
  title: string;
  isbn: string | null;
  classification: string | null;
  created_at: string;
  // roles：只有 name term 會回傳（因為 bibliographic_name_terms 有 role 維度）
  // - 其他 kinds（subject/geographic/genre）回 undefined
  roles?: Array<'creator' | 'contributor'>;
};

export type AuthorityTermUsageResult = CursorPage<AuthorityTermUsageItem> & {
  term_id: string;
  total_bibs: number;
};

export type MergeAuthorityTermPreviewResult = {
  mode: 'preview';
  source_term: AuthorityTermRow;
  target_term: AuthorityTermRow;
  summary: {
    bibs_affected: number;
    bibs_updated: number;
    // variant_labels_added：實際新增到 target.variant_labels 的數量（去重後）
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

// 注意：不能用 intersection 直接覆蓋 mode，因為：
// - MergeAuthorityTermPreviewResult.mode 是 'preview'
// - 'preview' & 'apply' 會變成 never（TypeScript 交集型別）
// 因此用 Omit 把 mode 拿掉後再加回來。
export type MergeAuthorityTermApplyResult = Omit<MergeAuthorityTermPreviewResult, 'mode'> & {
  mode: 'apply';
  audit_event_id: string;
};

export type MergeAuthorityTermResult = MergeAuthorityTermPreviewResult | MergeAuthorityTermApplyResult;

@Injectable()
export class AuthorityService {
  constructor(private readonly db: DbService) {}

  /**
   * list（管理頁用）
   *
   * - 支援 query：模糊搜尋（preferred_label + variant_labels）
   * - 支援 cursor pagination：對齊本專案大量資料的 keyset 模式
   */
  async list(orgId: string, query: ListAuthorityTermsQuery): Promise<CursorPage<AuthorityTermRow>> {
    const search = query.query?.trim() ? `%${query.query.trim()}%` : null;
    const vocabularyCode = query.vocabulary_code?.trim() ? query.vocabulary_code.trim() : null;

    // status：
    // - 不提供 → 預設 active（一般使用情境）
    // - all → 不過濾（管理頁可看全部）
    const status =
      !query.status || query.status === 'active'
        ? 'active'
        : query.status === 'inactive'
          ? 'inactive'
          : null;

    // cursor：排序鍵用 created_at DESC, id DESC（與 bibs/users 類似）
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

    const result = await this.db.query<AuthorityTermRow>(
      `
      SELECT
        id,
        organization_id,
        kind,
        vocabulary_code,
        preferred_label,
        variant_labels,
        note,
        source,
        status,
        created_at,
        updated_at
      FROM authority_terms
      WHERE organization_id = $1
        AND kind = $2::authority_term_kind
        AND ($3::text IS NULL OR vocabulary_code = $3)
        AND ($4::user_status IS NULL OR status = $4::user_status)
        AND (
          $5::text IS NULL
          OR (preferred_label || ' ' || COALESCE(array_to_string(variant_labels, ' '), '')) ILIKE $5
        )
        AND (
          $6::timestamptz IS NULL
          OR (created_at, id) < ($6::timestamptz, $7::uuid)
        )
      ORDER BY created_at DESC, id DESC
      LIMIT $8
      `,
      [orgId, query.kind, vocabularyCode, status, search, cursorSort, cursorId, queryLimit],
    );

    const rows = result.rows;
    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;

    const last = items.at(-1) ?? null;
    const next_cursor =
      hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.id }) : null;

    return { items, next_cursor };
  }

  /**
   * suggest（autocomplete）
   *
   * - 回傳 array（不包 cursor），因為 autocomplete 通常只需要前 10~20 筆
   * - 仍會過濾 status=active（避免停用款目被選到）
   */
  async suggest(orgId: string, query: SuggestAuthorityTermsQuery): Promise<AuthorityTermRow[]> {
    const q = query.q.trim();
    const like = `%${q}%`;
    const vocabularyCode = query.vocabulary_code?.trim() ? query.vocabulary_code.trim() : null;
    const limit = query.limit ?? 20;

    // 使用 pg_trgm 的 similarity 做排序（但仍先用 ILIKE 篩選）
    // - ILIKE 會吃到 authority_terms_search_trgm index（加速）
    // - similarity 讓結果更接近「像真的 autocomplete」
    const result = await this.db.query<AuthorityTermRow & { score: number }>(
      `
      SELECT
        id,
        organization_id,
        kind,
        vocabulary_code,
        preferred_label,
        variant_labels,
        note,
        source,
        status,
        created_at,
        updated_at,
        GREATEST(
          similarity(preferred_label, $3),
          similarity(COALESCE(array_to_string(variant_labels, ' '), ''), $3)
        ) AS score
      FROM authority_terms
      WHERE organization_id = $1
        AND kind = $2::authority_term_kind
        AND status = 'active'::user_status
        AND ($4::text IS NULL OR vocabulary_code = $4)
        AND (
          preferred_label ILIKE $5
          OR COALESCE(array_to_string(variant_labels, ' '), '') ILIKE $5
        )
      ORDER BY score DESC, preferred_label ASC, id ASC
      LIMIT $6
      `,
      [orgId, query.kind, q, vocabularyCode, like, limit],
    );

    // score 只用於排序；回傳給前端的 shape 先不包含它（避免 API shape 太早固定）
    return result.rows.map(({ score: _score, ...row }) => row);
  }

  async create(orgId: string, input: CreateAuthorityTermInput): Promise<AuthorityTermRow> {
    const vocabularyCode = input.vocabulary_code?.trim() ? input.vocabulary_code.trim() : 'local';
    const status = input.status ?? 'active';
    const source = input.source?.trim() ? input.source.trim() : 'local';

    try {
      const result = await this.db.query<AuthorityTermRow>(
        `
        INSERT INTO authority_terms (
          organization_id,
          kind,
          vocabulary_code,
          preferred_label,
          variant_labels,
          note,
          source,
          status
        )
        VALUES ($1, $2::authority_term_kind, $3, $4, $5, $6, $7, $8::user_status)
        RETURNING
          id,
          organization_id,
          kind,
          vocabulary_code,
          preferred_label,
          variant_labels,
          note,
          source,
          status,
          created_at,
          updated_at
        `,
        [
          orgId,
          input.kind,
          vocabularyCode,
          input.preferred_label.trim(),
          input.variant_labels ?? null,
          input.note ?? null,
          source,
          status,
        ],
      );
      return result.rows[0]!;
    } catch (error: any) {
      // 23503 foreign_key_violation：org 不存在
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }
      // 23505 unique_violation：同 org/kind/vocabulary_code 下 preferred_label 重複
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'Authority term already exists' },
        });
      }
      throw error;
    }
  }

  async update(orgId: string, termId: string, input: UpdateAuthorityTermInput): Promise<AuthorityTermRow> {
    const setClauses: string[] = [];
    const params: unknown[] = [orgId, termId];

    const addClause = (column: string, value: unknown, cast?: string) => {
      params.push(value);
      const placeholder = `$${params.length}${cast ? `::${cast}` : ''}`;
      setClauses.push(`${column} = ${placeholder}`);
    };

    if (input.preferred_label !== undefined) addClause('preferred_label', input.preferred_label.trim());
    if (input.vocabulary_code !== undefined) addClause('vocabulary_code', input.vocabulary_code.trim());
    if (input.variant_labels !== undefined) addClause('variant_labels', input.variant_labels);
    if (input.note !== undefined) addClause('note', input.note);
    if (input.source !== undefined) addClause('source', input.source.trim());
    if (input.status !== undefined) addClause('status', input.status, 'user_status');

    if (setClauses.length === 0) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
      });
    }

    // updated_at：一律更新（管理頁排序/同步常用）
    setClauses.push('updated_at = now()');

    try {
      const result = await this.db.query<AuthorityTermRow>(
        `
        UPDATE authority_terms
        SET ${setClauses.join(', ')}
        WHERE organization_id = $1
          AND id = $2
        RETURNING
          id,
          organization_id,
          kind,
          vocabulary_code,
          preferred_label,
          variant_labels,
          note,
          source,
          status,
          created_at,
          updated_at
        `,
        params,
      );

      if (result.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Authority term not found' },
        });
      }

      return result.rows[0]!;
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'Authority term already exists' },
        });
      }
      throw error;
    }
  }

  // ----------------------------
  // Thesaurus v1（BT/NT/RT）
  // ----------------------------

  /**
   * getById：款目詳情 + BT/NT/RT
   *
   * 這個端點主要用於：
   * - thesaurus 管理 UI（館員維護關係）
   * - 後續檢索擴充（例如：搜尋某主題時，自動展開 NT/RT/UF）
   */
  async getById(orgId: string, termId: string): Promise<AuthorityTermDetailResult> {
    return await this.db.withClient(async (client) => await this.getByIdWithClient(client, orgId, termId));
  }

  /**
   * getUsage：term 被哪些書目使用（治理用）
   *
   * v1.3+：支援 subject/name/geographic/genre（對應各自的 junction table）
   * - subject：bibliographic_subject_terms
   * - name：bibliographic_name_terms（role=creator|contributor）
   * - geographic：bibliographic_geographic_terms
   * - genre：bibliographic_genre_terms
   */
  async getUsage(orgId: string, termId: string, query: AuthorityTermUsageQuery): Promise<AuthorityTermUsageResult> {
    // 先確保 term 存在（避免 UI 顯示「0」但其實是 404）
    const term = await this.db.withClient(async (client) => await this.requireTermById(client, orgId, termId));

    // cursor：沿用 created_at DESC, id DESC 的 keyset（對齊 bibs list）
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

    // name：link table 有 role 維度，因此 usage 需要「每筆 bib 聚合 roles」
    if (term.kind === 'name') {
      const total = await this.db.query<{ total_bibs: number }>(
        `
        SELECT COUNT(DISTINCT bibliographic_id)::int AS total_bibs
        FROM bibliographic_name_terms
        WHERE organization_id = $1
          AND term_id = $2
        `,
        [orgId, termId],
      );

      const result = await this.db.query<
        AuthorityTermUsageItem & { roles: Array<'creator' | 'contributor'> }
      >(
        `
        SELECT
          b.id AS bibliographic_id,
          b.title,
          b.isbn,
          b.classification,
          b.created_at,
          array_agg(DISTINCT x.role ORDER BY x.role) AS roles
        FROM bibliographic_name_terms x
        JOIN bibliographic_records b
          ON b.organization_id = x.organization_id
         AND b.id = x.bibliographic_id
        WHERE x.organization_id = $1
          AND x.term_id = $2
          AND (
            $3::timestamptz IS NULL
            OR (b.created_at, b.id) < ($3::timestamptz, $4::uuid)
          )
        GROUP BY b.id, b.title, b.isbn, b.classification, b.created_at
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT $5
        `,
        [orgId, termId, cursorSort, cursorId, queryLimit],
      );

      const rows = result.rows;
      const items = rows.slice(0, pageSize);
      const hasMore = rows.length > pageSize;
      const last = items.at(-1) ?? null;
      const next_cursor =
        hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.bibliographic_id }) : null;

      return { term_id: termId, total_bibs: total.rows[0]?.total_bibs ?? 0, items, next_cursor };
    }

    const linkTable =
      term.kind === 'subject'
        ? 'bibliographic_subject_terms'
        : term.kind === 'geographic'
          ? 'bibliographic_geographic_terms'
          : term.kind === 'genre'
            ? 'bibliographic_genre_terms'
            : null;

    if (!linkTable) {
      throw new BadRequestException({
        error: {
          code: 'RELATION_NOT_SUPPORTED',
          message: 'usage endpoint currently supports subject/name/geographic/genre terms only (v1.3+)',
        },
      });
    }

    const total = await this.db.query<{ total_bibs: number }>(
      `
      SELECT COUNT(*)::int AS total_bibs
      FROM ${linkTable}
      WHERE organization_id = $1
        AND term_id = $2
      `,
      [orgId, termId],
    );

    const result = await this.db.query<AuthorityTermUsageItem>(
      `
      SELECT
        b.id AS bibliographic_id,
        b.title,
        b.isbn,
        b.classification,
        b.created_at
      FROM ${linkTable} x
      JOIN bibliographic_records b
        ON b.organization_id = x.organization_id
       AND b.id = x.bibliographic_id
      WHERE x.organization_id = $1
        AND x.term_id = $2
        AND (
          $3::timestamptz IS NULL
          OR (b.created_at, b.id) < ($3::timestamptz, $4::uuid)
        )
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT $5
      `,
      [orgId, termId, cursorSort, cursorId, queryLimit],
    );

    const rows = result.rows;
    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;
    const last = items.at(-1) ?? null;
    const next_cursor =
      hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.bibliographic_id }) : null;

    return { term_id: termId, total_bibs: total.rows[0]?.total_bibs ?? 0, items, next_cursor };
  }

  /**
   * merge：把 source term 併入 target term（治理）
   *
   * 你要求的行為：
   * - usage（上面 getUsage）先讓你看影響範圍
   * - merge/redirect（這裡）提供 preview/apply
   * - merge 時：
   *   - 批次更新 junction table（把 term_id 指到 target，並保序去重）
   *   - 把舊詞收進 target.variant_labels（方便搜尋舊用詞）
   *   - 搬移 thesaurus relations（同 vocabulary_code 才搬；避免跨詞彙庫亂連）
   *   - 可選：停用 source term（保留 row 追溯）
   */
  async merge(orgId: string, sourceTermId: string, input: MergeAuthorityTermInput): Promise<MergeAuthorityTermResult> {
    if (sourceTermId === input.target_term_id) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'target_term_id must be different from termId' },
      });
    }

    const deactivateSource = input.deactivate_source_term ?? true;
    const mergeVariantLabels = input.merge_variant_labels ?? true;
    const moveRelations = input.move_relations ?? true;

    // preview/apply：用同一套 SQL，preview 最後 ROLLBACK，apply 才 COMMIT（確保結果可重現）
    return await this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const warnings: string[] = [];

        // 1) term existence + scope check
        const source = await this.requireTermById(client, orgId, sourceTermId);
        const target = await this.requireTermById(client, orgId, input.target_term_id);

        if (source.kind !== target.kind) {
          throw new BadRequestException({
            error: { code: 'TERM_KIND_MISMATCH', message: 'Terms must have the same kind' },
          });
        }

        const mergeConfig =
          source.kind === 'subject'
            ? { kind: 'array' as const, linkTable: 'bibliographic_subject_terms', bibColumn: 'subjects' as const }
            : source.kind === 'geographic'
              ? { kind: 'array' as const, linkTable: 'bibliographic_geographic_terms', bibColumn: 'geographics' as const }
              : source.kind === 'genre'
                ? { kind: 'array' as const, linkTable: 'bibliographic_genre_terms', bibColumn: 'genres' as const }
                : source.kind === 'name'
                  ? { kind: 'name' as const, linkTable: 'bibliographic_name_terms' as const }
                  : null;

        // v1.3+：聚焦「已落地 junction table」的 kinds（subject/name/geographic/genre）
        if (!mergeConfig) {
          throw new BadRequestException({
            error: { code: 'RELATION_NOT_SUPPORTED', message: 'merge currently supports subject/name/geographic/genre terms only (v1.3+)' },
          });
        }

        // 2) 更新 bib links（term_id-driven junction tables）
        //
        // - subject/geographic/genre：單純 (bib_id, term_id, position)
        // - name：多一個 role（creator/contributor），且 bib 端有兩個欄位 creators[]/contributors[] 需要同步正規化
        let bibsUpdated = 0;
        let bibsAffected = 0;

        if (mergeConfig.kind === 'name') {
          const affectedRows = await client.query<{ bibliographic_id: string; role: 'creator' | 'contributor' }>(
            `
            SELECT bibliographic_id, role
            FROM bibliographic_name_terms
            WHERE organization_id = $1
              AND term_id = $2
            `,
            [orgId, source.id],
          );

          const rolesByBib = new Map<string, Set<'creator' | 'contributor'>>();
          for (const r of affectedRows.rows) {
            const set = rolesByBib.get(r.bibliographic_id) ?? new Set<'creator' | 'contributor'>();
            set.add(r.role);
            rolesByBib.set(r.bibliographic_id, set);
          }

          bibsAffected = rolesByBib.size;

          for (const [bibId, roles] of rolesByBib.entries()) {
            for (const role of roles) {
              const current = await client.query<{ term_id: string }>(
                `
                SELECT term_id
                FROM bibliographic_name_terms
                WHERE organization_id = $1
                  AND bibliographic_id = $2
                  AND role = $3
                ORDER BY position ASC
                `,
                [orgId, bibId, role],
              );

              const nextIds: string[] = [];
              const seen = new Set<string>();
              for (const row of current.rows) {
                const id = row.term_id === source.id ? target.id : row.term_id;
                if (seen.has(id)) continue;
                seen.add(id);
                nextIds.push(id);
              }

              // replace：先刪後插，避免 position unique constraint 的 swap/衝突問題
              await client.query(
                `
                DELETE FROM bibliographic_name_terms
                WHERE organization_id = $1
                  AND bibliographic_id = $2
                  AND role = $3
                `,
                [orgId, bibId, role],
              );

              if (nextIds.length > 0) {
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
                    $3,
                    u.term_id,
                    u.ordinality::int
                  FROM unnest($4::uuid[]) WITH ORDINALITY AS u(term_id, ordinality)
                  `,
                  [orgId, bibId, role, nextIds],
                );
              }

              // 同步正規化 bib 端的 text[]（顯示/相容用）：
              // - role=creator → creators[]
              // - role=contributor → contributors[]
              const labels = nextIds.length > 0
                ? await client.query<{ preferred_label: string }>(
                    `
                    SELECT t.preferred_label
                    FROM unnest($3::uuid[]) WITH ORDINALITY AS u(term_id, ordinality)
                    JOIN authority_terms t
                      ON t.organization_id = $1
                     AND t.id = u.term_id
                    ORDER BY u.ordinality ASC
                    `,
                    [orgId, bibId, nextIds],
                  )
                : { rows: [] as Array<{ preferred_label: string }> };

              const column = role === 'creator' ? 'creators' : 'contributors';
              const textArr = labels.rows.map((x) => (x.preferred_label ?? '').trim()).filter(Boolean);

              await client.query(
                `
                UPDATE bibliographic_records
                SET ${column} = $3::text[], updated_at = now()
                WHERE organization_id = $1
                  AND id = $2
                `,
                [orgId, bibId, textArr.length > 0 ? textArr : null],
              );
            }

            bibsUpdated += 1;
          }
        } else {
          const affected = await client.query<{ bibliographic_id: string }>(
            `
            SELECT DISTINCT bibliographic_id
            FROM ${mergeConfig.linkTable}
            WHERE organization_id = $1
              AND term_id = $2
            `,
            [orgId, source.id],
          );

          bibsAffected = affected.rows.length;

          for (const row of affected.rows) {
            const bibId = row.bibliographic_id;

            const current = await client.query<{ term_id: string }>(
              `
              SELECT term_id
              FROM ${mergeConfig.linkTable}
              WHERE organization_id = $1
                AND bibliographic_id = $2
              ORDER BY position ASC
              `,
              [orgId, bibId],
            );

            const nextIds: string[] = [];
            const seen = new Set<string>();
            for (const r of current.rows) {
              const id = r.term_id === source.id ? target.id : r.term_id;
              if (seen.has(id)) continue;
              seen.add(id);
              nextIds.push(id);
            }

            // replace：先刪後插，避免 position unique constraint 的 swap/衝突問題
            await client.query(
              `
              DELETE FROM ${mergeConfig.linkTable}
              WHERE organization_id = $1
                AND bibliographic_id = $2
              `,
              [orgId, bibId],
            );

            if (nextIds.length > 0) {
              await client.query(
                `
                INSERT INTO ${mergeConfig.linkTable} (
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
                `,
                [orgId, bibId, nextIds],
              );

              // 同步正規化 text[]：用 term 的 preferred_label 作為顯示/相容用值
              const labels = await client.query<{ preferred_label: string }>(
                `
                SELECT t.preferred_label
                FROM unnest($3::uuid[]) WITH ORDINALITY AS u(term_id, ordinality)
                JOIN authority_terms t
                  ON t.organization_id = $1
                 AND t.id = u.term_id
                ORDER BY u.ordinality ASC
                `,
                [orgId, bibId, nextIds],
              );

              await client.query(
                `
                UPDATE bibliographic_records
                SET ${mergeConfig.bibColumn} = $3::text[], updated_at = now()
                WHERE organization_id = $1
                  AND id = $2
                `,
                [orgId, bibId, labels.rows.map((x) => (x.preferred_label ?? '').trim()).filter(Boolean)],
              );
            }

            bibsUpdated += 1;
          }
        }

        // 3) variant_labels：把 source 的 preferred + variants 收進 target（便於搜尋舊用詞）
        let variantLabelsAdded = 0;
        if (mergeVariantLabels) {
          const next = new Set<string>();
          for (const v of target.variant_labels ?? []) {
            const vv = (v ?? '').trim();
            if (vv) next.add(vv);
          }

          const beforeSize = next.size;

          const sourcePreferred = (source.preferred_label ?? '').trim();
          if (sourcePreferred && sourcePreferred !== target.preferred_label) next.add(sourcePreferred);
          for (const v of source.variant_labels ?? []) {
            const vv = (v ?? '').trim();
            if (!vv) continue;
            if (vv === target.preferred_label) continue;
            next.add(vv);
          }

          const afterSize = next.size;
          variantLabelsAdded = Math.max(0, afterSize - beforeSize);

          await client.query(
            `
            UPDATE authority_terms
            SET variant_labels = $3::text[], updated_at = now()
            WHERE organization_id = $1
              AND id = $2
            `,
            [orgId, target.id, Array.from(next)],
          );
        }

        // 4) relations：只有 source/target 同 vocabulary_code 才允許搬（對齊 addRelation 規則）
        let relationsMoved = false;
        let relationsSkippedDueToVocabMismatch = false;
        let relationsConsidered = 0;
        let relationsInserted = 0;
        let relationsDeleted = 0;

        if (moveRelations) {
          if (source.vocabulary_code !== target.vocabulary_code) {
            relationsSkippedDueToVocabMismatch = true;
            warnings.push('source/target vocabulary_code 不同：thesaurus relations 不搬移（避免跨詞彙庫亂連）');
          } else {
            const rels = await client.query<AuthorityTermRelationRow>(
              `
              SELECT id, organization_id, from_term_id, relation_type, to_term_id, created_at, updated_at
              FROM authority_term_relations
              WHERE organization_id = $1
                AND (from_term_id = $2 OR to_term_id = $2)
              `,
              [orgId, source.id],
            );

            relationsConsidered = rels.rows.length;

            for (const r of rels.rows) {
              const rawFrom = r.from_term_id === source.id ? target.id : r.from_term_id;
              const rawTo = r.to_term_id === source.id ? target.id : r.to_term_id;
              if (rawFrom === rawTo) continue; // self edge（例如 source↔target related）

              let fromId = rawFrom;
              let toId = rawTo;

              if (r.relation_type === 'related') {
                const pair = canonicalizeRelatedPair(fromId, toId);
                fromId = pair.from;
                toId = pair.to;
              } else {
                // broader cycle check（保守：逐筆檢查；若會形成 cycle 直接拒絕 merge）
                await this.assertNoBroaderCycle(client, orgId, fromId, toId);
              }

              const inserted = await client.query(
                `
                INSERT INTO authority_term_relations (
                  organization_id,
                  from_term_id,
                  relation_type,
                  to_term_id
                )
                VALUES ($1, $2, $3::authority_relation_type, $4)
              ON CONFLICT DO NOTHING
              `,
                [orgId, fromId, r.relation_type, toId],
              );
              if ((inserted.rowCount ?? 0) > 0) relationsInserted += 1;
            }

            const deleted = await client.query(
              `
              DELETE FROM authority_term_relations
              WHERE organization_id = $1
                AND (from_term_id = $2 OR to_term_id = $2)
              `,
              [orgId, source.id],
            );
            relationsDeleted = deleted.rowCount ?? 0;
            relationsMoved = true;
          }
        }

        // 5) deactivate source term（保留 row 追溯，但不再讓 UI 預設列出）
        if (deactivateSource) {
          const mergedNote = `${(source.note ?? '').trim()}\n[merged] -> ${target.id}`.trim();
          await client.query(
            `
            UPDATE authority_terms
            SET status = 'inactive'::user_status,
                note = $3::text,
                updated_at = now()
            WHERE organization_id = $1
              AND id = $2
            `,
            [orgId, source.id, mergedNote.slice(0, 1000)],
          );
        }

        const updatedSource = await this.requireTermById(client, orgId, source.id);
        const updatedTarget = await this.requireTermById(client, orgId, target.id);

        const previewResult: MergeAuthorityTermPreviewResult = {
          mode: 'preview',
          source_term: updatedSource,
          target_term: updatedTarget,
          summary: {
            bibs_affected: bibsAffected,
            bibs_updated: bibsUpdated,
            variant_labels_added: variantLabelsAdded,
            relations: {
              moved: relationsMoved,
              skipped_due_to_vocab_mismatch: relationsSkippedDueToVocabMismatch,
              considered: relationsConsidered,
              inserted: relationsInserted,
              deleted: relationsDeleted,
            },
            warnings,
          },
        };

        if (input.mode === 'preview') {
          await client.query('ROLLBACK');
          return previewResult;
        }

        // apply：寫 audit（每次 merge 寫一筆；方便追溯）
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
            'authority.merge_term',
            'authority_term',
            source.id,
            JSON.stringify({
              note: input.note ?? null,
              source_term_id: source.id,
              target_term_id: target.id,
              options: {
                deactivate_source_term: deactivateSource,
                merge_variant_labels: mergeVariantLabels,
                move_relations: moveRelations,
              },
              summary: previewResult.summary,
            }),
          ],
        );

        await client.query('COMMIT');
        const applyResult: MergeAuthorityTermApplyResult = {
          ...previewResult,
          mode: 'apply',
          audit_event_id: audit.rows[0]!.id,
        };
        return applyResult;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  /**
   * addRelation：新增 BT/NT/RT
   *
   * Request body 用「以目前 term 視角」的 kind（broader/narrower/related）：
   * - broader：新增 BT（from=current → to=target）
   * - narrower：新增 NT（from=target → to=current；仍以 relation_type='broader' 儲存）
   * - related：新增 RT（對稱關係；DB 只存一筆 canonical pair）
   */
  async addRelation(orgId: string, termId: string, input: CreateThesaurusRelationInput): Promise<AuthorityTermDetailResult> {
    return await this.db.transaction(async (client) => {
      const current = await this.requireTermById(client, orgId, termId);
      const target = await this.requireTermById(client, orgId, input.target_term_id);

      if (current.id === target.id) {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'target_term_id must be different from termId' },
        });
      }

      // v1：關係一律要求同 kind + 同 vocabulary_code（避免跨詞彙庫亂連）
      if (current.kind !== target.kind) {
        throw new BadRequestException({
          error: { code: 'TERM_KIND_MISMATCH', message: 'Terms must have the same kind' },
        });
      }

      if (current.vocabulary_code !== target.vocabulary_code) {
        throw new BadRequestException({
          error: { code: 'VOCABULARY_CODE_MISMATCH', message: 'Terms must have the same vocabulary_code' },
        });
      }

      // v1.4：允許 650/651/655 對應的 controlled vocab 做 BT/NT（讓它們都能用 thesaurus/tree 瀏覽）
      // - subject：MARC 650
      // - geographic：MARC 651
      // - genre：MARC 655
      //
      // name 款目仍不建議做 BT/NT（多數實務以 authority record / see also 為主），因此仍限制。
      if (input.kind === 'broader' || input.kind === 'narrower') {
        const allowed = new Set<AuthorityTermKind>(['subject', 'geographic', 'genre']);
        if (!allowed.has(current.kind)) {
          throw new BadRequestException({
            error: {
              code: 'RELATION_NOT_SUPPORTED',
              message: 'broader/narrower relations are only supported for subject/geographic/genre terms (v1.4)',
            },
          });
        }
      }

      // 寫入用的實際關係（DB relation_type 只有 broader/related）
      let relationType: AuthorityTermRelationType;
      let fromTermId: string;
      let toTermId: string;

      if (input.kind === 'related') {
        relationType = 'related';
        const pair = canonicalizeRelatedPair(current.id, target.id);
        fromTermId = pair.from;
        toTermId = pair.to;
      } else {
        relationType = 'broader';
        if (input.kind === 'broader') {
          fromTermId = current.id;
          toTermId = target.id;
        } else {
          // narrower：把 target 當成 narrower term
          fromTermId = target.id;
          toTermId = current.id;
        }

        // cycle check：broader 關係不可形成 cycle
        await this.assertNoBroaderCycle(client, orgId, fromTermId, toTermId);
      }

      try {
        await client.query(
          `
          INSERT INTO authority_term_relations (
            organization_id,
            from_term_id,
            relation_type,
            to_term_id
          )
          VALUES ($1, $2, $3::authority_relation_type, $4)
          `,
          [orgId, fromTermId, relationType, toTermId],
        );
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new ConflictException({
            error: { code: 'CONFLICT', message: 'Relation already exists' },
          });
        }
        throw error;
      }

      return await this.getByIdWithClient(client, orgId, termId);
    });
  }

  /**
   * deleteRelation：刪除 BT/NT/RT
   *
   * 注意：
   * - relation_id 是 authority_term_relations.id
   * - termId 只用來做「防呆」（確保你刪的是此 term 的關係）
   */
  async deleteRelation(orgId: string, termId: string, relationId: string): Promise<AuthorityTermDetailResult> {
    return await this.db.transaction(async (client) => {
      // 確保 term 存在（若不存在，直接 404；避免 UI 操作誤導）
      await this.requireTermById(client, orgId, termId);

      const deleted = await client.query<{ id: string }>(
        `
        DELETE FROM authority_term_relations
        WHERE organization_id = $1
          AND id = $2
          AND (from_term_id = $3 OR to_term_id = $3)
        RETURNING id
        `,
        [orgId, relationId, termId],
      );

      if (deleted.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Relation not found' },
        });
      }

      return await this.getByIdWithClient(client, orgId, termId);
    });
  }

  /**
   * expand：展開（同義/上下位/相關）
   *
   * 目的：
   * - 供「檢索擴充」或「自動補詞」使用
   * - 例如：使用者搜尋「魔法」時，系統可同時用 UF/NT/RT 的詞去找書（提升召回率）
   *
   * v1 限制：
   * - depth 最多 5（避免一次展開太大）
   * - related 只展開 1 階（不做 related graph 擴散，避免爆炸）
   */
  async expand(orgId: string, termId: string, query: ExpandThesaurusQuery): Promise<ThesaurusExpandResult> {
    return await this.db.withClient(async (client) => {
      const term = await this.requireTermById(client, orgId, termId);

      const include = (query.include ?? ['self', 'variants', 'broader', 'narrower', 'related']) as Array<
        'self' | 'variants' | 'broader' | 'narrower' | 'related'
      >;

      const depth = clampDepth(query.depth ?? 1, 0, 5);

      const variantLabels = include.includes('variants') ? (term.variant_labels ?? []) : [];

      const broaderTerms = include.includes('broader') && depth > 0 ? await this.expandBroaderTerms(client, orgId, termId, depth) : [];
      const narrowerTerms = include.includes('narrower') && depth > 0 ? await this.expandNarrowerTerms(client, orgId, termId, depth) : [];
      const relatedTerms = include.includes('related') ? await this.listRelatedTerms(client, orgId, termId) : [];

      const labels = uniqLabels([
        ...(include.includes('self') ? [term.preferred_label] : []),
        ...variantLabels,
        ...broaderTerms.map((t) => t.preferred_label),
        ...narrowerTerms.map((t) => t.preferred_label),
        ...relatedTerms.map((t) => t.preferred_label),
      ]);

      // term_ids：用於「不要再靠字串長相」的檢索擴充
      // - variants 仍屬於同一個 term，因此 term_ids 的 self 判斷要包含 variants
      const termIds = uniqLabels([
        ...(include.includes('self') || include.includes('variants') ? [term.id] : []),
        ...broaderTerms.map((t) => t.id),
        ...narrowerTerms.map((t) => t.id),
        ...relatedTerms.map((t) => t.id),
      ]);

      return {
        term,
        include,
        depth,
        labels,
        term_ids: termIds,
        broader_terms: broaderTerms,
        narrower_terms: narrowerTerms,
        related_terms: relatedTerms,
        variant_labels: variantLabels,
      };
    });
  }

  // ----------------------------
  // Thesaurus v1.1：hierarchy browsing（roots/children/ancestors/graph）
  // ----------------------------

  /**
   * roots（Top terms）
   *
   * polyhierarchy（多個 BT）下，thesaurus 不是單一樹，而是 DAG。
   * - roots 的定義：沒有任何 BT（沒有 broader edges 往上）
   * - UI 會以 roots 作為「可展開的入口」並逐步 lazy-load children
   *
   * 排序與分頁：
   * - 依 preferred_label ASC, id ASC（讓瀏覽直覺、且可 keyset pagination）
   * - cursor 使用 CursorTextV1（sort=preferred_label）
   */
  async listThesaurusRoots(orgId: string, query: ListThesaurusRootsQuery): Promise<ThesaurusRootsResult> {
    // kind：這份 roots 代表「哪一種 controlled vocab」的 hierarchy（650/651/655）
    const kind = query.kind;
    const vocabularyCode = query.vocabulary_code.trim();
    const search = query.query?.trim() ? `%${query.query.trim()}%` : null;

    const status =
      !query.status || query.status === 'active'
        ? 'active'
        : query.status === 'inactive'
          ? 'inactive'
          : null;

    let cursorSort: string | null = null;
    let cursorId: string | null = null;
    if (query.cursor) {
      try {
        const cursor = decodeCursorTextV1(query.cursor);
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

    const result = await this.db.query<
      AuthorityTermSummaryRow & { broader_count: number; narrower_count: number }
    >(
      `
      SELECT
        t.id,
        t.kind,
        t.vocabulary_code,
        t.preferred_label,
        t.status,
        t.source,
        -- BT count：此 term 有幾個 broader（polyhierarchy 時可能 > 1）
        (
          SELECT COUNT(*)::int
          FROM authority_term_relations r
          WHERE r.organization_id = $1
            AND r.relation_type = 'broader'::authority_relation_type
            AND r.from_term_id = t.id
        ) AS broader_count,
        -- NT count：此 term 有幾個直接 narrower（children）
        (
          SELECT COUNT(*)::int
          FROM authority_term_relations r
          WHERE r.organization_id = $1
            AND r.relation_type = 'broader'::authority_relation_type
            AND r.to_term_id = t.id
        ) AS narrower_count
      FROM authority_terms t
      WHERE t.organization_id = $1
        AND t.kind = $2::authority_term_kind
        AND t.vocabulary_code = $3
        AND ($4::user_status IS NULL OR t.status = $4::user_status)
        AND (
          $5::text IS NULL
          OR (t.preferred_label || ' ' || COALESCE(array_to_string(t.variant_labels, ' '), '')) ILIKE $5
        )
        -- roots：沒有 BT（沒有 narrower→broader 邊往上）
        AND NOT EXISTS (
          SELECT 1
          FROM authority_term_relations r
          WHERE r.organization_id = $1
            AND r.relation_type = 'broader'::authority_relation_type
            AND r.from_term_id = t.id
        )
        AND (
          $6::text IS NULL
          OR (t.preferred_label, t.id) > ($6::text, $7::uuid)
        )
      ORDER BY t.preferred_label ASC, t.id ASC
      LIMIT $8
      `,
      [orgId, kind, vocabularyCode, status, search, cursorSort, cursorId, queryLimit],
    );

    const rows = result.rows.map((r) => ({
      ...r,
      has_children: r.narrower_count > 0,
    })) as ThesaurusNodeSummary[];

    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;

    const last = items.at(-1) ?? null;
    const next_cursor = hasMore && last ? encodeCursorTextV1({ sort: last.preferred_label, id: last.id }) : null;

    return { items, next_cursor };
  }

  /**
   * children（直接 NT）
   *
   * 給 UI tree 展開使用：
   * - 只回「直接 children」，避免一次拉太深（幾萬 terms 時會爆）
   * - 每個 child 附上：
   *   - broader_count：用於顯示「多重上位」警示/徽章
   *   - narrower_count/has_children：決定是否可繼續展開
   */
  async listThesaurusChildren(orgId: string, termId: string, query: ListThesaurusChildrenQuery): Promise<ThesaurusChildrenResult> {
    return await this.db.withClient(async (client) => {
      await this.requireTermById(client, orgId, termId);

      const status =
        !query.status || query.status === 'active'
          ? 'active'
          : query.status === 'inactive'
            ? 'inactive'
            : null;

      let cursorSort: string | null = null;
      let cursorId: string | null = null;
      if (query.cursor) {
        try {
          const cursor = decodeCursorTextV1(query.cursor);
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

      const result = await client.query<
        { relation_id: string } & AuthorityTermSummaryRow & { broader_count: number; narrower_count: number }
      >(
        `
        SELECT
          r.id AS relation_id,
          t.id,
          t.kind,
          t.vocabulary_code,
          t.preferred_label,
          t.status,
          t.source,
          (
            SELECT COUNT(*)::int
            FROM authority_term_relations x
            WHERE x.organization_id = $1
              AND x.relation_type = 'broader'::authority_relation_type
              AND x.from_term_id = t.id
          ) AS broader_count,
          (
            SELECT COUNT(*)::int
            FROM authority_term_relations x
            WHERE x.organization_id = $1
              AND x.relation_type = 'broader'::authority_relation_type
              AND x.to_term_id = t.id
          ) AS narrower_count
        FROM authority_term_relations r
        JOIN authority_terms t
          ON t.organization_id = r.organization_id
         AND t.id = r.from_term_id
        WHERE r.organization_id = $1
          AND r.relation_type = 'broader'::authority_relation_type
          AND r.to_term_id = $2
          AND ($3::user_status IS NULL OR t.status = $3::user_status)
          AND (
            $4::text IS NULL
            OR (t.preferred_label, t.id) > ($4::text, $5::uuid)
          )
        ORDER BY t.preferred_label ASC, t.id ASC
        LIMIT $6
        `,
        [orgId, termId, status, cursorSort, cursorId, queryLimit],
      );

      const mapped = result.rows.map((r) => {
        const { relation_id, broader_count, narrower_count, ...term } = r;
        const termWithMeta: ThesaurusNodeSummary = {
          ...term,
          broader_count,
          narrower_count,
          has_children: narrower_count > 0,
        };
        return { relation_id, term: termWithMeta };
      });

      const items = mapped.slice(0, pageSize);
      const hasMore = mapped.length > pageSize;
      const last = items.at(-1) ?? null;
      const next_cursor =
        hasMore && last ? encodeCursorTextV1({ sort: last.term.preferred_label, id: last.term.id }) : null;

      return { items, next_cursor };
    });
  }

  /**
   * ancestors（breadcrumb）
   *
   * polyhierarchy 下，一個 term 可能同時掛在多個上位詞之下 → 會有多條 breadcrumb path。
   *
   * v1.1 的策略（務實、可擴充）：
   * - 先用 recursive CTE 取得「往上 depth 層內」的祖先節點集合（避免一開始就枚舉所有 paths）
   * - 再在 Node 端用 BFS 枚舉最多 max_paths 條 path（優先短路徑）
   * - 每條 path 標記 is_complete：最上層節點是否「真的沒有 broader」（避免 depth 截斷造成誤判）
   */
  async getThesaurusAncestors(orgId: string, termId: string, query: ThesaurusAncestorsQuery): Promise<ThesaurusAncestorsResult> {
    return await this.db.withClient(async (client) => {
      const term = await this.requireTermById(client, orgId, termId);
      const termSummary: AuthorityTermSummaryRow = {
        id: term.id,
        kind: term.kind,
        vocabulary_code: term.vocabulary_code,
        preferred_label: term.preferred_label,
        status: term.status,
        source: term.source,
      };

      const depth = clampDepth(query.depth ?? 10, 0, 20);
      const maxPaths = clampDepth(query.max_paths ?? 5, 1, 20);

      if (depth === 0) {
        return { term: termSummary, depth, max_paths: maxPaths, truncated: false, paths: [{ is_complete: true, nodes: [termSummary] }] };
      }

      // 1) 取得祖先節點集合（含 self）
      const idsResult = await client.query<{ term_id: string }>(
        `
        WITH RECURSIVE up AS (
          SELECT $2::uuid AS term_id, 0 AS depth
          UNION
          SELECT r.to_term_id AS term_id, up.depth + 1 AS depth
          FROM authority_term_relations r
          JOIN up
            ON up.term_id = r.from_term_id
          WHERE r.organization_id = $1
            AND r.relation_type = 'broader'::authority_relation_type
            AND up.depth < $3
        )
        SELECT DISTINCT term_id
        FROM up
        `,
        [orgId, termId, depth],
      );
      const nodeIds = idsResult.rows.map((r) => r.term_id);

      // 2) 把節點變成 summary map（便於排序/輸出）
      const nodesResult = await client.query<AuthorityTermSummaryRow>(
        `
        SELECT
          id,
          kind,
          vocabulary_code,
          preferred_label,
          status,
          source
        FROM authority_terms
        WHERE organization_id = $1
          AND id = ANY($2::uuid[])
        `,
        [orgId, nodeIds],
      );

      const nodeMap = new Map<string, AuthorityTermSummaryRow>();
      for (const n of nodesResult.rows) nodeMap.set(n.id, n);

      // 3) 取得「往上」的 broader edges（child -> parent）
      const edgesResult = await client.query<{ from_term_id: string; to_term_id: string }>(
        `
        SELECT from_term_id, to_term_id
        FROM authority_term_relations
        WHERE organization_id = $1
          AND relation_type = 'broader'::authority_relation_type
          AND from_term_id = ANY($2::uuid[])
        `,
        [orgId, nodeIds],
      );

      // parentsMap：childId -> parentIds[]
      const parentsMap = new Map<string, string[]>();
      for (const edge of edgesResult.rows) {
        if (!nodeMap.has(edge.to_term_id)) continue; // depth 截斷時，可能出現 parent 不在集合內
        const list = parentsMap.get(edge.from_term_id) ?? [];
        list.push(edge.to_term_id);
        parentsMap.set(edge.from_term_id, list);
      }

      // 4) 排序 parents（確保輸出可重現）
      for (const [childId, parentIds] of parentsMap.entries()) {
        parentIds.sort((a, b) => {
          const la = nodeMap.get(a)?.preferred_label ?? '';
          const lb = nodeMap.get(b)?.preferred_label ?? '';
          if (la < lb) return -1;
          if (la > lb) return 1;
          return a < b ? -1 : a > b ? 1 : 0;
        });
        parentsMap.set(childId, parentIds);
      }

      // 5) BFS 列舉 paths（最多 maxPaths；優先短路徑）
      const pathsIds: string[][] = [];
      let truncated = false;

      const queue: string[][] = [[termId]];
      let qIndex = 0;
      const maxStates = 50_000; // 防止極端 polyhierarchy 把記憶體撐爆

      while (qIndex < queue.length) {
        if (pathsIds.length >= maxPaths) break;
        if (queue.length > maxStates) {
          truncated = true;
          break;
        }

        const path = queue[qIndex]!;
        qIndex += 1;

        const currentId = path[path.length - 1]!;
        const currentDepth = path.length - 1;
        const parents = parentsMap.get(currentId) ?? [];

        if (parents.length === 0) {
          // 到達「集合內的上界」：暫時視為一條 path 的終點（是否真的 root 後續再判斷）
          pathsIds.push(path);
          continue;
        }

        if (currentDepth >= depth) {
          truncated = true;
          // depth 截斷：不再往上展開，但也把這條 partial path 收下（至少 UI 有 breadcrumb 可用）
          pathsIds.push(path);
          continue;
        }

        for (const p of parents) {
          if (path.includes(p)) continue; // 保底避免 loop（理論上 cycle 已禁止）
          queue.push([...path, p]);
        }
      }

      // 6) 判斷每條 path 是否 complete：最上層節點是否真的沒有 broader
      const topIds = uniq(pathTopIds(pathsIds));
      const hasBroaderResult = await client.query<{ from_term_id: string }>(
        `
        SELECT DISTINCT from_term_id
        FROM authority_term_relations
        WHERE organization_id = $1
          AND relation_type = 'broader'::authority_relation_type
          AND from_term_id = ANY($2::uuid[])
        `,
        [orgId, topIds],
      );
      const hasBroaderSet = new Set<string>(hasBroaderResult.rows.map((r) => r.from_term_id));

      const mappedPaths = pathsIds.map((ids) => {
        const reversed = [...ids].reverse(); // root-ish -> term
        const nodes = reversed.map((id) => nodeMap.get(id)).filter(Boolean) as AuthorityTermSummaryRow[];
        const topId = reversed[0]?.trim() ?? '';
        const isComplete = topId ? !hasBroaderSet.has(topId) : false;
        return { is_complete: isComplete, nodes };
      });

      return { term: termSummary, depth, max_paths: maxPaths, truncated, paths: mappedPaths };
    });
  }

  /**
   * graph（depth-limited）
   *
   * 用途：
   * - UI/QA 除錯：快速看「某節點往上/往下 N 層」的節點與邊
   * - 後續若要做關係圖可視化（force graph/indented tree），可以直接吃 nodes+edges
   *
   * 注意：
   * - 這不是拿來一次匯出整個詞彙庫（幾萬 terms 會太大）
   * - 請用 depth/max_nodes/max_edges 控制輸出量
   */
  async getThesaurusGraph(orgId: string, termId: string, query: ThesaurusGraphQuery): Promise<ThesaurusGraphResult> {
    return await this.db.withClient(async (client) => {
      const term = await this.requireTermById(client, orgId, termId);
      const termSummary: AuthorityTermSummaryRow = {
        id: term.id,
        kind: term.kind,
        vocabulary_code: term.vocabulary_code,
        preferred_label: term.preferred_label,
        status: term.status,
        source: term.source,
      };

      const direction = (query.direction ?? 'narrower') as 'narrower' | 'broader';
      const depth = clampDepth(query.depth ?? 2, 0, 5);
      const maxNodes = clampDepth(query.max_nodes ?? 2000, 1, 10_000);
      const maxEdges = clampDepth(query.max_edges ?? 5000, 1, 50_000);

      // nodes：先用 recursive CTE 取得 depth 範圍內的節點集合
      const nodesResult = await client.query<{ id: string }>(
        direction === 'narrower'
          ? `
            WITH RECURSIVE walk AS (
              SELECT $2::uuid AS term_id, 0 AS depth
              UNION
              SELECT r.from_term_id AS term_id, walk.depth + 1 AS depth
              FROM authority_term_relations r
              JOIN walk
                ON walk.term_id = r.to_term_id
              WHERE r.organization_id = $1
                AND r.relation_type = 'broader'::authority_relation_type
                AND walk.depth < $3
            )
            SELECT DISTINCT term_id AS id
            FROM walk
            LIMIT $4
            `
          : `
            WITH RECURSIVE walk AS (
              SELECT $2::uuid AS term_id, 0 AS depth
              UNION
              SELECT r.to_term_id AS term_id, walk.depth + 1 AS depth
              FROM authority_term_relations r
              JOIN walk
                ON walk.term_id = r.from_term_id
              WHERE r.organization_id = $1
                AND r.relation_type = 'broader'::authority_relation_type
                AND walk.depth < $3
            )
            SELECT DISTINCT term_id AS id
            FROM walk
            LIMIT $4
            `,
        [orgId, termId, depth, maxNodes + 1],
      );

      const nodeIds = nodesResult.rows.map((r) => r.id);
      const truncated = nodeIds.length > maxNodes;
      const limitedNodeIds = truncated ? nodeIds.slice(0, maxNodes) : nodeIds;

      const summariesResult = await client.query<AuthorityTermSummaryRow>(
        `
        SELECT
          id,
          kind,
          vocabulary_code,
          preferred_label,
          status,
          source
        FROM authority_terms
        WHERE organization_id = $1
          AND id = ANY($2::uuid[])
        `,
        [orgId, limitedNodeIds],
      );
      const nodes = summariesResult.rows;

      const edgesResult = await client.query<{ relation_id: string; from_term_id: string; to_term_id: string }>(
        `
        SELECT
          id AS relation_id,
          from_term_id,
          to_term_id
        FROM authority_term_relations
        WHERE organization_id = $1
          AND relation_type = 'broader'::authority_relation_type
          AND from_term_id = ANY($2::uuid[])
          AND to_term_id = ANY($2::uuid[])
        LIMIT $3
        `,
        [orgId, limitedNodeIds, maxEdges + 1],
      );

      const edgesTruncated = edgesResult.rows.length > maxEdges;
      const edges = (edgesTruncated ? edgesResult.rows.slice(0, maxEdges) : edgesResult.rows).map((e) => ({
        relation_id: e.relation_id,
        from_term_id: e.from_term_id,
        to_term_id: e.to_term_id,
        relation_type: 'broader' as const,
      }));

      return {
        term: termSummary,
        direction,
        depth,
        max_nodes: maxNodes,
        max_edges: maxEdges,
        truncated: truncated || edgesTruncated,
        nodes,
        edges,
      };
    });
  }

  // ----------------------------
  // Thesaurus governance：quality reports + relations CSV import/export
  // ----------------------------

  async thesaurusQuality(orgId: string, query: ThesaurusQualityQuery): Promise<ThesaurusQualityResult> {
    const kind = query.kind;
    const vocabularyCode = query.vocabulary_code.trim();
    const status =
      !query.status || query.status === 'active'
        ? 'active'
        : query.status === 'inactive'
          ? 'inactive'
          : null;

    let cursorSort: string | null = null;
    let cursorId: string | null = null;
    if (query.cursor) {
      try {
        const cursor = decodeCursorTextV1(query.cursor);
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

    if (query.type === 'orphans') {
      const result = await this.db.query<AuthorityTermSummaryRow & { broader_count: number; narrower_count: number }>(
        `
        SELECT
          t.id,
          t.kind,
          t.vocabulary_code,
          t.preferred_label,
          t.status,
          t.source,
          (
            SELECT COUNT(*)::int
            FROM authority_term_relations r
            WHERE r.organization_id = $1
              AND r.relation_type = 'broader'::authority_relation_type
              AND r.from_term_id = t.id
          ) AS broader_count,
          (
            SELECT COUNT(*)::int
            FROM authority_term_relations r
            WHERE r.organization_id = $1
              AND r.relation_type = 'broader'::authority_relation_type
              AND r.to_term_id = t.id
          ) AS narrower_count
        FROM authority_terms t
        WHERE t.organization_id = $1
          AND t.kind = $2::authority_term_kind
          AND t.vocabulary_code = $3
          AND ($4::user_status IS NULL OR t.status = $4::user_status)
          -- orphans：既沒有 BT/NT，也沒有 RT（完全孤立）
          AND NOT EXISTS (
            SELECT 1
            FROM authority_term_relations r
            WHERE r.organization_id = $1
              AND r.relation_type = 'broader'::authority_relation_type
              AND r.from_term_id = t.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM authority_term_relations r
            WHERE r.organization_id = $1
              AND r.relation_type = 'broader'::authority_relation_type
              AND r.to_term_id = t.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM authority_term_relations r
            WHERE r.organization_id = $1
              AND r.relation_type = 'related'::authority_relation_type
              AND (r.from_term_id = t.id OR r.to_term_id = t.id)
          )
          AND (
            $5::text IS NULL
            OR (t.preferred_label, t.id) > ($5::text, $6::uuid)
          )
        ORDER BY t.preferred_label ASC, t.id ASC
        LIMIT $7
        `,
        [orgId, kind, vocabularyCode, status, cursorSort, cursorId, queryLimit],
      );

      const rows = result.rows.map((r) => ({
        ...r,
        has_children: r.narrower_count > 0,
        issue_type: 'orphans' as const,
      })) as Array<ThesaurusNodeSummary & { issue_type: 'orphans' }>;

      const items = rows.slice(0, pageSize);
      const hasMore = rows.length > pageSize;
      const last = items.at(-1) ?? null;
      const next_cursor = hasMore && last ? encodeCursorTextV1({ sort: last.preferred_label, id: last.id }) : null;

      return { items, next_cursor };
    }

    if (query.type === 'multi_broader') {
      const result = await this.db.query<AuthorityTermSummaryRow & { broader_count: number; narrower_count: number }>(
        `
        WITH broader_counts AS (
          SELECT from_term_id, COUNT(*)::int AS broader_count
          FROM authority_term_relations
          WHERE organization_id = $1
            AND relation_type = 'broader'::authority_relation_type
          GROUP BY from_term_id
          HAVING COUNT(*) > 1
        )
        SELECT
          t.id,
          t.kind,
          t.vocabulary_code,
          t.preferred_label,
          t.status,
          t.source,
          bc.broader_count,
          (
            SELECT COUNT(*)::int
            FROM authority_term_relations r
            WHERE r.organization_id = $1
              AND r.relation_type = 'broader'::authority_relation_type
              AND r.to_term_id = t.id
          ) AS narrower_count
        FROM authority_terms t
        JOIN broader_counts bc
          ON bc.from_term_id = t.id
        WHERE t.organization_id = $1
          AND t.kind = $2::authority_term_kind
          AND t.vocabulary_code = $3
          AND ($4::user_status IS NULL OR t.status = $4::user_status)
          AND (
            $5::text IS NULL
            OR (t.preferred_label, t.id) > ($5::text, $6::uuid)
          )
        ORDER BY t.preferred_label ASC, t.id ASC
        LIMIT $7
        `,
        [orgId, kind, vocabularyCode, status, cursorSort, cursorId, queryLimit],
      );

      const rows = result.rows.map((r) => ({
        ...r,
        has_children: r.narrower_count > 0,
        issue_type: 'multi_broader' as const,
      })) as Array<ThesaurusNodeSummary & { issue_type: 'multi_broader' }>;

      const items = rows.slice(0, pageSize);
      const hasMore = rows.length > pageSize;
      const last = items.at(-1) ?? null;
      const next_cursor = hasMore && last ? encodeCursorTextV1({ sort: last.preferred_label, id: last.id }) : null;

      return { items, next_cursor };
    }

    // unused_with_relations
    // unused_with_relations：找出「沒被任何 bib 用到」但「仍有 BT/NT/RT」的 term（多半是治理後遺留）
    // - 這一份報表必須依 kind 對應到不同的 junction table / legacy array 欄位。
    const usedJunctionTable =
      kind === 'subject'
        ? 'bibliographic_subject_terms'
        : kind === 'geographic'
          ? 'bibliographic_geographic_terms'
          : 'bibliographic_genre_terms';
    const legacyArrayColumn = kind === 'subject' ? 'subjects' : kind === 'geographic' ? 'geographics' : 'genres';

    const result = await this.db.query<AuthorityTermSummaryRow & { broader_count: number; narrower_count: number }>(
      `
      WITH used_term_ids AS (
        -- authority linking：優先用 junction table（term_id-driven）
        SELECT DISTINCT term_id
        FROM ${usedJunctionTable}
        WHERE organization_id = $1

        UNION

        -- 相容（transition）：若有舊資料尚未 backfill links，仍用 text[] 以 preferred_label 對應（僅用於過渡）
        SELECT DISTINCT t.id
        FROM bibliographic_records b
        JOIN LATERAL unnest(b.${legacyArrayColumn}) AS s(label)
          ON TRUE
        JOIN authority_terms t
          ON t.organization_id = b.organization_id
         AND t.kind = $2::authority_term_kind
         AND t.preferred_label = s.label
        WHERE b.organization_id = $1
          AND b.${legacyArrayColumn} IS NOT NULL
      )
      SELECT
        t.id,
        t.kind,
        t.vocabulary_code,
        t.preferred_label,
        t.status,
        t.source,
        (
          SELECT COUNT(*)::int
          FROM authority_term_relations r
          WHERE r.organization_id = $1
            AND r.relation_type = 'broader'::authority_relation_type
            AND r.from_term_id = t.id
        ) AS broader_count,
        (
          SELECT COUNT(*)::int
          FROM authority_term_relations r
          WHERE r.organization_id = $1
            AND r.relation_type = 'broader'::authority_relation_type
            AND r.to_term_id = t.id
        ) AS narrower_count
      FROM authority_terms t
      LEFT JOIN used_term_ids u
        ON u.term_id = t.id
      WHERE t.organization_id = $1
        AND t.kind = $2::authority_term_kind
        AND t.vocabulary_code = $3
        AND ($4::user_status IS NULL OR t.status = $4::user_status)
        AND u.term_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM authority_term_relations r
          WHERE r.organization_id = $1
            AND (r.from_term_id = t.id OR r.to_term_id = t.id)
        )
        AND (
          $5::text IS NULL
          OR (t.preferred_label, t.id) > ($5::text, $6::uuid)
        )
      ORDER BY t.preferred_label ASC, t.id ASC
      LIMIT $7
      `,
      [orgId, kind, vocabularyCode, status, cursorSort, cursorId, queryLimit],
    );

    const rows = result.rows.map((r) => ({
      ...r,
      has_children: r.narrower_count > 0,
      issue_type: 'unused_with_relations' as const,
    })) as Array<ThesaurusNodeSummary & { issue_type: 'unused_with_relations' }>;

    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;
    const last = items.at(-1) ?? null;
    const next_cursor = hasMore && last ? encodeCursorTextV1({ sort: last.preferred_label, id: last.id }) : null;

    return { items, next_cursor };
  }

  async exportThesaurusRelations(orgId: string, query: ExportThesaurusRelationsQuery): Promise<string> {
    const kind = query.kind;
    const vocabularyCode = query.vocabulary_code.trim();

    const result = await this.db.query<{
      relation_id: string;
      relation_type: AuthorityTermRelationType;
      from_term_id: string;
      from_preferred_label: string;
      to_term_id: string;
      to_preferred_label: string;
    }>(
      `
      SELECT
        r.id AS relation_id,
        r.relation_type,
        r.from_term_id,
        f.preferred_label AS from_preferred_label,
        r.to_term_id,
        t.preferred_label AS to_preferred_label
      FROM authority_term_relations r
      JOIN authority_terms f
        ON f.organization_id = r.organization_id
       AND f.id = r.from_term_id
      JOIN authority_terms t
        ON t.organization_id = r.organization_id
       AND t.id = r.to_term_id
      WHERE r.organization_id = $1
        AND f.kind = $2::authority_term_kind
        AND f.vocabulary_code = $3
        AND t.kind = $2::authority_term_kind
        AND t.vocabulary_code = $3
      ORDER BY r.relation_type ASC, f.preferred_label ASC, t.preferred_label ASC, r.id ASC
      `,
      [orgId, kind, vocabularyCode],
    );

    const header = ['relation_id', 'relation_type', 'from_term_id', 'from_preferred_label', 'to_term_id', 'to_preferred_label'];
    const lines = [header.join(',')];
    for (const row of result.rows) {
      lines.push(
        [
          toCsvCell(row.relation_id),
          toCsvCell(row.relation_type),
          toCsvCell(row.from_term_id),
          toCsvCell(row.from_preferred_label),
          toCsvCell(row.to_term_id),
          toCsvCell(row.to_preferred_label),
        ].join(','),
      );
    }

    // Excel 友善：UTF-8 BOM
    return `\ufeff${lines.join('\n')}\n`;
  }

  async importThesaurusRelations(orgId: string, input: ImportThesaurusRelationsInput): Promise<ImportThesaurusRelationsResult> {
    const parsed = parseCsv(input.csv_text);
    const records = parsed.records;
    if (records.length === 0) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'CSV is empty' },
      });
    }

    const header = records[0]!.map((h) => h.trim().toLowerCase());
    const idx = indexCsvHeader(header);

    const required = ['from_term_id', 'to_term_id', 'relation_type'];
    for (const key of required) {
      if (!(key in idx)) {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: `CSV missing required header: ${key}` },
        });
      }
    }

    // noUncheckedIndexedAccess=true 時，TS 會把 `idx['x']` 視為 `number | undefined`。
    // - 我們在上面已驗證 header 存在，因此這裡再做一次 runtime assert，並把型別收斂成 number。
    const fromIdx = idx['from_term_id'];
    const toIdx = idx['to_term_id'];
    const typeIdx = idx['relation_type'];
    if (fromIdx === undefined || toIdx === undefined || typeIdx === undefined) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'CSV header index missing (unexpected)' },
      });
    }

    const rows = records.slice(1);

    // 1) 先做「純語法」驗證 + 收集 termIds（以便一次查 existence）
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const staged: Array<{
      row_number: number;
      relation_type: AuthorityTermRelationType | null;
      from_term_id: string | null;
      to_term_id: string | null;
      status: 'create' | 'skip_existing' | 'error';
      error?: { code: string; message: string };
    }> = [];

    const termIds = new Set<string>();

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2; // 1-based + header
      const r = rows[i]!;

      const from = (r[fromIdx] ?? '').trim();
      const to = (r[toIdx] ?? '').trim();
      const typeRaw = (r[typeIdx] ?? '').trim();

      const relationType = typeRaw === 'broader' || typeRaw === 'related' ? (typeRaw as AuthorityTermRelationType) : null;

      if (!from || !to || !relationType) {
        staged.push({
          row_number: rowNumber,
          relation_type: relationType,
          from_term_id: from || null,
          to_term_id: to || null,
          status: 'error',
          error: { code: 'VALIDATION_ERROR', message: 'Missing from_term_id/to_term_id/relation_type' },
        });
        continue;
      }

      if (!uuidRe.test(from) || !uuidRe.test(to)) {
        staged.push({
          row_number: rowNumber,
          relation_type: relationType,
          from_term_id: from,
          to_term_id: to,
          status: 'error',
          error: { code: 'VALIDATION_ERROR', message: 'from_term_id and to_term_id must be UUID' },
        });
        continue;
      }

      if (from === to) {
        staged.push({
          row_number: rowNumber,
          relation_type: relationType,
          from_term_id: from,
          to_term_id: to,
          status: 'error',
          error: { code: 'VALIDATION_ERROR', message: 'from_term_id must be different from to_term_id' },
        });
        continue;
      }

      termIds.add(from);
      termIds.add(to);

      staged.push({
        row_number: rowNumber,
        relation_type: relationType,
        from_term_id: from,
        to_term_id: to,
        status: 'create',
      });
    }

    // 2) existence + scope（kind/vocabulary_code）驗證
    const ids = [...termIds];
    if (ids.length > 0) {
      const terms = await this.db.query<{ id: string; kind: string; vocabulary_code: string }>(
        `
        SELECT id, kind::text AS kind, vocabulary_code
        FROM authority_terms
        WHERE organization_id = $1
          AND id = ANY($2::uuid[])
        `,
        [orgId, ids],
      );

      const found = new Map<string, { kind: string; vocabulary_code: string }>();
      for (const t of terms.rows) found.set(t.id, { kind: t.kind, vocabulary_code: t.vocabulary_code });

      for (const row of staged) {
        if (row.status !== 'create') continue;
        const fromId = row.from_term_id!;
        const toId = row.to_term_id!;

        const fromTerm = found.get(fromId) ?? null;
        const toTerm = found.get(toId) ?? null;

        if (!fromTerm || !toTerm) {
          row.status = 'error';
          row.error = { code: 'NOT_FOUND', message: 'Term not found (from/to)' };
          continue;
        }

        // 匯入 scope：只允許同 kind + 同 vocabulary_code（對齊 service 的規則）
        if (fromTerm.kind !== input.kind || toTerm.kind !== input.kind) {
          row.status = 'error';
          row.error = { code: 'TERM_KIND_MISMATCH', message: 'Terms must match import kind' };
          continue;
        }
        if (fromTerm.vocabulary_code !== input.vocabulary_code || toTerm.vocabulary_code !== input.vocabulary_code) {
          row.status = 'error';
          row.error = { code: 'VOCABULARY_CODE_MISMATCH', message: 'Terms must match import vocabulary_code' };
          continue;
        }

        // related：canonicalize pair（確保 A↔B 只存一筆）
        if (row.relation_type === 'related') {
          const pair = canonicalizeRelatedPair(fromId, toId);
          row.from_term_id = pair.from;
          row.to_term_id = pair.to;
        }
      }
    }

    // 3) preview/apply：用「真實 insert + rollback/commit」驗證 unique/cycle
    return await this.db.withClient(async (client) => {
      await client.query('BEGIN');

      let createCount = 0;
      let skipExistingCount = 0;
      let errorCount = 0;

      try {
        for (const row of staged) {
          if (row.status !== 'create') continue;
          const fromId = row.from_term_id!;
          const toId = row.to_term_id!;
          const relationType = row.relation_type!;

          if (relationType === 'broader') {
            // broader cycle check（含本批次已插入的 edges，因為在同一 transaction 內）
            await this.assertNoBroaderCycle(client, orgId, fromId, toId);
          }

          try {
            await client.query(
              `
              INSERT INTO authority_term_relations (
                organization_id,
                from_term_id,
                relation_type,
                to_term_id
              )
              VALUES ($1, $2, $3::authority_relation_type, $4)
              `,
              [orgId, fromId, relationType, toId],
            );
            createCount += 1;
          } catch (error: any) {
            if (error?.code === '23505') {
              // unique_violation：視為 skip（可重複匯入）
              row.status = 'skip_existing';
              skipExistingCount += 1;
              continue;
            }
            row.status = 'error';
            row.error = { code: 'DB_ERROR', message: error?.message ?? 'DB error' };
            errorCount += 1;
          }
        }

        // cycle check 會用 exception 中止；我們把它轉成 row-level error（讓 preview/report 可讀）
      } catch (error: any) {
        // 把 transaction-level error 轉成「第一筆仍為 create 的 row」錯誤（務實：避免整份只看到 500）
        const firstPending = staged.find((r) => r.status === 'create') ?? null;
        if (firstPending) {
          firstPending.status = 'error';
          firstPending.error = {
            code: error?.response?.error?.code ?? error?.error?.code ?? 'ERROR',
            message: error?.response?.error?.message ?? error?.message ?? 'Error',
          };
          errorCount += 1;
        } else {
          errorCount += 1;
        }
      }

      const totalRows = staged.length;
      const summary = {
        total_rows: totalRows,
        create_count: createCount,
        skip_existing_count: skipExistingCount,
        error_count: staged.filter((r) => r.status === 'error').length,
      };

      if (input.mode === 'preview') {
        await client.query('ROLLBACK');
        return { mode: 'preview', summary, rows: staged } satisfies ImportThesaurusRelationsPreviewResult;
      }

      // apply：若有任何 error → rollback（避免半套匯入造成 graph 斷裂）
      if (summary.error_count > 0) {
        await client.query('ROLLBACK');
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Import has errors; fix and retry (use mode=preview)' },
        });
      }

      await client.query('COMMIT');
      return { mode: 'apply', summary } satisfies ImportThesaurusRelationsApplyResult;
    });
  }

  // ----------------------------
  // helpers（thesaurus）
  // ----------------------------

  private async getByIdWithClient(client: PoolClient, orgId: string, termId: string): Promise<AuthorityTermDetailResult> {
    const term = await this.requireTermById(client, orgId, termId);

    const broader = await client.query<AuthorityTermSummaryRow & { relation_id: string }>(
      `
      SELECT
        r.id AS relation_id,
        t.id,
        t.kind,
        t.vocabulary_code,
        t.preferred_label,
        t.status,
        t.source
      FROM authority_term_relations r
      JOIN authority_terms t
        ON t.id = r.to_term_id
      WHERE r.organization_id = $1
        AND r.relation_type = 'broader'::authority_relation_type
        AND r.from_term_id = $2
      ORDER BY t.preferred_label ASC, t.id ASC
      `,
      [orgId, termId],
    );

    const narrower = await client.query<AuthorityTermSummaryRow & { relation_id: string }>(
      `
      SELECT
        r.id AS relation_id,
        t.id,
        t.kind,
        t.vocabulary_code,
        t.preferred_label,
        t.status,
        t.source
      FROM authority_term_relations r
      JOIN authority_terms t
        ON t.id = r.from_term_id
      WHERE r.organization_id = $1
        AND r.relation_type = 'broader'::authority_relation_type
        AND r.to_term_id = $2
      ORDER BY t.preferred_label ASC, t.id ASC
      `,
      [orgId, termId],
    );

    const related = await client.query<AuthorityTermSummaryRow & { relation_id: string }>(
      `
      SELECT
        r.id AS relation_id,
        t.id,
        t.kind,
        t.vocabulary_code,
        t.preferred_label,
        t.status,
        t.source
      FROM authority_term_relations r
      JOIN authority_terms t
        ON t.id = CASE
          WHEN r.from_term_id = $2 THEN r.to_term_id
          ELSE r.from_term_id
        END
      WHERE r.organization_id = $1
        AND r.relation_type = 'related'::authority_relation_type
        AND (r.from_term_id = $2 OR r.to_term_id = $2)
      ORDER BY t.preferred_label ASC, t.id ASC
      `,
      [orgId, termId],
    );

    return {
      term,
      relations: {
        broader: broader.rows.map((row) => ({ relation_id: row.relation_id, term: stripRelationId(row) })),
        narrower: narrower.rows.map((row) => ({ relation_id: row.relation_id, term: stripRelationId(row) })),
        related: related.rows.map((row) => ({ relation_id: row.relation_id, term: stripRelationId(row) })),
      },
    };
  }

  private async requireTermById(client: PoolClient, orgId: string, termId: string): Promise<AuthorityTermRow> {
    const result = await client.query<AuthorityTermRow>(
      `
      SELECT
        id,
        organization_id,
        kind,
        vocabulary_code,
        preferred_label,
        variant_labels,
        note,
        source,
        status,
        created_at,
        updated_at
      FROM authority_terms
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, termId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Authority term not found' },
      });
    }

    return result.rows[0]!;
  }

  private async assertNoBroaderCycle(client: PoolClient, orgId: string, fromTermId: string, toTermId: string) {
    // 加入一條 edge：fromTerm -> toTerm（from 是 narrower；to 是 broader）
    //
    // cycle 判斷：
    // - 若 toTerm 的 broader chain 已經可到達 fromTerm，就會形成 cycle（A -> ... -> B，再加 B -> A）
    const result = await client.query<{ ok: number }>(
      `
      WITH RECURSIVE ancestors AS (
        SELECT r.to_term_id AS term_id
        FROM authority_term_relations r
        WHERE r.organization_id = $1
          AND r.relation_type = 'broader'::authority_relation_type
          AND r.from_term_id = $2
        UNION
        SELECT r.to_term_id AS term_id
        FROM authority_term_relations r
        JOIN ancestors a
          ON a.term_id = r.from_term_id
        WHERE r.organization_id = $1
          AND r.relation_type = 'broader'::authority_relation_type
      )
      SELECT 1 AS ok
      FROM ancestors
      WHERE term_id = $3
      LIMIT 1
      `,
      [orgId, toTermId, fromTermId],
    );

    if ((result.rowCount ?? 0) > 0) {
      throw new BadRequestException({
        error: { code: 'THESAURUS_CYCLE', message: 'broader relation would create a cycle' },
      });
    }
  }

  private async listRelatedTerms(client: PoolClient, orgId: string, termId: string): Promise<AuthorityTermSummaryRow[]> {
    const result = await client.query<AuthorityTermSummaryRow>(
      `
      SELECT
        t.id,
        t.kind,
        t.vocabulary_code,
        t.preferred_label,
        t.status,
        t.source
      FROM authority_term_relations r
      JOIN authority_terms t
        ON t.id = CASE
          WHEN r.from_term_id = $2 THEN r.to_term_id
          ELSE r.from_term_id
        END
      WHERE r.organization_id = $1
        AND r.relation_type = 'related'::authority_relation_type
        AND (r.from_term_id = $2 OR r.to_term_id = $2)
      ORDER BY t.preferred_label ASC, t.id ASC
      `,
      [orgId, termId],
    );
    return result.rows;
  }

  private async expandBroaderTerms(
    client: PoolClient,
    orgId: string,
    termId: string,
    depth: number,
  ): Promise<AuthorityTermSummaryRow[]> {
    const result = await client.query<AuthorityTermSummaryRow>(
      `
      WITH RECURSIVE chain AS (
        SELECT r.to_term_id AS term_id, 1 AS depth
        FROM authority_term_relations r
        WHERE r.organization_id = $1
          AND r.relation_type = 'broader'::authority_relation_type
          AND r.from_term_id = $2
        UNION
        SELECT r.to_term_id AS term_id, chain.depth + 1 AS depth
        FROM authority_term_relations r
        JOIN chain
          ON chain.term_id = r.from_term_id
        WHERE r.organization_id = $1
          AND r.relation_type = 'broader'::authority_relation_type
          AND chain.depth < $3
      )
      SELECT DISTINCT
        t.id,
        t.kind,
        t.vocabulary_code,
        t.preferred_label,
        t.status,
        t.source
      FROM chain
      JOIN authority_terms t
        ON t.id = chain.term_id
      ORDER BY t.preferred_label ASC, t.id ASC
      `,
      [orgId, termId, depth],
    );

    return result.rows;
  }

  private async expandNarrowerTerms(
    client: PoolClient,
    orgId: string,
    termId: string,
    depth: number,
  ): Promise<AuthorityTermSummaryRow[]> {
    const result = await client.query<AuthorityTermSummaryRow>(
      `
      WITH RECURSIVE chain AS (
        SELECT r.from_term_id AS term_id, 1 AS depth
        FROM authority_term_relations r
        WHERE r.organization_id = $1
          AND r.relation_type = 'broader'::authority_relation_type
          AND r.to_term_id = $2
        UNION
        SELECT r.from_term_id AS term_id, chain.depth + 1 AS depth
        FROM authority_term_relations r
        JOIN chain
          ON chain.term_id = r.to_term_id
        WHERE r.organization_id = $1
          AND r.relation_type = 'broader'::authority_relation_type
          AND chain.depth < $3
      )
      SELECT DISTINCT
        t.id,
        t.kind,
        t.vocabulary_code,
        t.preferred_label,
        t.status,
        t.source
      FROM chain
      JOIN authority_terms t
        ON t.id = chain.term_id
      ORDER BY t.preferred_label ASC, t.id ASC
      `,
      [orgId, termId, depth],
    );

    return result.rows;
  }
}

function canonicalizeRelatedPair(a: string, b: string) {
  // related（RT）是對稱關係：
  // - 我們用 UUID 字串排序，確保 A↔B 永遠只存一筆
  // - 這樣 unique constraint 能自然防止重複
  return a < b ? { from: a, to: b } : { from: b, to: a };
}

function stripRelationId(row: AuthorityTermSummaryRow & { relation_id: string }): AuthorityTermSummaryRow {
  const { relation_id: _relationId, ...term } = row;
  return term;
}

function clampDepth(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function uniqLabels(values: string[]) {
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

function indexCsvHeader(headers: string[]) {
  // 注意：回傳用 plain object（而不是 Map）是為了讓後續取值更方便（idx['from_term_id']）。
  // 這裡不把 value 型別做成 number|undefined，改用 `key in idx` 判斷 header 是否存在（更貼近 JS 實際語意）。
  const map: Record<string, number> = {};
  for (let i = 0; i < headers.length; i += 1) {
    const key = headers[i]!;
    if (!key) continue;
    map[key] = i;
  }
  return map;
}

function toCsvCell(value: string) {
  const raw = String(value ?? '');
  // CSV quoting：含逗號/換行/雙引號就必須用雙引號包起來，並把 " 變成 ""
  if (raw.includes(',') || raw.includes('\n') || raw.includes('\r') || raw.includes('"')) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

function pathTopIds(paths: string[][]) {
  const out: string[] = [];
  for (const p of paths) {
    const last = p[p.length - 1];
    if (last) out.push(last);
  }
  return out;
}

function uniq(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const key = v.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
