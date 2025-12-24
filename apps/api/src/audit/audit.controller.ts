/**
 * AuditController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/audit-events
 *
 * 目前提供：
 * - GET /audit-events：查詢稽核事件（依時間/操作者/事件類型）
 *
 * 設計重點：
 * - 多租戶隔離：所有查詢都必須在 orgId 範圍內
 * - 一致的驗證：用 zod + ZodValidationPipe 驗證 query
 */

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuditService } from './audit.service';
import { listAuditEventsQuerySchema } from './audit.schemas';

@Controller('api/v1/orgs/:orgId/audit-events')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(listAuditEventsQuerySchema)) query: any,
  ) {
    return await this.audit.list(orgId, query);
  }
}

