/**
 * PoliciesModule
 *
 * 借閱政策會在「借出/續借」計算到期日與限制時被用到。
 * 因此它屬於 circulation 的前置主檔，但我們先獨立成模組，保持邊界清楚。
 */

import { Module } from '@nestjs/common';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  controllers: [PoliciesController],
  providers: [PoliciesService],
})
export class PoliciesModule {}
