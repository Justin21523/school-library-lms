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

import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createLocationSchema } from './locations.schemas';
import { LocationsService } from './locations.service';

@Controller('api/v1/orgs/:orgId/locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  async list(@Param('orgId', new ParseUUIDPipe()) orgId: string) {
    return await this.locations.list(orgId);
  }

  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createLocationSchema)) body: any,
  ) {
    return await this.locations.create(orgId, body);
  }
}
