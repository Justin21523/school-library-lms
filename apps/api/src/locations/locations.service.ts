/**
 * LocationsService
 *
 * location 的資料存取與錯誤處理邏輯。
 * - list：列出某 org 的 locations
 * - create：新增 location
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { CreateLocationInput } from './locations.schemas';

// LocationRow：對應 SQL 查詢回傳的欄位集合。
type LocationRow = {
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

@Injectable()
export class LocationsService {
  constructor(private readonly db: DbService) {}

  async list(orgId: string): Promise<LocationRow[]> {
    // 只列出指定 organization_id 的位置（多租戶隔離）。
    const result = await this.db.query<LocationRow>(
      `
      SELECT id, organization_id, code, name, area, shelf_code, status, created_at, updated_at
      FROM locations
      WHERE organization_id = $1
      ORDER BY created_at DESC
      `,
      [orgId],
    );
    return result.rows;
  }

  async create(orgId: string, input: CreateLocationInput): Promise<LocationRow> {
    try {
      // 新增 location：同一個 org 內 code 必須唯一（schema.sql 的 UNIQUE (organization_id, code)）。
      const result = await this.db.query<LocationRow>(
        `
        INSERT INTO locations (organization_id, code, name, area, shelf_code)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, organization_id, code, name, area, shelf_code, status, created_at, updated_at
        `,
        [orgId, input.code, input.name, input.area ?? null, input.shelf_code ?? null],
      );
      return result.rows[0]!;
    } catch (error: any) {
      // 23503 = foreign_key_violation：orgId 不存在。
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }
      // 23505 = unique_violation：同 org 的 location code 重複。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'Location code already exists' },
        });
      }
      // 22P02 = invalid_text_representation：通常是 UUID 格式錯誤（這裡保險起見）。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }
}
