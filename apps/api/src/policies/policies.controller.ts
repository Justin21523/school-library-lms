/**
 * PoliciesController
 *
 * 路由前綴：/api/v1/orgs/:orgId/circulation-policies
 * - GET  列出 policies
 * - POST 建立 policy
 */

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createPolicySchema, updatePolicySchema } from './policies.schemas';
import { PoliciesService } from './policies.service';

@UseGuards(StaffAuthGuard)
@Controller('api/v1/orgs/:orgId/circulation-policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  async list(@Param('orgId', new ParseUUIDPipe()) orgId: string) {
    return await this.policies.list(orgId);
  }

  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createPolicySchema)) body: any,
  ) {
    return await this.policies.create(orgId, body);
  }

  /**
   * 更新政策（含設為有效）
   *
   * PATCH /api/v1/orgs/:orgId/circulation-policies/:policyId
   *
   * - 這個端點同時支援：
   *   1) 更新欄位（loan_days / max_loans / ...）
   *   2) 把某一筆政策設為有效（is_active=true）
   *
   * - 「每個角色一套有效政策」由 DB 的 partial unique index 保證
   *   （circulation_policies_one_active_per_role）
   */
  @Patch(':policyId')
  async update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('policyId', new ParseUUIDPipe()) policyId: string,
    @Body(new ZodValidationPipe(updatePolicySchema)) body: any,
  ) {
    return await this.policies.update(orgId, policyId, body);
  }
}
