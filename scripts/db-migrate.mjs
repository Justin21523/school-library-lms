#!/usr/bin/env node
/**
 * db-migrate.mjs
 *
 * 目的：把 `db/migrations/*.sql` 依檔名順序套用到資料庫，並用 `schema_migrations` 記錄已套用版本。
 *
 * 為什麼需要 migrations？
 * - `db/schema.sql` 很適合 demo/教學（可重複套用、容易閱讀）
 * - 但正式環境（上線/擴校）需要「可追溯的版本演進」：
 *   - 你要知道：哪一天加了哪個欄位/索引/constraint
 *   - 你要能：在不同環境（dev/staging/prod）重播同一份變更
 *
 * 設計取捨（刻意保持輕量）：
 * - 不引入 ORM 或額外 migration 套件（避免依賴/黑盒）
 * - 直接用現有的 `pg` driver 執行 SQL（可控、可讀、容易除錯）
 *
 * 使用方式：
 * - 建議：直接沿用 API 的 DATABASE_URL
 *   - `DATABASE_URL=postgresql://... node scripts/db-migrate.mjs`
 *
 * - 也支援 psql 慣用的 PG* env（方便 docker/CI）：
 *   - PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
 */

import fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';

import pgPkg from 'pg';

const { Client } = pgPkg;

function resolveRepoRoot() {
  // scripts/db-migrate.mjs -> repo root
  return path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
}

function loadDotEnvBestEffort(repoRoot) {
  // 讓 `npm run db:migrate` 可以直接吃 repo root `.env`（與 apps/api 行為一致）
  const require = createRequire(import.meta.url);
  let dotenv = null;
  try {
    dotenv = require('dotenv');
  } catch {
    dotenv = null;
  }
  if (!dotenv?.config) return;

  const envPath = path.join(repoRoot, '.env');
  if (!fsSync.existsSync(envPath)) return;
  dotenv.config({ path: envPath, override: false });
}

function getConnectionString() {
  // 1) 優先：DATABASE_URL（與 API 一致）
  const direct = (process.env.DATABASE_URL ?? '').trim();
  if (direct) return direct;

  // 2) 次選：PG*（與 psql 慣用）
  const host = (process.env.PGHOST ?? '').trim();
  const port = (process.env.PGPORT ?? '5432').trim();
  const user = (process.env.PGUSER ?? '').trim();
  const password = (process.env.PGPASSWORD ?? '').trim();
  const database = (process.env.PGDATABASE ?? '').trim();

  if (!host || !user || !database) return null;

  const u = new URL('postgresql://localhost');
  u.hostname = host;
  u.port = port || '5432';
  u.username = user;
  if (password) u.password = password;
  u.pathname = `/${database}`;
  return u.toString();
}

async function listMigrationFiles(migrationsDir) {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    // 以檔名排序＝版本順序（例如 0001_init.sql, 0002_add_index.sql, ...）
    .sort((a, b) => a.localeCompare(b));
}

async function ensureSchemaMigrationsTable(client) {
  // 放在 public schema：簡單、可預期；不與 org-scoped tables 混在一起。
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function loadAppliedMigrations(client) {
  const result = await client.query(`SELECT id FROM schema_migrations ORDER BY applied_at ASC;`);
  return new Set(result.rows.map((r) => String(r.id)));
}

async function applyMigrationFile(client, migrationsDir, filename) {
  const fullPath = path.join(migrationsDir, filename);
  const sql = await fs.readFile(fullPath, 'utf-8');

  // 我們用「單一交易」包住整個 migration：
  // - 成功：COMMIT + 記錄 schema_migrations
  // - 失敗：ROLLBACK（避免半套 schema）
  //
  // 注意：migration 檔內請不要再寫 BEGIN/COMMIT（避免巢狀交易的語意差異）。
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(`INSERT INTO schema_migrations (id) VALUES ($1);`, [filename]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const repoRoot = resolveRepoRoot();
  loadDotEnvBestEffort(repoRoot);
  const migrationsDir = path.join(repoRoot, 'db', 'migrations');

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      'Missing DB connection info: set DATABASE_URL, or set PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE',
    );
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureSchemaMigrationsTable(client);

    const applied = await loadAppliedMigrations(client);
    const files = await listMigrationFiles(migrationsDir);

    if (files.length === 0) {
      console.log('[db-migrate] no migrations found:', migrationsDir);
      return;
    }

    let appliedCount = 0;
    for (const filename of files) {
      if (applied.has(filename)) continue;
      console.log(`[db-migrate] applying ${filename}`);
      await applyMigrationFile(client, migrationsDir, filename);
      appliedCount += 1;
      console.log(`[db-migrate] applied  ${filename}`);
    }

    console.log(`[db-migrate] done (applied ${appliedCount} new migrations)`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[db-migrate] failed:', error?.message ?? error);
  process.exitCode = 1;
});
