/**
 * OrgsController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs
 * - POST   /api/v1/orgs        建立 organization
 * - GET    /api/v1/orgs        列出 organizations
 * - GET    /api/v1/orgs/:orgId 取得單一 organization
 */

import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrgsService } from './orgs.service';
import { createOrgSchema } from './orgs.schemas';

@Controller('api/v1/orgs')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Post()
  async create(@Body(new ZodValidationPipe(createOrgSchema)) body: any) {
    // body 已通過 zod 驗證（格式與欄位都符合 createOrgSchema）。
    return await this.orgs.create(body);
  }

  @Get()
  async list() {
    return await this.orgs.list();
  }

  @Get(':orgId')
  async getById(@Param('orgId', new ParseUUIDPipe()) orgId: string) {
    // ParseUUIDPipe 會先檢查 orgId 是否為合法 UUID，不合法會直接回 400。
    return await this.orgs.getById(orgId);
  }
}
