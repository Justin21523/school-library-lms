/**
 * CirculationController
 *
 * 路由前綴：/api/v1/orgs/:orgId/circulation
 * - POST /checkout 借出
 * - POST /checkin  歸還
 *
 * 這裡只做 HTTP 層的參數綁定與驗證，核心邏輯放在 Service。
 */

import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CirculationService } from './circulation.service';
import { checkoutSchema, checkinSchema, renewSchema } from './circulation.schemas';

@UseGuards(StaffAuthGuard)
@Controller('api/v1/orgs/:orgId/circulation')
export class CirculationController {
  constructor(private readonly circulation: CirculationService) {}

  @Post('checkout')
  async checkout(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(checkoutSchema)) body: any,
  ) {
    return await this.circulation.checkout(orgId, body);
  }

  @Post('checkin')
  async checkin(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(checkinSchema)) body: any,
  ) {
    return await this.circulation.checkin(orgId, body);
  }

  @Post('renew')
  async renew(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(renewSchema)) body: any,
  ) {
    return await this.circulation.renew(orgId, body);
  }
}
