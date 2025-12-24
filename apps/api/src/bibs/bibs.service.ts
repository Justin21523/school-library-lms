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
import { parseCsv } from '../common/csv';
import { DbService } from '../db/db.service';
import type {
  CatalogCsvImportMode,
  CreateBibliographicInput,
  ImportCatalogCsvInput,
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

@Injectable()
export class BibsService {
  constructor(private readonly db: DbService) {}

  async list(
    orgId: string,
    filters: { query?: string; isbn?: string; classification?: string },
  ): Promise<BibliographicWithCountsRow[]> {
    // query：關鍵字搜尋（title/creators/subjects/...）；空字串視為未提供。
    const search = filters.query?.trim() ? `%${filters.query.trim()}%` : null;

    // isbn：採精確比對（常見做法是條碼/ISBN 直接掃碼）。
    const isbn = filters.isbn?.trim() ? filters.isbn.trim() : null;

    // classification：用 prefix 搜尋（輸入 823 可找到 823.914）。
    const classification = filters.classification?.trim()
      ? `${filters.classification.trim()}%`
      : null;

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
          $4::text IS NULL
          OR b.title ILIKE $4
          OR COALESCE(array_to_string(b.creators, ' '), '') ILIKE $4
          OR COALESCE(array_to_string(b.contributors, ' '), '') ILIKE $4
          OR COALESCE(array_to_string(b.subjects, ' '), '') ILIKE $4
          OR COALESCE(b.publisher, '') ILIKE $4
          OR COALESCE(b.isbn, '') ILIKE $4
          OR COALESCE(b.classification, '') ILIKE $4
        )
      GROUP BY b.id
      ORDER BY b.created_at DESC
      LIMIT 200
      `,
      [orgId, isbn, classification, search],
    );
    return result.rows;
  }

  async create(orgId: string, input: CreateBibliographicInput): Promise<BibliographicRow> {
    try {
      const result = await this.db.query<BibliographicRow>(
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
          isbn,
          classification
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
          isbn,
          classification,
          created_at,
          updated_at
        `,
        [
          orgId,
          input.title,
          input.creators ?? null,
          input.contributors ?? null,
          input.publisher ?? null,
          input.published_year ?? null,
          input.language ?? null,
          input.subjects ?? null,
          input.isbn ?? null,
          input.classification ?? null,
        ],
      );
      return result.rows[0]!;
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

  async getById(orgId: string, bibId: string): Promise<BibliographicWithCountsRow> {
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

    return result.rows[0]!;
  }

  async update(
    orgId: string,
    bibId: string,
    input: UpdateBibliographicInput,
  ): Promise<BibliographicRow> {
    const setClauses: string[] = [];
    const params: unknown[] = [orgId, bibId];

    // 只更新「有提供的欄位」，避免把未提供的值寫成 NULL。
    const addClause = (column: string, value: unknown) => {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    };

    if (input.title !== undefined) addClause('title', input.title);
    if (input.creators !== undefined) addClause('creators', input.creators);
    if (input.contributors !== undefined) addClause('contributors', input.contributors);
    if (input.publisher !== undefined) addClause('publisher', input.publisher);
    if (input.published_year !== undefined) addClause('published_year', input.published_year);
    if (input.language !== undefined) addClause('language', input.language);
    if (input.subjects !== undefined) addClause('subjects', input.subjects);
    if (input.isbn !== undefined) addClause('isbn', input.isbn);
    if (input.classification !== undefined) addClause('classification', input.classification);

    if (setClauses.length === 0) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
      });
    }

    // updated_at 一律更新，確保 UI 可用它排序/同步。
    setClauses.push('updated_at = now()');

    const result = await this.db.query<BibliographicRow>(
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

    return result.rows[0]!;
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

      // 若使用 default_location_id，先驗證它存在（避免整批資料都掉到不存在的 location）
      if (defaultLocationId) {
        await this.assertLocationIdExists(client, orgId, defaultLocationId);
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
            bib.subjects ?? null,
            bib.isbn ?? null,
            bib.classification ?? null,
          ],
        );
        createdBibIds.set(bibKey, inserted.rows[0]!.id);
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
      `,
      [orgId, ids],
    );

    return new Set(result.rows.map((r) => r.id));
  }

  private async assertLocationIdExists(client: PoolClient, orgId: string, locationId: string) {
    const result = await client.query<LocationByIdRow>(
      `
      SELECT id
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
