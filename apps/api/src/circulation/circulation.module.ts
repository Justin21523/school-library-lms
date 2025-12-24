/**
 * CirculationModule
 *
 * 借還流程（checkout/checkin）集中在這個模組，
 * 讓 transaction + audit 邏輯有清楚邊界。
 */

import { Module } from '@nestjs/common';
import { CirculationController } from './circulation.controller';
import { CirculationService } from './circulation.service';

@Module({
  controllers: [CirculationController],
  providers: [CirculationService],
})
export class CirculationModule {}
