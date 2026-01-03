/**
 * JobsModule
 *
 * 注意：這一版的 worker 跟 API 跑在同一個 Nest process（setInterval polling）。
 * - 若未來 jobs 變重，建議拆成獨立 worker container/service（避免影響 API latency）
 */

import { Module } from '@nestjs/common';
import { HoldsModule } from '../holds/holds.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsWorkerService } from './jobs.worker';

@Module({
  imports: [HoldsModule],
  controllers: [JobsController],
  providers: [JobsService, JobsWorkerService],
  exports: [JobsService],
})
export class JobsModule {}

