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
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createUserSchema } from './users.schemas';
import { UsersService } from './users.service';

@Controller('api/v1/orgs/:orgId/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query('query') query?: string,
  ) {
    // query 是可選的搜尋字串；若沒給就列出最新 200 筆。
    return await this.users.list(orgId, query);
  }

  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createUserSchema)) body: any,
  ) {
    return await this.users.create(orgId, body);
  }
}
