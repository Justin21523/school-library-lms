/**
 * AuthController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/auth
 *
 * 目前提供（Staff Auth）：
 * - POST /auth/login：staff 登入（external_id + password → access_token）
 * - POST /auth/set-password：staff 設定/重設密碼（需要 StaffAuthGuard）
 * - POST /auth/bootstrap-set-password：第一次設定密碼（需要 AUTH_BOOTSTRAP_SECRET）
 *
 * 注意：
 * - 本專案仍保留 actor_user_id 在 request body/query 的設計，
 *   但透過 StaffAuthGuard 讓 actor_user_id 必須等於登入者（避免冒用）
 */

import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import {
  bootstrapSetStaffPasswordSchema,
  patronLoginSchema,
  setStaffPasswordSchema,
  staffLoginSchema,
} from './auth.schemas';
import { StaffAuthGuard } from './staff-auth.guard';

@Controller('api/v1/orgs/:orgId/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Staff login
   *
   * POST /api/v1/orgs/:orgId/auth/login
   */
  @Post('login')
  async login(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(staffLoginSchema)) body: any,
  ) {
    return await this.auth.staffLogin(orgId, body);
  }

  /**
   * Patron login（OPAC / 讀者端登入）
   *
   * POST /api/v1/orgs/:orgId/auth/patron-login
   */
  @Post('patron-login')
  async patronLogin(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(patronLoginSchema)) body: any,
  ) {
    return await this.auth.patronLogin(orgId, body);
  }

  /**
   * 設定/重設密碼（admin/librarian）
   *
   * POST /api/v1/orgs/:orgId/auth/set-password
   *
   * - 需要 StaffAuthGuard（Bearer token）
   * - guard 會要求 actor_user_id 必須等於登入者（避免冒用）
   */
  @UseGuards(StaffAuthGuard)
  @Post('set-password')
  async setPassword(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(setStaffPasswordSchema)) body: any,
  ) {
    return await this.auth.setStaffPassword(orgId, body);
  }

  /**
   * Bootstrap：第一次設定密碼（需要 AUTH_BOOTSTRAP_SECRET）
   *
   * POST /api/v1/orgs/:orgId/auth/bootstrap-set-password
   *
   * - 用於第一次導入（尚未有任何人能登入）
   * - 若未設定 AUTH_BOOTSTRAP_SECRET，後端會拒絕
   */
  @Post('bootstrap-set-password')
  async bootstrapSetPassword(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(bootstrapSetStaffPasswordSchema)) body: any,
  ) {
    return await this.auth.bootstrapSetStaffPassword(orgId, body);
  }
}
