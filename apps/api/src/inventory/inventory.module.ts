/**
 * InventoryModule
 *
 * 把盤點功能獨立成模組，原因：
 * - 盤點雖然會更新 item（last_inventory_at），但它有自己的工作流（session/scan/diff）
 * - 後續若要擴充「盤點批次處理、盤點報表、盤點規則」也比較好維護
 */

import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}

