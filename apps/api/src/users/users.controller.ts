/**
 * UsersController
 *
 * 路由前綴：/api/v1/orgs/:orgId/users
 * - GET  列出/搜尋 users（query=...）
 * - POST 建立 user
 *
 * 目前沒有登入/權限控管（MVP 先把資料模型與流程做起來）。
 * 之後加上 auth 時，會在 controller 層加 guard 來限制誰能操作。
 */

import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createUserSchema,
  importUsersCsvSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from './users.schemas';
import { UsersService } from './users.service';

@Controller('api/v1/orgs/:orgId/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: any,
  ) {
    // query filters（US-011）：
    // - query：模糊搜尋 external_id/name/org_unit
    // - role/status：精準篩選
    return await this.users.list(orgId, query);
  }

  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createUserSchema)) body: any,
  ) {
    return await this.users.create(orgId, body);
  }

  /**
   * 更新/停用使用者（US-011）
   *
   * PATCH /api/v1/orgs/:orgId/users/:userId
   *
   * 設計重點：
   * - 需要 actor_user_id（admin/librarian），後端做最小 RBAC + 寫 audit
   * - 支援 status=inactive（停用）/status=active（啟用）
   * - 其他欄位（name/org_unit/role）可用於更正資料
   */
  @Patch(':userId')
  async update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: any,
  ) {
    return await this.users.update(orgId, userId, body);
  }

  /**
   * US-010：使用者名冊 CSV 匯入（preview/apply）
   *
   * - preview：不寫 DB，只回傳「將新增/更新/停用」的預估與錯誤
   * - apply：寫 DB + 寫 audit_events
   *
   * 注意：MVP 無登入，因此必須由前端傳 actor_user_id，後端會驗證 admin/librarian。
   */
  @Post('import')
  async importCsv(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(importUsersCsvSchema)) body: any,
  ) {
    return await this.users.importCsv(orgId, body);
  }
}
