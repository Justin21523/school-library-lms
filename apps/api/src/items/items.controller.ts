/**
 * ItemsController
 *
 * 這裡同時處理「冊」的查詢與新增：
 * - GET   /api/v1/orgs/:orgId/items
 * - GET   /api/v1/orgs/:orgId/items/:itemId
 * - PATCH /api/v1/orgs/:orgId/items/:itemId
 * - POST  /api/v1/orgs/:orgId/bibs/:bibId/items
 *
 * 注意：新增冊屬於「某書目底下的資源」，所以路徑掛在 /bibs/:bibId/items。
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
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ItemsService } from './items.service';
import {
  createItemSchema,
  markItemLostSchema,
  markItemRepairSchema,
  markItemWithdrawnSchema,
  updateItemSchema,
} from './items.schemas';

@Controller('api/v1/orgs/:orgId')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get('items')
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query('barcode') barcode?: string,
    @Query('status') status?: string,
    @Query('location_id') locationId?: string,
    @Query('bibliographic_id') bibliographicId?: string,
  ) {
    return await this.items.list(orgId, {
      barcode,
      status,
      location_id: locationId,
      bibliographic_id: bibliographicId,
    });
  }

  @Post('bibs/:bibId/items')
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('bibId', new ParseUUIDPipe()) bibId: string,
    @Body(new ZodValidationPipe(createItemSchema)) body: any,
  ) {
    return await this.items.create(orgId, bibId, body);
  }

  @Get('items/:itemId')
  async getById(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ) {
    return await this.items.getById(orgId, itemId);
  }

  @Patch('items/:itemId')
  async update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body(new ZodValidationPipe(updateItemSchema)) body: any,
  ) {
    return await this.items.update(orgId, itemId, body);
  }

  /**
   * 冊異常狀態：mark-lost / mark-repair / mark-withdrawn
   *
   * 為什麼用動作端點（POST）而不是 PATCH status？
   * - status 影響流通（checkout/renew/holds）與報表（overdue），屬於重要業務狀態
   * - 需要 actor_user_id（館員/管理者）才能寫入 audit_events，保持可追溯
   * - 需要在後端集中做「不合理狀態轉換」的防呆
   */

  @Post('items/:itemId/mark-lost')
  async markLost(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body(new ZodValidationPipe(markItemLostSchema)) body: any,
  ) {
    return await this.items.markLost(orgId, itemId, body);
  }

  @Post('items/:itemId/mark-repair')
  async markRepair(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body(new ZodValidationPipe(markItemRepairSchema)) body: any,
  ) {
    return await this.items.markRepair(orgId, itemId, body);
  }

  @Post('items/:itemId/mark-withdrawn')
  async markWithdrawn(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body(new ZodValidationPipe(markItemWithdrawnSchema)) body: any,
  ) {
    return await this.items.markWithdrawn(orgId, itemId, body);
  }
}
