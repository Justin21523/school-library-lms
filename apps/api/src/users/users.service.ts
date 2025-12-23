/**
 * UsersService
 *
 * 目前提供：
 * - list：列出/搜尋使用者（以 external_id / name / org_unit）
 * - create：新增使用者
 *
 * 注意：MVP 的重點是「資料結構正確」與「操作省力」，
 * 所以我們先把 external_id 當作唯一鍵（同 org 內唯一）。
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { CreateUserInput } from './users.schemas';

// UserRow：SQL 查詢回傳的 user 欄位。
type UserRow = {
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

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async list(orgId: string, query?: string): Promise<UserRow[]> {
    // 簡化搜尋：用 ILIKE + %...% 做模糊查詢（適合 MVP）。
    // - 如果 query 為空，search 會是 null，SQL 會直接略過條件。
    const search = query?.trim() ? `%${query.trim()}%` : null;

    const result = await this.db.query<UserRow>(
      `
      SELECT id, organization_id, external_id, name, role, org_unit, status, created_at, updated_at
      FROM users
      WHERE organization_id = $1
        AND (
          $2::text IS NULL
          OR external_id ILIKE $2
          OR name ILIKE $2
          OR org_unit ILIKE $2
        )
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [orgId, search],
    );
    return result.rows;
  }

  async create(orgId: string, input: CreateUserInput): Promise<UserRow> {
    try {
      // 新增 user：在 schema.sql 裡有 UNIQUE (organization_id, external_id)
      // 代表同一所學校 external_id 不能重複。
      const result = await this.db.query<UserRow>(
        `
        INSERT INTO users (organization_id, external_id, name, role, org_unit)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, organization_id, external_id, name, role, org_unit, status, created_at, updated_at
        `,
        [orgId, input.external_id, input.name, input.role, input.org_unit ?? null],
      );
      return result.rows[0]!;
    } catch (error: any) {
      // 23503：organization_id 不存在（FK violation）。
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }
      // 23505：external_id 重複（unique violation）。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'external_id already exists in this organization' },
        });
      }
      // 22P02：UUID 格式錯誤（保險起見）。
      if (error?.code === '22P02') {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
        });
      }
      throw error;
    }
  }
}
