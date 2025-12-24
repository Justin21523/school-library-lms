/**
 * HoldsModule
 *
 * holds 是一個獨立的功能域：
 * - 讀者：建立/查看/取消預約
 * - 館員：查看隊列、完成取書借出（fulfill）
 *
 * 把它拆成 module 的好處：
 * - 讓 circulation/loans/holds 各自維持清楚邊界
 * - 後續若要加「過期（expired）批次處理」或「通知」也有自然擴充點
 */

import { Module } from '@nestjs/common';
import { HoldsController } from './holds.controller';
import { HoldsService } from './holds.service';

@Module({
  controllers: [HoldsController],
  providers: [HoldsService],
})
export class HoldsModule {}

