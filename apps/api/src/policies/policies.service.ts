/**
 * PoliciesService
 *
 * 目前提供：
 * - list：列出某 org 的所有借閱政策
 * - create：新增借閱政策
 * - update：更新借閱政策（含設為有效）
 *
 * 後續借出（checkout）時會依 `users.role` 取出對應政策，用它來計算 due_at。
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import type { CreatePolicyInput, UpdatePolicyInput } from './policies.schemas';

// PolicyRow：SQL 查詢回傳的 policy 欄位。
type PolicyRow = {
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class PoliciesService {
  constructor(private readonly db: DbService) {}

  async list(orgId: string): Promise<PolicyRow[]> {
    // 依 organization_id 篩選（多租戶隔離）。
    const result = await this.db.query<PolicyRow>(
      `
      SELECT
        id, organization_id, code, name, audience_role,
        loan_days, max_loans, max_renewals, max_holds, hold_pickup_days, overdue_block_days,
        is_active,
        created_at, updated_at
      FROM circulation_policies
      WHERE organization_id = $1
      ORDER BY is_active DESC, created_at DESC
      `,
      [orgId],
      { orgId },
    );
    return result.rows;
  }

  async create(orgId: string, input: CreatePolicyInput): Promise<PolicyRow> {
    try {
      return await this.db.transactionWithOrg(orgId, async (client) => {
        // 1) 同一 org + role 同時只允許一筆 active policy（schema.sql 的 partial unique index）
        // - create 時我們採「新建即生效」：先把同 role 的舊 active 全部設為 inactive，再插入新政策為 active
        // - 好處：館員建立新政策後立即生效，且舊政策仍保留作為歷史版本（可追溯）
        await this.deactivateActivePoliciesForRole(client, orgId, input.audience_role);

        // 2) 同 org 內 policy code 必須唯一（schema.sql：UNIQUE (organization_id, code)）
        const result = await client.query<PolicyRow>(
          `
          INSERT INTO circulation_policies (
            organization_id, code, name, audience_role,
            loan_days, max_loans, max_renewals, max_holds, hold_pickup_days, overdue_block_days,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING
            id, organization_id, code, name, audience_role,
            loan_days, max_loans, max_renewals, max_holds, hold_pickup_days, overdue_block_days,
            is_active,
            created_at, updated_at
          `,
          [
            orgId,
            input.code,
            input.name,
            input.audience_role,
            input.loan_days,
            input.max_loans,
            input.max_renewals,
            input.max_holds,
            input.hold_pickup_days,
            input.overdue_block_days,
            true,
          ],
        );
        return result.rows[0]!;
      });
    } catch (error: any) {
      // 23503：organization_id 不存在。
      if (error?.code === '23503') {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Organization not found' },
        });
      }
      // 23505：policy code 重複。
      if (error?.code === '23505') {
        throw new ConflictException({
          error: { code: 'CONFLICT', message: 'Policy code already exists' },
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
   * update：更新 policy（含設為有效）
   *
   * 注意：
   * - is_active 只允許設為 true（啟用）；「停用」由啟用另一筆政策來完成
   */
  async update(orgId: string, policyId: string, input: UpdatePolicyInput): Promise<PolicyRow> {
    return await this.db.transactionWithOrg(orgId, async (client) => {
      // 1) 先確認 policy 存在，並取得它的 audience_role（啟用時需要用來解除同 role 其他 active）
      const existing = await client.query<{ id: string; audience_role: PolicyRow['audience_role'] }>(
        `
        SELECT id, audience_role
        FROM circulation_policies
        WHERE organization_id = $1
          AND id = $2
        `,
        [orgId, policyId],
      );

      if (existing.rowCount === 0) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Policy not found' },
        });
      }

      const role = existing.rows[0]!.audience_role;

      // 2) 若要啟用：先把同 role 的 active policy 全部停用（避免 unique index 衝突）
      if (input.is_active === true) {
        await this.deactivateActivePoliciesForRole(client, orgId, role);
      }

      // 3) 組出 UPDATE SET 子句（只更新有提供的欄位）
      const setClauses: string[] = [];
      const params: unknown[] = [orgId, policyId];

      const addClause = (column: string, value: unknown) => {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
      };

      if (input.code !== undefined) addClause('code', input.code);
      if (input.name !== undefined) addClause('name', input.name);

      if (input.loan_days !== undefined) addClause('loan_days', input.loan_days);
      if (input.max_loans !== undefined) addClause('max_loans', input.max_loans);
      if (input.max_renewals !== undefined) addClause('max_renewals', input.max_renewals);
      if (input.max_holds !== undefined) addClause('max_holds', input.max_holds);
      if (input.hold_pickup_days !== undefined) addClause('hold_pickup_days', input.hold_pickup_days);
      if (input.overdue_block_days !== undefined) addClause('overdue_block_days', input.overdue_block_days);

      if (input.is_active === true) addClause('is_active', true);

      if (setClauses.length === 0) {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'No fields to update' },
        });
      }

      setClauses.push('updated_at = now()');

      try {
        const result = await client.query<PolicyRow>(
          `
          UPDATE circulation_policies
          SET ${setClauses.join(', ')}
          WHERE organization_id = $1
            AND id = $2
          RETURNING
            id, organization_id, code, name, audience_role,
            loan_days, max_loans, max_renewals, max_holds, hold_pickup_days, overdue_block_days,
            is_active,
            created_at, updated_at
          `,
          params,
        );

        if (result.rowCount === 0) {
          // 理論上不會發生（因為上面已查過 exists）；保險起見仍處理
          throw new NotFoundException({
            error: { code: 'NOT_FOUND', message: 'Policy not found' },
          });
        }

        return result.rows[0]!;
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new ConflictException({
            error: { code: 'CONFLICT', message: 'Policy code already exists' },
          });
        }
        if (error?.code === '22P02') {
          throw new BadRequestException({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid identifier format' },
          });
        }
        throw error;
      }
    });
  }

  private async deactivateActivePoliciesForRole(
    client: PoolClient,
    orgId: string,
    role: PolicyRow['audience_role'],
  ) {
    await client.query(
      `
      UPDATE circulation_policies
      SET is_active = false, updated_at = now()
      WHERE organization_id = $1
        AND audience_role = $2::user_role
        AND is_active = true
      `,
      [orgId, role],
    );
  }
}
