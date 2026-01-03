/**
 * HoldsController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/holds
 *
 * 提供：
 * - GET  /holds：查詢預約/保留
 * - POST /holds：建立預約
 * - POST /holds/:holdId/cancel：取消
 * - POST /holds/:holdId/fulfill：取書借出（完成保留）
 *
 * 設計重點：
 * - 多租戶隔離：所有操作都必須在 orgId 範圍內
 * - 一致的驗證：用 zod + ZodValidationPipe 驗證 body/query
 */

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { HoldsService } from './holds.service';
import {
  cancelHoldSchema,
  createHoldSchema,
  expireReadyHoldsSchema,
  fulfillHoldSchema,
  listHoldsQuerySchema,
} from './holds.schemas';

@UseGuards(StaffAuthGuard)
@Controller('api/v1/orgs/:orgId/holds')
export class HoldsController {
  constructor(private readonly holds: HoldsService) {}

  private requireStaffUserId(req: any) {
    const userId = req?.staff_user?.id;
    if (typeof userId === 'string' && userId.trim()) return userId.trim();
    throw new UnauthorizedException({
      error: { code: 'UNAUTHORIZED', message: 'Missing authenticated staff user' },
    });
  }

  @Get()
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(listHoldsQuerySchema)) query: any,
  ) {
    return await this.holds.list(orgId, query);
  }

  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(createHoldSchema)) body: any,
  ) {
    // actor_user_id：優先由 StaffAuthGuard 推導（避免前端可冒用/可省略導致 audit 失真）
    return await this.holds.create(orgId, {
      ...body,
      actor_user_id: this.requireStaffUserId(req),
    });
  }

  @Post(':holdId/cancel')
  async cancel(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('holdId', new ParseUUIDPipe()) holdId: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(cancelHoldSchema)) body: any,
  ) {
    return await this.holds.cancel(orgId, holdId, {
      ...body,
      actor_user_id: this.requireStaffUserId(req),
    });
  }

  @Post(':holdId/fulfill')
  async fulfill(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('holdId', new ParseUUIDPipe()) holdId: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(fulfillHoldSchema)) body: any,
  ) {
    return await this.holds.fulfill(orgId, holdId, {
      ...body,
      actor_user_id: this.requireStaffUserId(req),
    });
  }

  /**
   * Holds 到期處理（ready_until → expired）
   *
   * POST /api/v1/orgs/:orgId/holds/expire-ready
   *
   * - mode=preview：回傳「將被處理的 holds」清單（不寫 DB）
   * - mode=apply：實際更新 holds + 釋放/轉派 item（寫 DB + 寫 audit）
   */
  @Post('expire-ready')
  async expireReady(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(expireReadyHoldsSchema)) body: any,
  ) {
    return await this.holds.expireReady(orgId, {
      ...body,
      actor_user_id: this.requireStaffUserId(req),
    });
  }
}
