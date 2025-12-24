/**
 * PoliciesService
 *
 * 目前提供：
 * - list：列出某 org 的所有借閱政策
 * - create：新增借閱政策
 *
 * 後續借出（checkout）時會依 `users.role` 取出對應政策，用它來計算 due_at。
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { CreatePolicyInput } from './policies.schemas';

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
        created_at, updated_at
      FROM circulation_policies
      WHERE organization_id = $1
      ORDER BY created_at DESC
      `,
      [orgId],
    );
    return result.rows;
  }

  async create(orgId: string, input: CreatePolicyInput): Promise<PolicyRow> {
    try {
      // 同 org 內 policy code 必須唯一（schema.sql：UNIQUE (organization_id, code)）。
      const result = await this.db.query<PolicyRow>(
        `
        INSERT INTO circulation_policies (
          organization_id, code, name, audience_role,
          loan_days, max_loans, max_renewals, max_holds, hold_pickup_days, overdue_block_days
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
          id, organization_id, code, name, audience_role,
          loan_days, max_loans, max_renewals, max_holds, hold_pickup_days, overdue_block_days,
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
        ],
      );
      return result.rows[0]!;
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
}
