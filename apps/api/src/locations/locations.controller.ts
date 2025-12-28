/**
 * LocationsController
 *
 * 路由前綴：/api/v1/orgs/:orgId/locations
 * - GET  列出 locations
 * - POST 建立 location
 *
 * 為什麼掛在 orgs 底下？
 * - location 是「某一所學校」的設定與主檔
 * - 以 URL 表達多租戶邊界：/orgs/{orgId}/...
 */

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createLocationSchema, updateLocationSchema } from './locations.schemas';
import { LocationsService } from './locations.service';

@Controller('api/v1/orgs/:orgId/locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  async list(@Param('orgId', new ParseUUIDPipe()) orgId: string) {
    return await this.locations.list(orgId);
  }

  @UseGuards(StaffAuthGuard)
  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createLocationSchema)) body: any,
  ) {
    return await this.locations.create(orgId, body);
  }

  /**
   * 更新/停用 location（US-001）
   *
   * PATCH /api/v1/orgs/:orgId/locations/:locationId
   *
   * - location 是主檔（master data）；多數情境不建議刪除，而是改成 inactive
   * - inactive 的 location 不應再被用於：
   *   - 新增冊（items.create / catalog import）
   *   - 新建預約的取書地點（holds.create / me.placeHold）
   *   - 新建盤點 session（inventory.createSession）
   */
  @UseGuards(StaffAuthGuard)
  @Patch(':locationId')
  async update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
    @Body(new ZodValidationPipe(updateLocationSchema)) body: any,
  ) {
    return await this.locations.update(orgId, locationId, body);
  }
}
