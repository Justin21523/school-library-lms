/**
 * LoansModule
 *
 * 借閱查詢（loans list）獨立成模組的原因：
 * - loans 在 UI 上是「一個可獨立操作的資源」（resource）
 * - 查詢需求會隨著報表/稽核/逾期清單逐步擴大
 * - 把查詢集中在同一個 module，後續加 filter/排序/分頁更容易維護
 */

import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}

