/**
 * BibsController
 *
 * 路由前綴：/api/v1/orgs/:orgId/bibs
 * - GET   列出/搜尋書目（query/isbn/classification）
 * - POST  建立書目
 * - GET   取得單一書目（含可借冊數）
 * - PATCH 更新書目
 *
 * 書目屬於 organization，因此所有操作都以 orgId 作為多租戶邊界。
 */

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BibsService } from './bibs.service';
import { createBibliographicSchema, updateBibliographicSchema } from './bibs.schemas';

@Controller('api/v1/orgs/:orgId/bibs')
export class BibsController {
  constructor(private readonly bibs: BibsService) {}

  @Get()
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query('query') query?: string,
    @Query('isbn') isbn?: string,
    @Query('classification') classification?: string,
  ) {
    // query/isbn/classification 皆為可選；未提供時回傳最新 200 筆。
    return await this.bibs.list(orgId, { query, isbn, classification });
  }

  @UseGuards(StaffAuthGuard)
  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createBibliographicSchema)) body: any,
  ) {
    return await this.bibs.create(orgId, body);
  }

  @Get(':bibId')
  async getById(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('bibId', new ParseUUIDPipe()) bibId: string,
  ) {
    return await this.bibs.getById(orgId, bibId);
  }

  @UseGuards(StaffAuthGuard)
  @Patch(':bibId')
  async update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('bibId', new ParseUUIDPipe()) bibId: string,
    @Body(new ZodValidationPipe(updateBibliographicSchema)) body: any,
  ) {
    return await this.bibs.update(orgId, bibId, body);
  }
}
