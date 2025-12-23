/**
 * BibsService
 *
 * 書目（bibliographic_records）的資料存取與搜尋邏輯。
 * - list：基本搜尋 + 回傳可借冊數量
 * - create：新增書目
 * - getById：取得單一書目（含可借冊數）
 * - update：部分更新書目
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { CreateBibliographicInput, UpdateBibliographicInput } from './bibs.schemas';

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
}
