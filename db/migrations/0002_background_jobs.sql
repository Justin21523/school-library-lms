-- Migration: 0002_background_jobs
--
-- 目的：
-- - 落地最小可用的 background job 追蹤（先針對 maintenance/report/import 的「非同步化」鋪路）
--
-- 設計取捨：
-- - 此 migration 只建「可追蹤 + 可重試」的最小資料結構
-- - 真正的 queue/worker 可先用 Postgres table-based queue；未來也可替換成 BullMQ/Redis
-- - 我們刻意不對 background_jobs 啟用 RLS（原因見 db/schema.sql 同段註解）

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'background_job_status') THEN
    CREATE TYPE background_job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status background_job_status NOT NULL DEFAULT 'queued',

  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NULL,
  error text NULL,

  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,

  run_at timestamptz NOT NULL DEFAULT now(),
  locked_by text NULL,
  locked_at timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  finished_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS background_jobs_status_run_at
  ON background_jobs (status, run_at ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS background_jobs_org_created_at
  ON background_jobs (organization_id, created_at DESC);

