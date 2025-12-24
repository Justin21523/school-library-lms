/**
 * ReportsModule
 *
 * 這個模組放「報表」相關功能：
 * - 報表通常是 read-only，但會把多表 join 成「可用的資訊視圖」
 * - 並且支援匯出（CSV），方便學校現場做通知/對帳/備份
 *
 * MVP 先落地第一個報表：
 * - Overdue List（逾期清單）
 */

import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

