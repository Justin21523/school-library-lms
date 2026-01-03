/**
 * AuthModule（Global）
 *
 * 目的：
 * - 提供 staff auth（login / token verification / StaffAuthGuard）
 *
 * 為什麼做成 Global module？
 * - auth 是 cross-cutting concern：users/reports/circulation/audit... 都需要 guard
 * - 做成 global 可以避免每個 module 都要重複 import/export
 */

import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';
import { PatronAuthGuard } from './patron-auth.guard';
import { StaffAuthGuard } from './staff-auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, StaffAuthGuard, PatronAuthGuard, AuthRateLimitService, AuthRateLimitGuard],
  exports: [AuthService, StaffAuthGuard, PatronAuthGuard, AuthRateLimitService, AuthRateLimitGuard],
})
export class AuthModule {}
