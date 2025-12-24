/**
 * InventoryController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/inventory
 *
 * 提供的端點（MVP）：
 * - POST /inventory/sessions：開始盤點（建立 session）
 * - GET  /inventory/sessions：列出最近 sessions（方便回看/選擇報表）
 * - POST /inventory/sessions/:sessionId/scan：掃冊條碼（記錄掃描 + 更新 last_inventory_at）
 * - POST /inventory/sessions/:sessionId/close：結束盤點（關閉 session + 寫 audit）
 *
 * Auth/權限：
 * - 盤點是 staff 作業，因此整個 controller 套用 StaffAuthGuard（需要 Bearer token）
 * - actor_user_id 仍保留在 body（寫 audit / RBAC），並由 guard 強制等於登入者（避免冒用）
 */

import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  closeInventorySessionSchema,
  createInventorySessionSchema,
  listInventorySessionsQuerySchema,
  scanInventoryItemSchema,
} from './inventory.schemas';
import { InventoryService } from './inventory.service';

@UseGuards(StaffAuthGuard)
@Controller('api/v1/orgs/:orgId/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /**
   * 建立盤點 session（開始盤點）
   */
  @Post('sessions')
  async createSession(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createInventorySessionSchema)) body: any,
  ) {
    return await this.inventory.createSession(orgId, body);
  }

  /**
   * 列出盤點 sessions（最近 N 筆）
   */
  @Get('sessions')
  async listSessions(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(listInventorySessionsQuerySchema)) query: any,
  ) {
    return await this.inventory.listSessions(orgId, query);
  }

  /**
   * 掃描冊條碼（在某個 session 內）
   */
  @Post('sessions/:sessionId/scan')
  async scanItem(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body(new ZodValidationPipe(scanInventoryItemSchema)) body: any,
  ) {
    return await this.inventory.scanItem(orgId, sessionId, body);
  }

  /**
   * 關閉盤點 session（結束盤點 + 寫 audit）
   */
  @Post('sessions/:sessionId/close')
  async closeSession(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body(new ZodValidationPipe(closeInventorySessionSchema)) body: any,
  ) {
    return await this.inventory.closeSession(orgId, sessionId, body);
  }
}

