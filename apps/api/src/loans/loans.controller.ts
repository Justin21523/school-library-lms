/**
 * LoansController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/loans
 *
 * 目前提供：
 * - GET /api/v1/orgs/:orgId/loans：借閱查詢（預設列出 open loans）
 *
 * 重要概念：
 * - loans 是「交易資料」，通常需要搭配 users/items/bibs 才好用
 * - 因此 list 會回傳「loan + borrower + item + bib title」的組合資料
 */

import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LoansService } from './loans.service';
import { listLoansQuerySchema } from './loans.schemas';

@Controller('api/v1/orgs/:orgId/loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    // 用 zod 驗證 query params（status/user_external_id/item_barcode/limit）。
    @Query(new ZodValidationPipe(listLoansQuerySchema)) query: any,
  ) {
    return await this.loans.list(orgId, query);
  }
}

