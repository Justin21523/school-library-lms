/**
 * MeController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/me
 *
 * 這組端點的定位：
 * - 「登入後」的讀者自助 API（OPAC Account）
 * - 由 PatronAuthGuard 驗證 token，並推導目前 user_id
 *
 * 提供：
 * - GET  /me：取得我的基本資料
 * - GET  /me/loans：我的借閱清單
 * - GET  /me/holds：我的預約清單
 * - POST /me/holds：替自己建立預約（place hold）
 * - POST /me/holds/:holdId/cancel：取消自己的預約
 */

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PatronAuthGuard } from '../auth/patron-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { listMyHoldsQuerySchema, listMyLoansQuerySchema, placeMyHoldSchema } from './me.schemas';
import { MeService } from './me.service';

@UseGuards(PatronAuthGuard)
@Controller('api/v1/orgs/:orgId/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  private requireUserId(req: any) {
    const userId = req?.patron_user?.id;
    if (typeof userId === 'string' && userId.trim()) return userId.trim();
    throw new UnauthorizedException({
      error: { code: 'UNAUTHORIZED', message: 'Missing authenticated user' },
    });
  }

  @Get()
  async getMe(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: any,
  ) {
    return await this.me.getMe(orgId, this.requireUserId(req));
  }

  @Get('loans')
  async listMyLoans(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: any,
    @Query(new ZodValidationPipe(listMyLoansQuerySchema)) query: any,
  ) {
    return await this.me.listMyLoans(orgId, this.requireUserId(req), query);
  }

  @Get('holds')
  async listMyHolds(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: any,
    @Query(new ZodValidationPipe(listMyHoldsQuerySchema)) query: any,
  ) {
    return await this.me.listMyHolds(orgId, this.requireUserId(req), query);
  }

  @Post('holds')
  async placeHold(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(placeMyHoldSchema)) body: any,
  ) {
    return await this.me.placeHold(orgId, this.requireUserId(req), body);
  }

  @Post('holds/:holdId/cancel')
  async cancelHold(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('holdId', new ParseUUIDPipe()) holdId: string,
    @Req() req: any,
  ) {
    return await this.me.cancelHold(orgId, this.requireUserId(req), holdId);
  }
}
