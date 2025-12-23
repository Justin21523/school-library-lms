/**
 * ItemsService
 *
 * 冊（item_copies）的資料存取與查詢邏輯。
 * - list：依 barcode/status/location/bibliographic_id 篩選
 * - create：在某書目底下新增冊
 * - getById：取得單一冊
 * - update：更新位置/狀態/備註等
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { itemStatusValues } from './items.schemas';
import type { CreateItemInput, UpdateItemInput } from './items.schemas';

type ItemStatus = (typeof itemStatusValues)[number];

// ItemRow：對應 item_copies 欄位。
type ItemRow = {
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

@Injectable()
export class ItemsService {
  constructor(private readonly db: DbService) {}

  async list(
    orgId: string,
    filters: {
      barcode?: string;
      status?: string;
      location_id?: string;
      bibliographic_id?: string;
    },
  ): Promise<ItemRow[]> {
    const barcodeSearch = filters.barcode?.trim() ? `%${filters.barcode.trim()}%` : null;
    const status = filters.status?.trim() ? filters.status.trim() : null;
    const locationId = filters.location_id?.trim() ? filters.location_id.trim() : null;
    const bibliographicId = filters.bibliographic_id?.trim()
      ? filters.bibliographic_id.trim()
      : null;

    // status 若給了不合法的 enum 值，直接回 400（避免 DB error）。
    if (status && !itemStatusValues.includes(status as ItemStatus)) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid item status filter' },
      });
    }

    try {
      const result = await this.db.query<ItemRow>(
        `
        SELECT
          id,
          organization_id,
          bibliographic_id,
          barcode,
          call_number,
          location_id,
          status,
          acquired_at,
          last_inventory_at,
          notes,
          created_at,
          updated_at
        FROM item_copies
        WHERE organization_id = $1
          AND ($2::text IS NULL OR barcode ILIKE $2)
          AND ($3::text IS NULL OR status = $3::item_status)
          AND ($4::uuid IS NULL OR location_id = $4)
          AND ($5::uuid IS NULL OR bibliographic_id = $5)
        ORDER BY created_at DESC
        LIMIT 200
        `,
        [orgId, barcodeSearch, status, locationId, bibliographicId],
      );
      return result.rows;
    } catch (error: any) {
      // 22P02 = invalid_text_representation：UUID/enum 轉型失敗。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid filter format' },
        });
      }
      throw error;
    }
  }

  async create(orgId: string, bibId: string, input: CreateItemInput): Promise<ItemRow> {
    // 防止跨 org 亂接：先確認 bibliographic/location 都屬於同一 org。
    await this.assertBibliographicExists(orgId, bibId);
    await this.assertLocationExists(orgId, input.location_id);

    try {
      const result = await this.db.query<ItemRow>(
        `
        INSERT INTO item_copies (
          organization_id,
          bibliographic_id,
          barcode,
          call_number,
          location_id,
          status,
          acquired_at,
          last_inventory_at,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          organization_id,
          bibliographic_id,
          barcode,
          call_number,
          location_id,
          status,
          acquired_at,
          last_inventory_at,
          notes,
          created_at,
          updated_at
        `,
        [
          orgId,
          bibId,
          input.barcode,
          input.call_number,
          input.location_id,
          input.status ?? 'available',
          input.acquired_at ?? null,
          input.last_inventory_at ?? null,
          input.notes ?? null,
        ],
      );
      return result.rows[0]!;
    } catch (error: any) {
      // 23505 = unique_violation：barcode 在同 org 內重複。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'Barcode already exists in this organization' },
        });
      }
      // 23503 = foreign_key_violation：bib/location 不存在（保險）。
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Referenced record not found' },
        });
      }
      // 22P02 = invalid_text_representation：UUID/enum 格式錯誤。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  async getById(orgId: string, itemId: string): Promise<ItemRow> {
    const result = await this.db.query<ItemRow>(
      `
      SELECT
        id,
        organization_id,
        bibliographic_id,
        barcode,
        call_number,
        location_id,
        status,
        acquired_at,
        last_inventory_at,
        notes,
        created_at,
        updated_at
      FROM item_copies
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, itemId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Item not found' },
      });
    }

    return result.rows[0]!;
  }

  async update(orgId: string, itemId: string, input: UpdateItemInput): Promise<ItemRow> {
    const setClauses: string[] = [];
    const params: unknown[] = [orgId, itemId];

    const addClause = (column: string, value: unknown) => {
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    };

    if (input.barcode !== undefined) addClause('barcode', input.barcode);
    if (input.call_number !== undefined) addClause('call_number', input.call_number);

    if (input.location_id !== undefined) {
      // 更新 location 前先確認它屬於同 org（避免跨租戶亂接）。
      await this.assertLocationExists(orgId, input.location_id);
      addClause('location_id', input.location_id);
    }

    if (input.status !== undefined) addClause('status', input.status);
    if (input.acquired_at !== undefined) addClause('acquired_at', input.acquired_at);
    if (input.last_inventory_at !== undefined)
      addClause('last_inventory_at', input.last_inventory_at);
    if (input.notes !== undefined) addClause('notes', input.notes);

    if (setClauses.length === 0) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
      });
    }

    setClauses.push('updated_at = now()');

    try {
      const result = await this.db.query<ItemRow>(
        `
        UPDATE item_copies
        SET ${setClauses.join(', ')}
        WHERE organization_id = $1
          AND id = $2
        RETURNING
          id,
          organization_id,
          bibliographic_id,
          barcode,
          call_number,
          location_id,
          status,
          acquired_at,
          last_inventory_at,
          notes,
          created_at,
          updated_at
        `,
        params,
      );

      if (result.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        });
      }

      return result.rows[0]!;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;

      // 23505 = unique_violation：barcode 重複。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'Barcode already exists in this organization' },
        });
      }
      // 22P02 = invalid_text_representation：UUID/enum 格式錯誤。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }

  private async assertBibliographicExists(orgId: string, bibId: string) {
    const result = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM bibliographic_records
      WHERE id = $1
        AND organization_id = $2
      `,
      [bibId, orgId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Bibliographic record not found' },
      });
    }
  }

  private async assertLocationExists(orgId: string, locationId: string) {
    const result = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM locations
      WHERE id = $1
        AND organization_id = $2
      `,
      [locationId, orgId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Location not found' },
      });
    }
  }
}
