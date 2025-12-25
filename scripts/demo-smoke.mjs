/**
 * Demo Smoke（E2E-ish）測試腳本
 *
 * 目標（對齊你的需求）：
 * 1) 用 `db/schema.sql` + `db/seed-demo.sql` 灌出「可測所有面板」的資料
 * 2) 啟動 API/Web（可選）
 * 3) 用 demo 帳密（demo1234）跑一輪核心查詢與 CSV 匯出，確認：
 *    - seed 是否真的讓 reports/holds/inventory/audit/loans 都「有資料可看」
 *    - staff/patron login 是否可用
 *    - 報表 CSV 是否包含 Excel 友善 BOM（\ufeff）
 *
 * 這不是 Playwright 那種「真瀏覽器」E2E：
 * - 我們不引入新依賴（不加 playwright）
 * - 改用「HTTP 層」驗證：後端回傳資料正確 → 前端頁面就能顯示/下載
 *
 * 使用方式（預設會 seed DB + 啟動 api/web）：
 * - `npm run demo:smoke`
 *
 * 可選參數（用 `--key=value`）：
 * - `--db=seed|reset|skip`（預設 seed）
 * - `--api=dev|skip`（預設 dev）
 * - `--web=dev|skip`（預設 dev；CI 建議用 skip）
 * - `--apiBase=http://localhost:3001`（預設 http://localhost:3001）
 * - `--webBase=http://localhost:3000`（預設 http://localhost:3000）
 * - `--orgCode=demo-lms-seed`（預設 demo-lms-seed）
 *
 * 注意：
 * - 這支腳本會啟動長駐進程（dev server），因此一定要做 clean up（finally kill）
 * - 若你只想測 HTTP（你自己已經啟動 api/web），可用：`--db=skip --api=skip --web=skip`
 */

import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

// ----------------------------
// 0) 參數解析（極簡，避免引入依賴）
// ----------------------------

const args = parseArgs(process.argv.slice(2));

const dbMode = normalizeEnum(args.db ?? 'seed', ['seed', 'reset', 'skip']);
const apiMode = normalizeEnum(args.api ?? 'dev', ['dev', 'skip']);
const webMode = normalizeEnum(args.web ?? 'dev', ['dev', 'skip']);

const apiBase = (args.apiBase ?? process.env.SMOKE_API_BASE_URL ?? 'http://localhost:3001').trim();
const webBase = (args.webBase ?? process.env.SMOKE_WEB_BASE_URL ?? 'http://localhost:3000').trim();

const orgCode = (args.orgCode ?? 'demo-lms-seed').trim();

// demo 帳密（可用 env 覆蓋，方便你改 seed 後仍可跑）
const demoPassword = (process.env.DEMO_PASSWORD ?? 'demo1234').trim();
const staffExternalId = (process.env.DEMO_STAFF_EXTERNAL_ID ?? 'L0001').trim();
const patronExternalId = (process.env.DEMO_PATRON_EXTERNAL_ID ?? 'S1130123').trim();

// API 需要的 DB 連線（本機 docker compose 的預設）
// - 若你不是用 docker compose（例如 CI service container），可用 env 覆蓋。
const databaseUrl =
  (process.env.DATABASE_URL ?? process.env.SMOKE_DATABASE_URL ?? '').trim() ||
  'postgresql://library:library@localhost:5432/library_system';

const redisUrl =
  (process.env.REDIS_URL ?? process.env.SMOKE_REDIS_URL ?? '').trim() || 'redis://localhost:6379';

// ----------------------------
// 1) 子進程管理：確保腳本結束時能把 dev servers 關掉
// ----------------------------

const children = [];

process.on('SIGINT', () => {
  // 使用者 Ctrl+C：也要把子進程清掉，避免背景一直佔 port。
  // - 注意：Node 的 SIGINT handler 不能 async，所以這裡只做 best effort。
  void cleanupChildren(children).finally(() => process.exit(130));
});

try {
  // ----------------------------
  // 2) DB：reset/seed（可選）
  // ----------------------------

  if (dbMode !== 'skip') {
    console.log('');
    console.log(`[demo-smoke] DB：${dbMode}（透過 scripts/demo-db.mjs）`);
    const result = spawnSync('node', ['scripts/demo-db.mjs', dbMode], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`[demo-smoke] demo-db failed (exit=${result.status ?? 'null'})`);
  } else {
    console.log('');
    console.log('[demo-smoke] DB：skip（假設你已經準備好資料庫）');
  }

  // ----------------------------
  // 3) API/Web：啟動（可選）
  // ----------------------------

  // 3.1 API
  if (apiMode !== 'skip') {
    // API 進程需要 DATABASE_URL；我們用 env 注入，避免要求你手動複製 .env。
    const apiEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      // API_PORT：從 apiBase 解析 port（確保一致）
      API_PORT: String(extractPortOrDefault(apiBase, 3001)),
    };

    // 我們用 workspace script（nest start --watch）：
    // - 優點：不需要先 build
    // - 缺點：較慢，但對 smoke 測試可接受
    const proc = spawn(resolveNpmCommand(), ['run', 'dev:api'], {
      stdio: 'inherit',
      env: apiEnv,
    });
    children.push({ name: 'api', proc });
  }

  // 3.2 Web
  if (webMode !== 'skip') {
    // Web（Next dev）通常不需要 env；但我們仍把 WEB_PORT 放進 env 方便你未來擴充。
    const webEnv = { ...process.env, WEB_PORT: String(extractPortOrDefault(webBase, 3000)) };
    const proc = spawn(resolveNpmCommand(), ['run', 'dev:web'], { stdio: 'inherit', env: webEnv });
    children.push({ name: 'web', proc });
  }

  // 3.3 等待 API/Web ready（避免「server 還沒起來」就開始打）
  // - 若 api/web 其中之一是 skip，我們就不等它
  if (apiMode !== 'skip') {
    console.log('');
    console.log(`[demo-smoke] 等待 API ready：${apiBase}/health`);
    await waitForHttpOk(`${apiBase}/health`, { timeoutMs: 120_000, intervalMs: 500 });
  }
  if (webMode !== 'skip') {
    console.log('');
    console.log(`[demo-smoke] 等待 Web ready：${webBase}/orgs`);
    await waitForHttpOk(`${webBase}/orgs`, { timeoutMs: 120_000, intervalMs: 500 });
  }

  // ----------------------------
  // 4) 實際 smoke：用 HTTP 驗證核心功能與資料可見性
  // ----------------------------

  console.log('');
  console.log('[demo-smoke] 開始 smoke：API/資料/CSV/登入…');

  // 4.1 health
  await assertHttpOk(`${apiBase}/health`);

  // 4.2 找到 demo org（用 code 定位，避免 id 不固定）
  const orgs = await fetchJson(`${apiBase}/api/v1/orgs`);
  assert(Array.isArray(orgs), 'GET /api/v1/orgs must return an array');

  const demoOrg = orgs.find((o) => o && typeof o === 'object' && o.code === orgCode) ?? null;
  assert(demoOrg && typeof demoOrg.id === 'string', `demo org not found by code=${orgCode}`);

  const orgId = demoOrg.id;
  console.log(`[demo-smoke] ✅ 找到 demo org：${demoOrg.name} (${demoOrg.code}) id=${orgId}`);

  // 4.3 staff login（拿到 Bearer token）
  const staffLogin = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/auth/login`, {
    method: 'POST',
    body: { external_id: staffExternalId, password: demoPassword },
  });

  assert(typeof staffLogin?.access_token === 'string', 'staff login must return access_token');
  assert(typeof staffLogin?.user?.id === 'string', 'staff login must return user.id');
  const staffToken = staffLogin.access_token;
  const staffUserId = staffLogin.user.id;
  console.log(`[demo-smoke] ✅ staff login：${staffLogin.user.external_id} (${staffLogin.user.role})`);

  // 4.4 patron login（OPAC account）
  const patronLogin = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/auth/patron-login`, {
    method: 'POST',
    body: { external_id: patronExternalId, password: demoPassword },
  });

  assert(typeof patronLogin?.access_token === 'string', 'patron login must return access_token');
  const patronToken = patronLogin.access_token;
  console.log(`[demo-smoke] ✅ patron login：${patronLogin.user.external_id} (${patronLogin.user.role})`);

  // 4.5 loans（open loans 必須有：逾期 + 可續借）
  const loans = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/loans?status=open&limit=200`, {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert(Array.isArray(loans), 'loans list must be an array');
  assert(loans.length >= 2, 'seed should include at least 2 open loans');

  const overdueLoan = loans.find((l) => l?.item_barcode === 'DEMO-HP-0002') ?? null;
  assert(overdueLoan, 'seed must include overdue loan for DEMO-HP-0002');

  const renewLoan = loans.find((l) => l?.item_barcode === 'DEMO-REN-0001') ?? null;
  assert(renewLoan, 'seed must include renewable loan for DEMO-REN-0001');

  // 4.6 renew：用 staff token + actor_user_id（必須等於 token.sub）
  const renewResult = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/circulation/renew`, {
    method: 'POST',
    headers: { authorization: `Bearer ${staffToken}` },
    body: { loan_id: renewLoan.id, actor_user_id: staffUserId },
  });
  assert(renewResult?.loan_id === renewLoan.id, 'renew result must echo loan_id');
  assert(typeof renewResult?.due_at === 'string', 'renew result must include due_at');
  console.log('[demo-smoke] ✅ renew OK（loan.renew）');

  // 4.7 reports：Overdue / Ready Holds / Top / Summary / Zero / Inventory-diff
  // - reports 全部受 StaffAuthGuard 保護
  // - query 仍要求 actor_user_id，且必須等於 token.sub

  // 4.7.1 overdue（json + csv）
  const overdueJson = await fetchJson(
    `${apiBase}/api/v1/orgs/${orgId}/reports/overdue?actor_user_id=${staffUserId}&format=json&limit=5000`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(Array.isArray(overdueJson), 'overdue report (json) must be an array');
  assert(overdueJson.some((r) => r?.item_barcode === 'DEMO-HP-0002'), 'overdue report must include DEMO-HP-0002');

  const overdueCsv = await fetchBytes(
    `${apiBase}/api/v1/orgs/${orgId}/reports/overdue?actor_user_id=${staffUserId}&format=csv&limit=5000`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(hasUtf8Bom(overdueCsv), 'overdue CSV must include UTF-8 BOM');

  // 4.7.2 ready-holds（json + csv）
  const readyHoldsJson = await fetchJson(
    `${apiBase}/api/v1/orgs/${orgId}/reports/ready-holds?actor_user_id=${staffUserId}&format=json&limit=5000`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(Array.isArray(readyHoldsJson), 'ready-holds (json) must be an array');
  assert(
    readyHoldsJson.some((r) => r?.assigned_item_barcode === 'DEMO-LP-0001'),
    'ready-holds must include DEMO-LP-0001',
  );

  const readyHoldsCsv = await fetchBytes(
    `${apiBase}/api/v1/orgs/${orgId}/reports/ready-holds?actor_user_id=${staffUserId}&format=csv&limit=5000`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(hasUtf8Bom(readyHoldsCsv), 'ready-holds CSV must include UTF-8 BOM');

  // 4.7.3 top-circulation（json + csv）
  const from = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date().toISOString();

  const topJson = await fetchJson(
    `${apiBase}/api/v1/orgs/${orgId}/reports/top-circulation?actor_user_id=${staffUserId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=json&limit=50`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(Array.isArray(topJson), 'top-circulation (json) must be an array');
  assert(topJson.length >= 1, 'top-circulation should have at least 1 row');

  const topCsv = await fetchBytes(
    `${apiBase}/api/v1/orgs/${orgId}/reports/top-circulation?actor_user_id=${staffUserId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=csv&limit=50`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(hasUtf8Bom(topCsv), 'top-circulation CSV must include UTF-8 BOM');

  // 4.7.4 circulation-summary（json + csv）
  const summaryJson = await fetchJson(
    `${apiBase}/api/v1/orgs/${orgId}/reports/circulation-summary?actor_user_id=${staffUserId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group_by=day&format=json`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(Array.isArray(summaryJson), 'circulation-summary (json) must be an array');

  const summaryCsv = await fetchBytes(
    `${apiBase}/api/v1/orgs/${orgId}/reports/circulation-summary?actor_user_id=${staffUserId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group_by=day&format=csv`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(hasUtf8Bom(summaryCsv), 'circulation-summary CSV must include UTF-8 BOM');

  // 4.7.5 zero-circulation（json + csv）
  const zeroJson = await fetchJson(
    `${apiBase}/api/v1/orgs/${orgId}/reports/zero-circulation?actor_user_id=${staffUserId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=json&limit=200`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(Array.isArray(zeroJson), 'zero-circulation (json) must be an array');
  assert(
    zeroJson.some((r) => typeof r?.bibliographic_title === 'string' && r.bibliographic_title.includes('Zero Circulation Demo')),
    'zero-circulation must include seeded "Zero Circulation Demo" title',
  );

  const zeroCsv = await fetchBytes(
    `${apiBase}/api/v1/orgs/${orgId}/reports/zero-circulation?actor_user_id=${staffUserId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=csv&limit=200`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(hasUtf8Bom(zeroCsv), 'zero-circulation CSV must include UTF-8 BOM');

  // 4.7.6 inventory-diff（先找一個已關閉 session，再打 reports/inventory-diff）
  const sessions = await fetchJson(
    `${apiBase}/api/v1/orgs/${orgId}/inventory/sessions?status=closed&limit=50`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(Array.isArray(sessions), 'inventory sessions must be an array');
  assert(sessions.length >= 1, 'seed should include at least 1 closed inventory session');

  const inventorySessionId = sessions[0].id;
  const invJson = await fetchJson(
    `${apiBase}/api/v1/orgs/${orgId}/reports/inventory-diff?actor_user_id=${staffUserId}&inventory_session_id=${inventorySessionId}&format=json&limit=5000`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(invJson && typeof invJson === 'object', 'inventory-diff (json) must be an object');
  assert(invJson.summary?.missing_count >= 1, 'inventory-diff must have missing_count >= 1 (seeded)');

  const invCsv = await fetchBytes(
    `${apiBase}/api/v1/orgs/${orgId}/reports/inventory-diff?actor_user_id=${staffUserId}&inventory_session_id=${inventorySessionId}&format=csv&limit=5000`,
    { headers: { authorization: `Bearer ${staffToken}` } },
  );
  assert(hasUtf8Bom(invCsv), 'inventory-diff CSV must include UTF-8 BOM');

  // 4.8 audit-events（seed 讓一進去就看得到）
  const auditEvents = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/audit-events?limit=50`, {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert(Array.isArray(auditEvents), 'audit-events must be an array');
  assert(auditEvents.length >= 1, 'seed should include at least 1 audit event');

  // 4.9 patron `/me/*`：確認 OPAC Account 可用、且資料是「本人」的
  const me = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/me`, {
    headers: { authorization: `Bearer ${patronToken}` },
  });
  assert(me?.external_id === patronExternalId, 'GET /me must return the authenticated patron');

  const myLoans = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/me/loans?status=open&limit=50`, {
    headers: { authorization: `Bearer ${patronToken}` },
  });
  assert(Array.isArray(myLoans), 'GET /me/loans must return an array');
  assert(myLoans.some((l) => l?.item_barcode === 'DEMO-REN-0001'), 'my loans should include DEMO-REN-0001');

  const myHolds = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/me/holds?status=ready&limit=50`, {
    headers: { authorization: `Bearer ${patronToken}` },
  });
  assert(Array.isArray(myHolds), 'GET /me/holds must return an array');
  assert(myHolds.some((h) => h?.assigned_item_barcode === 'DEMO-LP-0001'), 'my holds should include DEMO-LP-0001');

  // 4.10 Web routes（可選）：至少確認「路徑存在」與「基本標題可渲染」
  if (webMode !== 'skip') {
    const orgsHtml = await fetchText(`${webBase}/orgs`);
    assert(orgsHtml.includes('Organizations'), 'web /orgs should contain page title');

    const overdueHtml = await fetchText(`${webBase}/orgs/${orgId}/reports/overdue`);
    assert(overdueHtml.includes('Overdue Report'), 'web overdue page should contain heading');

    const auditHtml = await fetchText(`${webBase}/orgs/${orgId}/audit-events`);
    assert(auditHtml.includes('Audit Events'), 'web audit-events page should contain heading');

    console.log('[demo-smoke] ✅ Web routes OK（基本可渲染）');
  }

  console.log('');
  console.log('[demo-smoke] ✅ 全部 smoke checks 通過。');
} finally {
  // 無論成功或失敗，都要嘗試關閉子進程（避免佔 port/殘留背景程式）
  await cleanupChildren(children);
}

// ----------------------------
// HTTP helpers（不引入依賴，用 fetch 即可）
// ----------------------------

async function assertHttpOk(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP not OK: ${url} status=${res.status}`);
}

async function waitForHttpOk(url, { timeoutMs, intervalMs }) {
  const startedAt = Date.now();
  while (true) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // ignore network errors; retry
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timeout waiting for ${url}`);
    }
    await sleep(intervalMs);
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}\n${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON but got:\n${text}`);
  }
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, { method: options.method ?? 'GET', headers: options.headers ?? {} });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}\n${text}`);
  return text;
}

async function fetchBytes(url, options = {}) {
  const res = await fetch(url, { method: options.method ?? 'GET', headers: options.headers ?? {} });
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}\n${new TextDecoder().decode(buf)}`);
  return buf;
}

function hasUtf8Bom(bytes) {
  // UTF-8 BOM：EF BB BF
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

// ----------------------------
// process helpers
// ----------------------------

function resolveNpmCommand() {
  // Windows：npm 是 npm.cmd；Unix-like：npm
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function cleanupChildren(childrenList) {
  if (!childrenList || childrenList.length === 0) return;

  // 反向關閉：最後啟動的先關（避免 web 仍在打 api，但 api 已先關）
  for (let i = childrenList.length - 1; i >= 0; i -= 1) {
    const child = childrenList[i];
    const proc = child?.proc;
    if (!proc || !proc.pid) continue;

    // 若子進程已退出（例如啟動失敗），就不用再 kill。
    if (proc.exitCode !== null) continue;

    console.log(`[demo-smoke] 停止 ${child.name}（pid=${proc.pid}）…`);

    // 1) 先用 SIGINT（模擬你在 terminal 按 Ctrl+C）：對 dev server 最友善（會清理 watcher）
    safeKill(proc, 'SIGINT');
    if (await waitForExit(proc, 8000)) continue;

    // 2) SIGTERM：更強硬一點（仍屬於「正常終止」）
    safeKill(proc, 'SIGTERM');
    if (await waitForExit(proc, 4000)) continue;

    // 3) SIGKILL：最後手段（立即終止）
    safeKill(proc, 'SIGKILL');
    await waitForExit(proc, 2000);
  }
}

function safeKill(proc, signal) {
  try {
    proc.kill(signal);
  } catch {
    // ignore
  }
}

function waitForExit(proc, timeoutMs) {
  // 已退出：直接回 true
  if (proc.exitCode !== null) return Promise.resolve(true);

  // 尚未退出：掛一次性 listener + timeout
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };

    const timer = setTimeout(() => {
      proc.off('exit', onExit);
      resolve(false);
    }, timeoutMs);

    proc.once('exit', onExit);
  });
}

// ----------------------------
// misc helpers
// ----------------------------

function parseArgs(argv) {
  const map = {};
  for (const raw of argv) {
    const trimmed = String(raw).trim();
    if (!trimmed.startsWith('--')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      // 旗標型：`--foo` → true
      map[trimmed.slice(2)] = 'true';
      continue;
    }

    const key = trimmed.slice(2, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    map[key] = value;
  }
  return map;
}

function normalizeEnum(value, allowed) {
  const v = String(value ?? '').trim();
  if (allowed.includes(v)) return v;
  throw new Error(`Invalid option: ${v} (allowed: ${allowed.join(', ')})`);
}

function extractPortOrDefault(baseUrl, fallback) {
  try {
    const u = new URL(baseUrl);
    const port = u.port ? Number.parseInt(u.port, 10) : fallback;
    return Number.isFinite(port) ? port : fallback;
  } catch {
    return fallback;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`[demo-smoke] ASSERT FAILED: ${message}`);
}
