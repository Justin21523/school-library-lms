/**
 * PoliciesController
 *
 * 路由前綴：/api/v1/orgs/:orgId/circulation-policies
 * - GET  列出 policies
 * - POST 建立 policy
 */

import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createPolicySchema } from './policies.schemas';
import { PoliciesService } from './policies.service';

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
}
