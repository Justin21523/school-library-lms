/**
 * JobsWorkerService（in-process worker）
 *
 * 這是一個「先求可用」的背景工作執行器：
 * - 不引入 @nestjs/schedule / BullMQ 等依賴（MVP + network restricted 友善）
 * - 用 setInterval + Postgres table-based queue（background_jobs）
 *
 * 風險與取捨：
 * - 這個 worker 跟 API 跑在同一個 process：
 *   - 好處：部署簡單（不需要另外開 worker 容器）
 *   - 代價：job 太重會影響 API latency
 *
 * 因此我們的策略是：
 * - 先把「每日例行」與「可分批」的維運操作搬進來（例如 holds.expire_ready）
 * - import/report 之後再做：
 *   - 先落地 enqueue + job status
 *   - 再逐步把 heavy work 改成 background job（並可切到獨立 worker 容器）
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HoldsService } from '../holds/holds.service';
import { JobsService } from './jobs.service';

@Injectable()
export class JobsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isTickRunning = false;

  // workerId：寫到 locked_by，方便你在 DB 看是哪個 instance 在跑
  private readonly workerId = `api:${process.pid}`;

  constructor(
    private readonly jobs: JobsService,
    private readonly holds: HoldsService,
  ) {}

  onModuleInit() {
    const enabled = (process.env.JOBS_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
    if (!enabled) {
      this.logger.log('jobs worker disabled (JOBS_ENABLED=false)');
      return;
    }

    const intervalMsRaw = Number.parseInt((process.env.JOBS_POLL_INTERVAL_MS ?? '2000').trim(), 10);
    const intervalMs = Number.isFinite(intervalMsRaw) && intervalMsRaw > 0 ? intervalMsRaw : 2000;

    this.logger.log(`jobs worker started (workerId=${this.workerId}, poll=${intervalMs}ms)`);

    // 先跑一次（避免等到第一個 interval 才開始）
    void this.tick();

    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    // 避免重入（例如某次 job 很慢，下一次 interval 又來）
    if (this.isTickRunning) return;
    this.isTickRunning = true;

    try {
      await this.processOne();
    } catch (error: any) {
      this.logger.error(`worker tick failed: ${error?.message ?? String(error)}`);
    } finally {
      this.isTickRunning = false;
    }
  }

  private async processOne() {
    const job = await this.jobs.claimNext(this.workerId);
    if (!job) return;

    const orgId = job.organization_id;
    const kind = job.kind;

    try {
      // 這裡用 switch 明確列出支援的 job kinds（避免 payload 亂長/意外執行不該跑的事）
      switch (kind) {
        case 'holds.expire_ready': {
          const payload = job.payload ?? {};

          const actorUserId = this.jobs.requirePayloadString(payload, 'actor_user_id');
          const limit = this.jobs.parseOptionalInt(payload, 'limit');
          const asOf = this.jobs.parseOptionalString(payload, 'as_of');
          const note = this.jobs.parseOptionalString(payload, 'note');

          // 實際執行：mode 固定 apply（enqueue 的目的就是做非同步 apply）
          const result = await this.holds.expireReady(orgId, {
            actor_user_id: actorUserId,
            mode: 'apply',
            as_of: asOf,
            limit,
            note,
          });

          await this.jobs.markSucceeded(job.id, result);
          this.logger.log(`job succeeded: ${job.id} kind=${kind} org=${orgId}`);
          return;
        }
      }

      // 理論上不會走到：因為 claimNext 只會拿到我們曾經 enqueue 的 kinds
      throw new Error(`Unsupported job kind: ${kind}`);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      await this.jobs.markFailed(job.id, msg);
      this.logger.error(`job failed: ${job.id} kind=${kind} org=${orgId} error=${msg}`);
    }
  }
}

