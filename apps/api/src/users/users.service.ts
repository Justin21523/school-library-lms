/**
 * UsersService
 *
 * 目前提供：
 * - list：列出/搜尋使用者（以 external_id / name / org_unit）
 * - create：新增使用者
 * - update（US-011）：更新/停用使用者（寫入 audit）
 * - importCsv（US-010）：CSV 匯入名冊（preview/apply + 批次停用 + audit）
 *
 * 注意：MVP 的重點是「資料結構正確」與「操作省力」，
 * 所以我們先把 external_id 當作唯一鍵（同 org 內唯一）。
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
import { decodeCursorV1, encodeCursorV1, normalizeSortToIso, type CursorPage } from '../common/cursor';
import { DbService } from '../db/db.service';
import { parseCsv } from '../common/csv';
import type { CreateUserInput } from './users.schemas';
import type {
  ImportUsersCsvInput,
  ListUsersQuery,
  UpdateUserInput,
  UserRole,
  UserStatus,
} from './users.schemas';

// UserRow：SQL 查詢回傳的 user 欄位。
type UserRow = {
  id: string;
  organization_id: string;
  external_id: string;
  name: string;
  role: UserRole;
  org_unit: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

// staff：能做「匯入」這種敏感操作的角色（對齊 circulation / reports / audit 的最小 RBAC）
// - 後續若導入 auth，actor 將由 token 推導；這裡的最小 RBAC 依然可當作 guard 規則基礎
const STAFF_ACTOR_ROLES: UserRole[] = ['admin', 'librarian'];

// staff roles：權限較高的帳號（不應被一般館員隨意修改）
const STAFF_ROLES: UserRole[] = ['admin', 'librarian'];

// roster 匯入的角色範圍（US-010 明確是學生/教師名冊）
type RosterRole = 'student' | 'teacher';

type CsvCanonicalColumn = 'external_id' | 'name' | 'role' | 'org_unit' | 'status';

type ImportRowError = {
  row_number: number;
  code: string;
  message: string;
  field?: CsvCanonicalColumn | 'csv';
  details?: unknown;
};

type ImportRowNormalized = {
  row_number: number;
  external_id: string;
  name: string;
  role: RosterRole;
  org_unit: string | null | undefined; // undefined 代表「CSV 沒這欄 → 不更新」
  status: UserStatus | undefined; // undefined 代表「不更新」
};

type ImportRowPlan = ImportRowNormalized & {
  // action：根據 DB 現況推導（create/update/unchanged/invalid）
  action: 'create' | 'update' | 'unchanged' | 'invalid';
  // changes：只列出「本次匯入會更新的欄位」
  changes: CsvCanonicalColumn[];
};

type ImportSummary = {
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

  // csv：基本資訊（方便前端顯示）
  csv: {
    // header：原始 header（trim 後）
    header: string[];
    // sha256：方便 audit/追溯（不含 PII 內容；只是雜湊）
    sha256: string;
  };

  // options：這次匯入採用的模式（讓前端可顯示「你目前開了什麼選項」）
  options: {
    deactivate_missing: boolean;
    deactivate_missing_roles: RosterRole[];
    default_role: RosterRole | null;
    update_status: boolean;
    update_org_unit: boolean;
  };

  summary: ImportSummary;
  errors: ImportRowError[];

  // rows：前 N 筆的預覽（避免一次回太大）
  // - 這裡是「已正規化」的結果，方便 UI 直接表格顯示
  rows: ImportRowPlan[];

  // to_deactivate_preview：將停用的使用者（前 N 筆）
  to_deactivate_preview: Array<{
    id: string;
    external_id: string;
    name: string;
    role: RosterRole;
    status: UserStatus;
  }>;
};

export type UsersCsvImportApplyResult = {
  mode: 'apply';
  summary: ImportSummary;
  audit_event_id: string;
};

export type UsersCsvImportResult = UsersCsvImportPreviewResult | UsersCsvImportApplyResult;

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  /**
   * US-011：查詢與篩選使用者
   *
   * - query：模糊搜尋（external_id/name/org_unit）
   * - role/status：精準篩選
   *
   * 注意：
   * - 為了支援大量資料（scale seed），此端點採用 cursor pagination（keyset）
   * - 這個端點會被很多頁面用來「挑 actor/borrrower」；因此要保持快且穩定
   */
  async list(orgId: string, query: ListUsersQuery): Promise<CursorPage<UserRow>> {
    // 1) 組 where clauses（只加有提供的 filter）
    const whereClauses: string[] = ['organization_id = $1'];
    const params: unknown[] = [orgId];

    if (query.query) {
      // 模糊搜尋：用 ILIKE + %...%（MVP 最實用）
      params.push(`%${query.query}%`);
      const p = `$${params.length}`;
      whereClauses.push(`(external_id ILIKE ${p} OR name ILIKE ${p} OR org_unit ILIKE ${p})`);
    }

    if (query.role) {
      params.push(query.role);
      whereClauses.push(`role = $${params.length}::user_role`);
    }

    if (query.status) {
      params.push(query.status);
      whereClauses.push(`status = $${params.length}::user_status`);
    }

    // 2) cursor：若前端帶 cursor，代表要「接著上一頁往後翻」
    // - users 的排序鍵：created_at DESC, id DESC
    // - 因此下一頁條件是：(created_at, id) < (cursor.sort, cursor.id)
    if (query.cursor) {
      try {
        const cursor = decodeCursorV1(query.cursor);
        params.push(cursor.sort, cursor.id);
        const sortParam = `$${params.length - 1}`;
        const idParam = `$${params.length}`;
        whereClauses.push(`(created_at, id) < (${sortParam}::timestamptz, ${idParam}::uuid)`);
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

    // 3) limit：我們用「多抓 1 筆」來判斷是否還有下一頁
    // - 若回傳 rows.length > pageSize：代表還有下一頁
    // - next_cursor 用「本頁最後一筆」產生（前端下一次帶回來即可續查）
    const pageSize = query.limit ?? 200;
    const queryLimit = pageSize + 1;
    params.push(queryLimit);
    const limitParam = `$${params.length}`;

    const result = await this.db.query<UserRow>(
      `
      SELECT id, organization_id, external_id, name, role, org_unit, status, created_at, updated_at
      FROM users
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limitParam}
      `,
      params,
      { orgId },
    );

    const rows = result.rows;

    // 只回傳 pageSize 筆；第 pageSize+1 筆只用來判斷是否還有下一頁。
    const items = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;

    const last = items.at(-1) ?? null;
    const next_cursor =
      hasMore && last ? encodeCursorV1({ sort: normalizeSortToIso(last.created_at), id: last.id }) : null;

    return { items, next_cursor };
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
        { orgId },
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

  /**
   * US-011：更新/停用使用者（寫入 audit_events）
   *
   * PATCH /orgs/:orgId/users/:userId
   *
   * 這裡處理兩類常見情境：
   * 1) 更正主檔：name/org_unit/role（例如班級升級、姓名更正）
   * 2) 停用/啟用：status=inactive/active（例如畢業、離校、離職）
   *
   * 權限策略（MVP）：
   * - actor_user_id 必須是 admin/librarian
   * - librarian 只能管理「非 staff 帳號」（student/teacher/guest）
   * - admin 才能管理 staff（admin/librarian）或調整 role 到 staff
   */
  async update(orgId: string, userId: string, input: UpdateUserInput): Promise<UserRow> {
    return await this.db.transactionWithOrg(orgId, async (client) => {
      // 1) 驗證操作者（admin/librarian 且 active）
      const actor = await this.requireStaffActor(client, orgId, input.actor_user_id);

      // 2) 鎖定目標使用者列（FOR UPDATE）：避免同時兩個人修改造成覆蓋
      const targetResult = await client.query<UserRow>(
        `
        SELECT id, organization_id, external_id, name, role, org_unit, status, created_at, updated_at
        FROM users
        WHERE organization_id = $1
          AND id = $2
        FOR UPDATE
        `,
        [orgId, userId],
      );

      if (targetResult.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      const target = targetResult.rows[0]!;

      // 3) 權限與安全防呆：librarian 不可修改 staff 帳號、也不可把人升級成 staff
      this.assertCanManageUser(actor.role, target.role, input.role);

      // 4) 計算「實際有變更」的欄位（避免不必要 update + 保持 updated_at 穩定）
      const updates: Partial<Pick<UserRow, 'name' | 'role' | 'org_unit' | 'status'>> = {};
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      if (input.name !== undefined && input.name !== target.name) {
        updates.name = input.name;
        changes['name'] = { from: target.name, to: input.name };
      }

      if (input.role !== undefined && input.role !== target.role) {
        updates.role = input.role;
        changes['role'] = { from: target.role, to: input.role };
      }

      // org_unit：undefined=不更新；null=清空；string=設定
      if (input.org_unit !== undefined) {
        const desired = input.org_unit;
        const current = target.org_unit ?? null;
        if (current !== desired) {
          updates.org_unit = desired;
          changes['org_unit'] = { from: current, to: desired };
        }
      }

      if (input.status !== undefined && input.status !== target.status) {
        updates.status = input.status;
        changes['status'] = { from: target.status, to: input.status };
      }

      // 5) 若沒有任何變更：直接回傳原資料（PATCH 的冪等性）
      if (Object.keys(updates).length === 0) return target;

      // 6) 組 UPDATE SQL（只更新變更欄位 + updated_at）
      const setClauses: string[] = ['updated_at = now()'];
      const params: unknown[] = [orgId, userId];

      const pushSet = (column: string, value: unknown) => {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
      };

      if (updates.name !== undefined) pushSet('name', updates.name);
      if (updates.role !== undefined) pushSet('role', updates.role);
      if (updates.org_unit !== undefined) pushSet('org_unit', updates.org_unit);
      if (updates.status !== undefined) pushSet('status', updates.status);

      const updatedResult = await client.query<UserRow>(
        `
        UPDATE users
        SET ${setClauses.join(', ')}
        WHERE organization_id = $1
          AND id = $2
        RETURNING id, organization_id, external_id, name, role, org_unit, status, created_at, updated_at
        `,
        params,
      );

      const updated = updatedResult.rows[0]!;

      // 7) 寫 audit event：記錄「誰」改了「哪個 user」的「哪些欄位」
      await client.query(
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
        `,
        [
          orgId,
          actor.id,
          'user.update',
          'user',
          updated.id,
          JSON.stringify({
            user_external_id: updated.external_id,
            note: input.note ?? null,
            changes,
          }),
        ],
      );

      return updated;
    });
  }

  /**
   * US-010：CSV 匯入使用者名冊
   *
   * 核心能力（對齊 USER-STORIES.md 驗收）：
   * - 新增/更新：以 external_id 作為唯一鍵
   * - 預覽：列號/欄位/原因（errors）
   * - 批次停用：deactivate_missing（每學期畢業/轉出最常用）
   * - 寫入稽核：audit_events（追溯誰匯入、匯入了什麼策略/結果）
   */
  async importCsv(orgId: string, input: ImportUsersCsvInput): Promise<UsersCsvImportResult> {
    // 重要：匯入屬於「敏感操作」：
    // - 含大量個資（姓名/學號）
    // - 會批次變更資料
    // 因此我們統一用 transaction 包起來：
    // - preview：雖然不寫入，但可確保「同一個一致快照」下判斷 create/update/deactivate
    // - apply：確保寫入與 audit event 同步成功/失敗（避免寫入成功但 audit 失敗）
    return await this.db.transactionWithOrg(orgId, async (client) => {
      // 1) 權限控管（MVP）：匯入者必須是 staff（admin/librarian 且 active）
      const actor = await this.requireStaffActor(client, orgId, input.actor_user_id);

      // 2) 解析 CSV → header + data rows
      const parsed = parseCsv(input.csv_text);
      if (parsed.records.length === 0) {
        throw new BadRequestException({
          error: { code: 'CSV_EMPTY', message: 'CSV is empty' },
        });
      }

      const header = (parsed.records[0] ?? []).map((h) => h.trim());

      // header 不能全空；否則無法做欄位映射
      if (header.length === 0 || header.every((h) => !h)) {
        throw new BadRequestException({
          error: { code: 'CSV_HEADER_EMPTY', message: 'CSV header row is empty' },
        });
      }

      // sha256：用來追溯「匯入的是哪一份內容」
      // - 不把 CSV 原文存到 audit（太大、也包含大量個資）
      // - 存雜湊可以做到「可驗證」而不暴露內容
      const sha256 = createHash('sha256').update(input.csv_text, 'utf8').digest('hex');

      // 3) header → canonical columns（external_id/name/role/org_unit/status）
      const columnIndex = this.resolveUserImportColumns(header);

      // 必要欄位：external_id + name
      if (columnIndex.external_id === null || columnIndex.name === null) {
        throw new BadRequestException({
          error: {
            code: 'CSV_MISSING_REQUIRED_COLUMNS',
            message: 'CSV must include required columns: external_id, name',
            details: {
              required: ['external_id', 'name'],
              header,
            },
          },
        });
      }

      const deactivateMissing = input.deactivate_missing ?? false;
      const deactivateMissingRoles: RosterRole[] = deactivateMissing
        ? this.normalizeRosterRoles(input.deactivate_missing_roles ?? ['student'])
        : [];

      // role 欄位：可以由 CSV 提供，也可以用 default_role 補上
      // - 若兩者都沒有，就無法建立/更新（因為 users.role 是 NOT NULL）
      const defaultRole = input.default_role ?? null;
      const hasRoleColumn = columnIndex.role !== null;

      if (!hasRoleColumn && !defaultRole) {
        throw new BadRequestException({
          error: {
            code: 'CSV_MISSING_ROLE',
            message: 'CSV missing role column; default_role is required',
          },
        });
      }

      // status/org_unit 是否會被更新？
      // - org_unit：只有在 CSV 有這欄時才更新（避免沒給欄位就把既有值清空）
      // - status：
      //   - CSV 有 status 欄：更新（可用於批次停用/啟用）
      //   - 或 deactivate_missing=true（roster sync）：視 CSV 為「在籍清單」，檔內預設 active，檔外批次 inactive
      const updateOrgUnit = columnIndex.org_unit !== null;
      const updateStatus = columnIndex.status !== null || deactivateMissing;

      // 4) 逐列解析 + 驗證（只做「檔案本身」的錯誤，不含 DB 狀態）
      const errors: ImportRowError[] = [];
      const normalizedRows: ImportRowNormalized[] = [];

      const dataRows = parsed.records.slice(1);

      for (let i = 0; i < dataRows.length; i += 1) {
        const row = dataRows[i] ?? [];
        const rowNumber = i + 2; // 1-based + header row

        // 欄位數不一致：多半代表 CSV 格式錯（例如沒正確加引號導致逗號被誤判）
        // - 我們仍嘗試讀出已存在的欄位，讓使用者能看到錯在哪一列
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

        const externalId = getCell(columnIndex.external_id);
        const name = getCell(columnIndex.name);
        const roleRaw = getCell(columnIndex.role);
        const orgUnitRaw = getCell(columnIndex.org_unit);
        const statusRaw = getCell(columnIndex.status);

        // external_id：必填
        if (!externalId) {
          errors.push({
            row_number: rowNumber,
            code: 'MISSING_EXTERNAL_ID',
            message: 'external_id is required',
            field: 'external_id',
          });
          continue;
        }
        if (externalId.length > 64) {
          errors.push({
            row_number: rowNumber,
            code: 'EXTERNAL_ID_TOO_LONG',
            message: 'external_id is too long (max 64)',
            field: 'external_id',
          });
          continue;
        }

        // name：必填
        if (!name) {
          errors.push({
            row_number: rowNumber,
            code: 'MISSING_NAME',
            message: 'name is required',
            field: 'name',
          });
          continue;
        }
        if (name.length > 200) {
          errors.push({
            row_number: rowNumber,
            code: 'NAME_TOO_LONG',
            message: 'name is too long (max 200)',
            field: 'name',
          });
          continue;
        }

        // role：必填（來自 CSV 或 default_role）
        const roleParsed =
          this.parseRosterRole(roleRaw) ?? (defaultRole ? this.parseRosterRole(defaultRole) : null);
        if (!roleParsed) {
          errors.push({
            row_number: rowNumber,
            code: 'INVALID_ROLE',
            message: 'role must be student/teacher (or provide default_role)',
            field: 'role',
            details: { raw: roleRaw },
          });
          continue;
        }

        // org_unit：只有在 CSV 有這欄時才更新；空字串視為 null（清空）
        let orgUnit: string | null | undefined = undefined;
        if (updateOrgUnit) {
          const trimmed = orgUnitRaw.trim();
          if (!trimmed) {
            orgUnit = null;
          } else if (trimmed.length > 64) {
            errors.push({
              row_number: rowNumber,
              code: 'ORG_UNIT_TOO_LONG',
              message: 'org_unit is too long (max 64)',
              field: 'org_unit',
            });
            continue;
          } else {
            orgUnit = trimmed;
          }
        }

        // status：只有在「要更新 status」時才解析
        // - CSV 有 status 欄：依內容解析（空字串 → active）
        // - roster sync：CSV 沒 status 欄時，檔內預設 active（代表仍在籍/在職）
        let status: UserStatus | undefined = undefined;
        if (updateStatus) {
          const parsedStatus = this.parseUserStatus(statusRaw);
          if (!parsedStatus) {
            errors.push({
              row_number: rowNumber,
              code: 'INVALID_STATUS',
              message: 'status must be active/inactive (or leave blank to default active)',
              field: 'status',
              details: { raw: statusRaw },
            });
            continue;
          }
          status = parsedStatus;
        }

        normalizedRows.push({
          row_number: rowNumber,
          external_id: externalId,
          name,
          role: roleParsed,
          org_unit: orgUnit,
          status,
        });
      }

      // 5) 檔案內重複 external_id：通常代表名冊本身有問題（或 header mapping 錯）
      // - 我們把所有重複列都視為 invalid，避免「到底要用哪一列」的不確定性
      const firstRowByExternalId = new Map<string, number>();
      for (const r of normalizedRows) {
        const first = firstRowByExternalId.get(r.external_id);
        if (first === undefined) {
          firstRowByExternalId.set(r.external_id, r.row_number);
          continue;
        }
        errors.push({
          row_number: r.row_number,
          code: 'DUPLICATE_EXTERNAL_ID',
          message: `external_id is duplicated in CSV (first seen at row ${first})`,
          field: 'external_id',
        });
      }

      // 6) 把「有錯誤的列」排除出有效資料（用 row_number 做過濾）
      const invalidRowNumbers = new Set(errors.map((e) => e.row_number));
      const validRows = normalizedRows.filter((r) => !invalidRowNumbers.has(r.row_number));

      // 7) 取得既有 users（用 external_id 批次查詢，避免 N+1）
      const validExternalIds = validRows.map((r) => r.external_id);
      const existingByExternalId = await this.getUsersByExternalIds(client, orgId, validExternalIds);

      // 8) 建立「每列會發生什麼事」的計畫（create/update/unchanged）
      const plannedRows: ImportRowPlan[] = validRows.map((r) => {
        const existing = existingByExternalId.get(r.external_id) ?? null;

        // 注意：匯入名冊只接受 student/teacher
        // - 若 external_id 撞到 staff（admin/librarian），我們直接拒絕（避免誤改權限/身份）
        if (existing && STAFF_ROLES.includes(existing.role)) {
          invalidRowNumbers.add(r.row_number);
          errors.push({
            row_number: r.row_number,
            code: 'ROLE_CONFLICT_WITH_STAFF',
            message: 'Cannot import roster row that matches an existing staff account',
            field: 'role',
            details: { existing_role: existing.role },
          });
          return {
            ...r,
            action: 'invalid',
            changes: [],
          };
        }

        // 把「本次匯入會更新的欄位」列出來（前端可用於顯示 diff）
        const changes: CsvCanonicalColumn[] = [];

        if (!existing) {
          // 新增：對匯入而言，name/role/status/org_unit 都是「會寫入」的欄位
          // - org_unit/status 可能是 undefined（代表 CSV 沒欄位、且不更新），但 insert 仍會給合理預設
          return { ...r, action: 'create', changes: ['external_id', 'name', 'role'] };
        }

        // 更新判斷：只比較「本次匯入會更新的欄位」
        // - name/role：一定會更新（若不同）
        if (existing.name !== r.name) changes.push('name');
        if (existing.role !== r.role) changes.push('role');

        // org_unit/status：依 header/options 決定是否更新
        if (updateOrgUnit) {
          const desired = r.org_unit ?? null;
          if ((existing.org_unit ?? null) !== desired) changes.push('org_unit');
        }

        if (updateStatus) {
          // updateStatus=true 時，r.status 一定有值（前面已解析）
          const desired = r.status ?? 'active';
          if (existing.status !== desired) changes.push('status');
        }

        return {
          ...r,
          action: changes.length === 0 ? 'unchanged' : 'update',
          changes,
        };
      });

      // 9) roster sync（deactivate_missing）：計算「將被停用」的使用者清單
      let toDeactivatePreview: UsersCsvImportPreviewResult['to_deactivate_preview'] = [];
      let toDeactivateCount = 0;

      if (deactivateMissing) {
        // 安全防呆：若你要停用某個 role，CSV 至少要包含該 role 的有效列
        // - 例如：你勾選「停用教師」，但其實上傳的是「只有學生」的 CSV
        //   → 會把所有教師都停用（災難），因此直接擋掉
        for (const role of deactivateMissingRoles) {
          const hasAny = plannedRows.some((r) => r.action !== 'invalid' && r.role === role);
          if (!hasAny) {
            errors.push({
              row_number: 1,
              code: 'DEACTIVATE_MISSING_ROLE_NOT_PRESENT',
              message: `deactivate_missing_roles includes ${role}, but CSV has no valid rows for that role`,
              field: 'csv',
              details: { role },
            });
          }
        }

        // 若 CSV 本身已有錯誤，仍回 preview 給使用者修正；apply 會擋
        if (validRows.length > 0) {
          const externalIdSet = new Set(validRows.map((r) => r.external_id));

          const deact = await client.query<{
            id: string;
            external_id: string;
            name: string;
            role: RosterRole;
            status: UserStatus;
          }>(
            `
            SELECT id, external_id, name, role, status
            FROM users
            WHERE organization_id = $1
              AND status = 'active'
              AND role = ANY($2::user_role[])
              AND NOT (external_id = ANY($3::text[]))
            ORDER BY external_id ASC
            LIMIT 200
            `,
            [orgId, deactivateMissingRoles, Array.from(externalIdSet)],
          );

          // 只回前 200 筆預覽（避免 payload 過大）
          toDeactivatePreview = deact.rows;

          // count：再做一次 count 查詢，避免 LIMIT 影響
          const countResult = await client.query<{ count: string }>(
            `
            SELECT COUNT(*)::text AS count
            FROM users
            WHERE organization_id = $1
              AND status = 'active'
              AND role = ANY($2::user_role[])
              AND NOT (external_id = ANY($3::text[]))
            `,
            [orgId, deactivateMissingRoles, Array.from(externalIdSet)],
          );
          toDeactivateCount = Number.parseInt(countResult.rows[0]?.count ?? '0', 10);
        }
      }

      // 10) summary：讓 UI 可以直接顯示「這次匯入會發生什麼」
      const plannedValidRows = plannedRows.filter((r) => r.action !== 'invalid');
      const toCreate = plannedValidRows.filter((r) => r.action === 'create').length;
      const toUpdate = plannedValidRows.filter((r) => r.action === 'update').length;
      const unchanged = plannedValidRows.filter((r) => r.action === 'unchanged').length;

      const summary: ImportSummary = {
        total_rows: dataRows.length,
        valid_rows: plannedValidRows.length,
        invalid_rows: dataRows.length - plannedValidRows.length,
        to_create: toCreate,
        to_update: toUpdate,
        unchanged,
        to_deactivate: toDeactivateCount,
      };

      // preview rows：只回前 N 筆（避免 UI/網路負擔）
      const previewRows = plannedRows.slice(0, 200);

      const preview: UsersCsvImportPreviewResult = {
        mode: 'preview',
        csv: { header, sha256 },
        options: {
          deactivate_missing: deactivateMissing,
          deactivate_missing_roles: deactivateMissingRoles,
          default_role: defaultRole ? (this.parseRosterRole(defaultRole) as RosterRole) : null,
          update_status: updateStatus,
          update_org_unit: updateOrgUnit,
        },
        summary,
        errors,
        rows: previewRows,
        to_deactivate_preview: toDeactivatePreview,
      };

      if (input.mode === 'preview') return preview;

      // apply：只要有錯誤就拒絕（避免部分寫入造成名冊狀態不確定）
      if (errors.length > 0) {
        throw new BadRequestException({
          error: {
            code: 'CSV_IMPORT_INVALID',
            message: 'CSV import has validation errors; run preview and fix errors before apply',
            details: { errors, summary },
          },
        });
      }

      // 11) apply：寫入 users（upsert）+ 批次停用 + 寫 audit_events
      const applyResult = await this.applyUsersImport(client, orgId, {
        actor_user_id: actor.id,
        csv_sha256: sha256,
        source_filename: input.source_filename ?? null,
        source_note: input.source_note ?? null,
        update_org_unit: updateOrgUnit,
        update_status: updateStatus,
        rows: plannedValidRows,
        deactivate_missing: deactivateMissing,
        deactivate_missing_roles: deactivateMissingRoles,
      });

      return applyResult;
    });
  }

  // ----------------------------
  // apply helpers
  // ----------------------------

  private async applyUsersImport(
    client: PoolClient,
    orgId: string,
    plan: {
      actor_user_id: string;
      csv_sha256: string;
      source_filename: string | null;
      source_note: string | null;
      update_org_unit: boolean;
      update_status: boolean;
      rows: ImportRowPlan[]; // 已經排除 invalid
      deactivate_missing: boolean;
      deactivate_missing_roles: RosterRole[];
    },
  ): Promise<UsersCsvImportApplyResult> {
    // 1) upsert users
    // - 我們一次處理所有有效列（含 unchanged）
    // - SQL 端用 `WHERE ... IS DISTINCT FROM ...` 避免不必要的 update（保持 updated_at 不亂跳）

    const validExternalIds = plan.rows.map((r) => r.external_id);
    const existingBefore = await this.getUsersByExternalIds(client, orgId, validExternalIds);

    const insertStatusForNew = (r: ImportRowPlan): UserStatus => {
      // status 在 insert 時一定要有值（DB NOT NULL）
      // - update_status=true：r.status 有值
      // - update_status=false：代表不更新既有 status，但新建仍預設 active
      return plan.update_status ? (r.status ?? 'active') : 'active';
    };

    const chunkSize = 300; // 避免單一 SQL 太長；300 在 MVP 夠用，也便於未來調整
    let affectedInserted = 0;
    let affectedUpdated = 0;

    for (let i = 0; i < plan.rows.length; i += chunkSize) {
      const chunk = plan.rows.slice(i, i + chunkSize);

      // values / params：用參數化避免 SQL injection
      const params: unknown[] = [];
      const valuesSql: string[] = [];

      for (const r of chunk) {
        // 每列 6 個欄位：orgId + external_id + name + role + org_unit + status
        // - org_unit：若本次不更新 org_unit，insert 時仍可存 null（符合 DB schema）
        // - status：同上（新建必須有值）
        params.push(
          orgId,
          r.external_id,
          r.name,
          r.role,
          plan.update_org_unit ? (r.org_unit ?? null) : null,
          insertStatusForNew(r),
        );

        const base = params.length - 5;
        valuesSql.push(
          `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
        );
      }

      const setClauses: string[] = [
        `name = EXCLUDED.name`,
        `role = EXCLUDED.role`,
        `updated_at = now()`,
      ];
      if (plan.update_org_unit) setClauses.push(`org_unit = EXCLUDED.org_unit`);
      if (plan.update_status) setClauses.push(`status = EXCLUDED.status`);

      const diffClauses: string[] = [
        `users.name IS DISTINCT FROM EXCLUDED.name`,
        `users.role IS DISTINCT FROM EXCLUDED.role`,
      ];
      if (plan.update_org_unit) diffClauses.push(`users.org_unit IS DISTINCT FROM EXCLUDED.org_unit`);
      if (plan.update_status) diffClauses.push(`users.status IS DISTINCT FROM EXCLUDED.status`);

      const result = await client.query<{ external_id: string }>(
        `
        INSERT INTO users (organization_id, external_id, name, role, org_unit, status)
        VALUES ${valuesSql.join(',\n')}
        ON CONFLICT (organization_id, external_id) DO UPDATE
        SET ${setClauses.join(', ')}
        WHERE ${diffClauses.join(' OR ')}
        RETURNING external_id
        `,
        params,
      );

      // 分類 inserted vs updated：
      // - 若 external_id 在 existingBefore map 內 → 原本就存在 → 此次是 update
      // - 否則 → insert
      for (const row of result.rows) {
        if (existingBefore.has(row.external_id)) affectedUpdated += 1;
        else affectedInserted += 1;
      }
    }

    const unchanged = plan.rows.length - affectedInserted - affectedUpdated;

    // 2) deactivate missing（批次停用）
    let deactivated = 0;
    if (plan.deactivate_missing) {
      const externalIdSet = new Set(plan.rows.map((r) => r.external_id));

      const deact = await client.query(
        `
        UPDATE users
        SET status = 'inactive', updated_at = now()
        WHERE organization_id = $1
          AND status = 'active'
          AND role = ANY($2::user_role[])
          AND NOT (external_id = ANY($3::text[]))
        `,
        [orgId, plan.deactivate_missing_roles, Array.from(externalIdSet)],
      );
      deactivated = deact.rowCount ?? 0;
    }

    // 3) audit event：一筆事件記錄「這次匯入」的策略與結果
    const auditResult = await client.query<{ id: string }>(
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
        plan.actor_user_id,
        'user.import_csv',
        'user',
        'bulk',
        JSON.stringify({
          csv_sha256: plan.csv_sha256,
          source_filename: plan.source_filename,
          source_note: plan.source_note,
          update_org_unit: plan.update_org_unit,
          update_status: plan.update_status,
          deactivate_missing: plan.deactivate_missing,
          deactivate_missing_roles: plan.deactivate_missing_roles,
          inserted: affectedInserted,
          updated: affectedUpdated,
          unchanged,
          deactivated,
          total_rows: plan.rows.length,
        }),
      ],
    );

    const summary: ImportSummary = {
      total_rows: plan.rows.length,
      valid_rows: plan.rows.length,
      invalid_rows: 0,
      to_create: affectedInserted,
      to_update: affectedUpdated,
      unchanged,
      to_deactivate: deactivated,
    };

    return {
      mode: 'apply',
      summary,
      audit_event_id: auditResult.rows[0]!.id,
    };
  }

  // ----------------------------
  // query/helpers
  // ----------------------------

  /**
   * requireStaffActor：驗證 actor_user_id 屬於此 org，且為 active 的 admin/librarian
   *
   * 我們把「需要 staff 才能做的操作」集中用這個 helper：
   * - user.import_csv（US-010）
   * - user.update（US-011）
   *
   * 好處：
   * - 錯誤格式一致（NOT_FOUND/USER_INACTIVE/FORBIDDEN）
   * - 未來導入 auth 時，可以把這段替換成「由 token 推導 actor」
   */
  private async requireStaffActor(client: PoolClient, orgId: string, actorUserId: string) {
    const result = await client.query<Pick<UserRow, 'id' | 'role' | 'status'>>(
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

    if (!STAFF_ACTOR_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to manage users' },
      });
    }

    return actor;
  }

  /**
   * 最小 RBAC：限制 librarian 對 staff 的變更
   *
   * - admin：可管理所有使用者（含 staff）
   * - librarian：只能管理 student/teacher/guest；不可變更 admin/librarian
   *
   * 目的：
   * - 降低「一般館員不小心把人升成 admin」或「停用 admin 導致無法維運」的風險
   * - 即使 MVP 沒有 auth，仍保留最小安全邊界，並利於未來加 guard
   */
  private assertCanManageUser(
    actorRole: UserRole,
    targetRole: UserRole,
    desiredRole: UserRole | undefined,
  ) {
    // admin：放行（MVP 最小控管）
    if (actorRole === 'admin') return;

    // 非 admin 只有 librarian 會進到這裡（因為 requireStaffActor 已經限制 staff roles）
    // - 防呆：若未來 staff roles 擴充，這裡仍可保守拒絕
    if (actorRole !== 'librarian') {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Actor is not allowed to manage users' },
      });
    }

    // librarian 不可動 staff（admin/librarian）
    if (STAFF_ROLES.includes(targetRole)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Librarian cannot modify staff accounts' },
      });
    }

    // librarian 不可把人升級成 staff
    if (desiredRole && STAFF_ROLES.includes(desiredRole)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Librarian cannot promote users to staff roles' },
      });
    }
  }

  private async getUsersByExternalIds(client: PoolClient, orgId: string, externalIds: string[]) {
    if (externalIds.length === 0) return new Map<string, UserRow>();

    const result = await client.query<UserRow>(
      `
      SELECT id, organization_id, external_id, name, role, org_unit, status, created_at, updated_at
      FROM users
      WHERE organization_id = $1
        AND external_id = ANY($2::text[])
      `,
      [orgId, externalIds],
    );

    const map = new Map<string, UserRow>();
    for (const row of result.rows) map.set(row.external_id, row);
    return map;
  }

  /**
   * header mapping：把 CSV 的 header（可能是英文/中文/不同命名）映射成 canonical columns。
   *
   * 支援常見別名（學校現場常見）：
   * - external_id：external_id / externalId / 學號 / 員編
   * - name：name / 姓名
   * - role：role / 角色 / 身分
   * - org_unit：org_unit / 班級 / 單位
   * - status：status / 狀態
   */
  private resolveUserImportColumns(header: string[]): Record<CsvCanonicalColumn, number | null> {
    const index: Record<CsvCanonicalColumn, number | null> = {
      external_id: null,
      name: null,
      role: null,
      org_unit: null,
      status: null,
    };

    const normalizeKey = (raw: string) =>
      raw
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[_-]/g, '');

    const aliasToCanonical: Record<string, CsvCanonicalColumn> = {
      // external_id
      externalid: 'external_id',
      studentid: 'external_id',
      userid: 'external_id',
      學號: 'external_id',
      員編: 'external_id',
      教職員編號: 'external_id',

      // name
      name: 'name',
      姓名: 'name',

      // role
      role: 'role',
      角色: 'role',
      身分: 'role',
      身份: 'role',

      // org_unit
      orgunit: 'org_unit',
      班級: 'org_unit',
      年班: 'org_unit',
      單位: 'org_unit',

      // status
      status: 'status',
      狀態: 'status',
    };

    for (let i = 0; i < header.length; i += 1) {
      const raw = header[i] ?? '';
      const key = normalizeKey(raw);
      if (!key) continue;

      const canonical = aliasToCanonical[key];
      if (!canonical) continue;

      // 同一個 canonical 只能對應到一欄；避免 ambiguous mapping
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

  private parseRosterRole(value: string): RosterRole | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const lowered = trimmed.toLowerCase();

    // 英文
    if (lowered === 'student') return 'student';
    if (lowered === 'teacher') return 'teacher';

    // 中文（常見）
    if (trimmed === '學生') return 'student';
    if (trimmed === '教師') return 'teacher';

    return null;
  }

  private normalizeRosterRoles(values: RosterRole[]) {
    // 去重 + 固定排序（讓 audit metadata 比較穩定）
    const set = new Set<RosterRole>(values);
    return (['student', 'teacher'] as RosterRole[]).filter((r) => set.has(r));
  }

  private parseUserStatus(value: string): UserStatus | null {
    const trimmed = value.trim();

    // 空字串：視為 active（方便 Excel 欄位留空）
    if (!trimmed) return 'active';

    const lowered = trimmed.toLowerCase();
    if (lowered === 'active') return 'active';
    if (lowered === 'inactive') return 'inactive';

    // 中文（常見）
    if (trimmed === '啟用') return 'active';
    if (trimmed === '停用') return 'inactive';
    if (trimmed === '在學') return 'active';
    if (trimmed === '離校') return 'inactive';
    if (trimmed === '畢業') return 'inactive';

    return null;
  }
}
