/**
 * JobsService（background jobs）
 *
 * 我們為什麼先用「Postgres table-based queue」？
 * - MVP/P2 的目標是「可落地」而不是「一次上最完整的 queue 架構」
 * - repo 目前沒有 BullMQ/ioredis 依賴（也避免在 network restricted 環境拉新套件）
 * - Postgres 本來就有交易與鎖（FOR UPDATE SKIP LOCKED）→ 足夠做最小可用的 worker
 *
 * 重要限制：
 * - background_jobs 這張表刻意不套 RLS（見 db/schema.sql 註解），讓 worker 可跨 org 掃 queued jobs
 * - 真正的業務資料仍由 RLS 保護（DbService.transactionWithOrg / query(...,{orgId})）
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { EnqueueExpireReadyHoldsJobInput } from './jobs.schemas';

export type BackgroundJobKind = 'holds.expire_ready';

export type BackgroundJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

export type BackgroundJobRow = {
  id: string;
  organization_id: string;
  kind: BackgroundJobKind;
  status: BackgroundJobStatus;
  payload: any;
  result: any | null;
  error: string | null;
  attempts: number;
  max_attempts: number;
  run_at: string;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type ClaimRow = BackgroundJobRow;

@Injectable()
export class JobsService {
  constructor(private readonly db: DbService) {}

  /**
   * enqueueExpireReadyHolds
   *
   * - 由 staff 觸發（actor_user_id 來自 token）
   * - 這個 job 會由 worker 執行 `holds.expireReady(mode=apply)`
   */
  async enqueueExpireReadyHolds(
    orgId: string,
    actorUserId: string,
    input: EnqueueExpireReadyHoldsJobInput,
  ): Promise<BackgroundJobRow> {
    const payload = {
      actor_user_id: actorUserId,
      as_of: input.as_of ?? null,
      limit: input.limit ?? null,
      note: input.note ?? null,
    };

    const result = await this.db.query<BackgroundJobRow>(
      `
      INSERT INTO background_jobs (organization_id, kind, payload)
      VALUES ($1, $2, $3::jsonb)
      RETURNING
        id,
        organization_id,
        kind,
        status,
        payload,
        result,
        error,
        attempts,
        max_attempts,
        run_at::text,
        locked_by,
        locked_at::text,
        created_at::text,
        updated_at::text,
        started_at::text,
        finished_at::text
      `,
      [orgId, 'holds.expire_ready', JSON.stringify(payload)],
    );

    return result.rows[0]!;
  }

  async getById(orgId: string, jobId: string): Promise<BackgroundJobRow> {
    const result = await this.db.query<BackgroundJobRow>(
      `
      SELECT
        id,
        organization_id,
        kind,
        status,
        payload,
        result,
        error,
        attempts,
        max_attempts,
        run_at::text,
        locked_by,
        locked_at::text,
        created_at::text,
        updated_at::text,
        started_at::text,
        finished_at::text
      FROM background_jobs
      WHERE organization_id = $1
        AND id = $2
      `,
      [orgId, jobId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Job not found' },
      });
    }

    return result.rows[0]!;
  }

  /**
   * claimNext
   *
   * worker 用：從 queue 裡 claim 一個「可執行」的 job。
   *
   * 使用 `FOR UPDATE SKIP LOCKED` 的好處：
   * - 允許多個 worker 並行（水平擴充）
   * - 同一筆 job 不會被兩個 worker 同時拿到
   */
  async claimNext(workerId: string): Promise<ClaimRow | null> {
    return await this.db.transaction(async (client) => {
      const result = await client.query<ClaimRow>(
        `
        WITH next AS (
          SELECT id
          FROM background_jobs
          WHERE status = 'queued'::background_job_status
            AND run_at <= now()
            AND attempts < max_attempts
          ORDER BY run_at ASC, created_at ASC, id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE background_jobs j
        SET
          status = 'running'::background_job_status,
          attempts = j.attempts + 1,
          locked_by = $1,
          locked_at = now(),
          started_at = COALESCE(j.started_at, now()),
          updated_at = now()
        FROM next
        WHERE j.id = next.id
        RETURNING
          j.id,
          j.organization_id,
          j.kind,
          j.status,
          j.payload,
          j.result,
          j.error,
          j.attempts,
          j.max_attempts,
          j.run_at::text,
          j.locked_by,
          j.locked_at::text,
          j.created_at::text,
          j.updated_at::text,
          j.started_at::text,
          j.finished_at::text
        `,
        [workerId],
      );

      return result.rows[0] ?? null;
    });
  }

  async markSucceeded(jobId: string, resultPayload: unknown): Promise<void> {
    await this.db.query(
      `
      UPDATE background_jobs
      SET
        status = 'succeeded'::background_job_status,
        result = $2::jsonb,
        error = NULL,
        finished_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [jobId, JSON.stringify(resultPayload ?? null)],
    );
  }

  async markFailed(jobId: string, message: string): Promise<void> {
    // error 欄位只存「可顯示的摘要」，避免把 stack trace/敏感資訊灌進 DB。
    const normalized = (message ?? '').trim().slice(0, 2000);

    await this.db.query(
      `
      UPDATE background_jobs
      SET
        status = 'failed'::background_job_status,
        error = $2,
        finished_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [jobId, normalized || 'Job failed'],
    );
  }

  /**
   * requirePayloadField（小工具）
   *
   * - job.payload 是 jsonb，型別是 unknown
   * - 這裡用 runtime check 把「壞 payload」提早變成可診斷的錯
   */
  requirePayloadString(payload: any, key: string): string {
    const v = payload?.[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    throw new Error(`Invalid job payload: missing ${key}`);
  }

  parseOptionalInt(payload: any, key: string): number | undefined {
    const v = payload?.[key];
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Math.trunc(Number(v));
    throw new Error(`Invalid job payload: ${key} must be number`);
  }

  parseOptionalString(payload: any, key: string): string | undefined {
    const v = payload?.[key];
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'string' && v.trim()) return v.trim();
    throw new Error(`Invalid job payload: ${key} must be string`);
  }
}
