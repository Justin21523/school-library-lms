/**
 * DB integration tests（RLS）
 *
 * 目的：
 * - 在啟用 Postgres RLS（db/schema.sql）後，確保「忘了 set app.org_id」時真的會被 DB 擋下
 * - 確保「切換 app.org_id」會造成 row visibility 隔離（同一 DB user 也不能跨校）
 *
 * 執行方式：
 * - `DATABASE_URL=postgresql://... node --test tests/db/rls.test.mjs`
 * - 或提供 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE（psql 慣用）
 *
 * 注意：
 * - 這類測試需要 DB 已套用 schema（可用 db/schema.sql 或 migrations）
 * - 我們用 transaction + ROLLBACK，確保測試不污染資料庫
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import url from 'node:url';

import pgPkg from 'pg';

const { Client } = pgPkg;

function resolveRepoRoot() {
  return path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
}

async function loadDotEnvBestEffort() {
  // 測試通常由 `node --test` 直接跑，未必有先 source .env
  // 但本 repo 已有 dotenv（給 Next config 用），因此這裡 best-effort 載入 repo root `.env`，提升 DX。
  let dotenvModule = null;
  try {
    dotenvModule = await import('dotenv');
  } catch {
    dotenvModule = null;
  }

  // CJS interop：dotenv 多數情境是 CommonJS；ESM import 會落在 default。
  const dotenv = dotenvModule?.default ?? dotenvModule;
  if (!dotenv?.config) return;

  const repoRoot = resolveRepoRoot();
  dotenv.config({ path: path.join(repoRoot, '.env'), override: false });
}

function getConnectionString() {
  const direct = (process.env.DATABASE_URL ?? '').trim();
  if (direct) return direct;

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

async function withClient(fn) {
  await loadDotEnvBestEffort();

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL (or PGHOST/PGUSER/PGDATABASE ...) for DB integration tests');
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

test('RLS: org-scoped tables require app.org_id', async () => {
  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      const orgCodeA = `rls-test-a-${suffix}`;

      // organizations 不走 RLS：可在沒有 app.org_id 的情況下建立 org
      const orgA = await client.query(
        `INSERT INTO organizations (name, code) VALUES ($1, $2) RETURNING id`,
        ['RLS Test A', orgCodeA],
      );
      const orgIdA = orgA.rows[0]?.id ?? null;
      assert.ok(orgIdA, 'orgIdA should be returned');

      // 1) 沒有 app.org_id：SELECT 會回空集合（RLS USING 不匹配）
      await client.query(`SELECT set_config('app.org_id', '', true)`);
      const selectWithout = await client.query(
        `SELECT COUNT(*)::int AS count FROM locations WHERE organization_id = $1`,
        [orgIdA],
      );
      assert.equal(selectWithout.rows[0]?.count ?? -1, 0);

      // 2) 沒有 app.org_id：INSERT 會被 WITH CHECK 擋下（new row violates RLS policy）
      await assert.rejects(
        async () => {
          await client.query(
            `INSERT INTO locations (organization_id, code, name) VALUES ($1, $2, $3)`,
            [orgIdA, `LOC-${suffix}`, 'RLS 測試館別'],
          );
        },
        (err) => {
          // Postgres RLS violation 通常是 42501（insufficient_privilege）
          // 但不同版本/情境可能會有差異；我們至少要能辨識「被 RLS 擋住」而不是其他錯。
          const code = err?.code ?? '';
          const msg = String(err?.message ?? '');
          return code === '42501' || msg.includes('row-level security policy');
        },
      );

      // 3) 正確設定 app.org_id：INSERT/SELECT 應該成功
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgIdA]);
      await client.query(
        `INSERT INTO locations (organization_id, code, name) VALUES ($1, $2, $3)`,
        [orgIdA, `LOC-${suffix}`, 'RLS 測試館別'],
      );

      const selectWith = await client.query(
        `SELECT COUNT(*)::int AS count FROM locations WHERE organization_id = $1`,
        [orgIdA],
      );
      assert.equal(selectWith.rows[0]?.count ?? -1, 1);
    } finally {
      await client.query('ROLLBACK');
    }
  });
});

test('RLS: switching app.org_id isolates rows', async () => {
  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const suffix = crypto.randomUUID().slice(0, 8);
      const orgCodeA = `rls-test-a-${suffix}`;
      const orgCodeB = `rls-test-b-${suffix}`;

      const orgA = await client.query(
        `INSERT INTO organizations (name, code) VALUES ($1, $2) RETURNING id`,
        ['RLS Test A', orgCodeA],
      );
      const orgB = await client.query(
        `INSERT INTO organizations (name, code) VALUES ($1, $2) RETURNING id`,
        ['RLS Test B', orgCodeB],
      );
      const orgIdA = orgA.rows[0]?.id ?? null;
      const orgIdB = orgB.rows[0]?.id ?? null;
      assert.ok(orgIdA, 'orgIdA should be returned');
      assert.ok(orgIdB, 'orgIdB should be returned');

      // 插入 A 的 location
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgIdA]);
      await client.query(
        `INSERT INTO locations (organization_id, code, name) VALUES ($1, $2, $3)`,
        [orgIdA, `A-${suffix}`, 'A 校館別'],
      );

      // 插入 B 的 location
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgIdB]);
      await client.query(
        `INSERT INTO locations (organization_id, code, name) VALUES ($1, $2, $3)`,
        [orgIdB, `B-${suffix}`, 'B 校館別'],
      );

      // 切回 A：應只看得到 A 的 rows
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgIdA]);
      const aVisible = await client.query(
        `SELECT code FROM locations WHERE organization_id = $1 ORDER BY code ASC`,
        [orgIdA],
      );
      assert.deepEqual(aVisible.rows.map((r) => r.code), [`A-${suffix}`]);

      // 切到 B：應只看得到 B 的 rows
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgIdB]);
      const bVisible = await client.query(
        `SELECT code FROM locations WHERE organization_id = $1 ORDER BY code ASC`,
        [orgIdB],
      );
      assert.deepEqual(bVisible.rows.map((r) => r.code), [`B-${suffix}`]);
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
