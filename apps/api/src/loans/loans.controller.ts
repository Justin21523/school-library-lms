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

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LoansService } from './loans.service';
import { listLoansQuerySchema, purgeLoanHistorySchema } from './loans.schemas';

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

  /**
   * US-061：借閱歷史保存期限（Purge loan history）
   *
   * POST /api/v1/orgs/:orgId/loans/purge-history
   *
   * - mode=preview：只回傳候選清單與摘要（不寫 DB）
   * - mode=apply：實際刪除（寫 DB + 寫 audit）
   */
  @Post('purge-history')
  async purgeHistory(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(purgeLoanHistorySchema)) body: any,
  ) {
    return await this.loans.purgeHistory(orgId, body);
  }
}
