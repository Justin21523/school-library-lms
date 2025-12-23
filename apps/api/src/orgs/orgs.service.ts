/**
 * OrgsService
 *
 * 這裡放「organization 相關的資料存取邏輯」：
 * - create：建立 org
 * - list：列出 org
 * - getById：查單一 org
 *
 * 注意：Service 不處理 HTTP 細節（那是 Controller 的責任）。
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { CreateOrgInput } from './orgs.schemas';

// 用 TypeScript type 描述「這支查詢會回傳哪些欄位」。
// 這能讓你在寫程式時有 autocomplete，也能減少欄位拼錯。
type OrganizationRow = {
  id: string;
  name: string;
  code: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class OrgsService {
  constructor(private readonly db: DbService) {}

  async create(input: CreateOrgInput): Promise<OrganizationRow> {
    try {
      // 用 parameterized query（$1, $2）避免 SQL injection。
      // input.code 若沒填，就存 NULL（符合 schema.sql 的欄位定義）。
      const result = await this.db.query<OrganizationRow>(
        `
        INSERT INTO organizations (name, code)
        VALUES ($1, $2)
        RETURNING id, name, code, created_at, updated_at
        `,
        [input.name, input.code ?? null],
      );
      return result.rows[0]!;
    } catch (error: any) {
      // Postgres error code 23505 = unique violation（例如 code 重複）。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: {
            code: 'CONFLICT',
            message: 'Organization code already exists',
          },
        });
      }
      throw error;
    }
  }

  async list(): Promise<OrganizationRow[]> {
    // 以 created_at 由新到舊排序，方便管理者看到最新建立的 org。
    const result = await this.db.query<OrganizationRow>(
      `
      SELECT id, name, code, created_at, updated_at
      FROM organizations
      ORDER BY created_at DESC
      `,
    );
    return result.rows;
  }

  async getById(orgId: string): Promise<OrganizationRow> {
    const result = await this.db.query<OrganizationRow>(
      `
      SELECT id, name, code, created_at, updated_at
      FROM organizations
      WHERE id = $1
      `,
      [orgId],
    );

    const row = result.rows[0];
    if (!row) {
      // 找不到就回 404；這比讓前端得到空物件更清楚。
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }
    return row;
  }
}
