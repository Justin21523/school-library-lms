/**
 * Maintenance Runner（每日例行作業：expire-ready / purge-history）
 *
 * 目標：
 * - 把目前「只能手動在 Web UI 點」的維運端點，做成可自動化執行的腳本
 * - 讓你可以用 cron（host）或 docker compose profile（container）定期跑：
 *   - holds：到書未取（ready_until 過期）→ expired（並釋放/轉派冊）
 *   - loans：借閱歷史保存期限（刪除已歸還且過久的 loans；高風險、需謹慎）
 *
 * 安全策略（預設偏保守）：
 * - expire-ready：預設 mode=apply（因為它是「日常例行」且主要做狀態轉移）
 * - purge-history：預設 mode=preview（因為它是不可逆刪除；要 apply 請明確開啟）
 *
 * 使用方式（Node 20+；Node 內建 fetch）：
 * - `node scripts/maintenance-daily.mjs`
 * - 或搭配 docker compose：`docker compose --profile maintenance run --rm maintenance`
 *
 * 參數來源（優先順序：CLI > env > default）：
 * - `--apiBase=http://localhost:3001`（或 docker 內用 http://api:3001）
 * - `--orgCode=demo-lms-scale`
 * - `--adminExternalId=A0001`
 * - `--adminPassword=demo1234`
 *
 * env 對應：
 * - `MAINTENANCE_API_BASE_URL`
 * - `MAINTENANCE_ORG_CODE`
 * - `MAINTENANCE_ADMIN_EXTERNAL_ID`
 * - `MAINTENANCE_ADMIN_PASSWORD`
 *
 * 工作開關（env）：
 * - `MAINTENANCE_EXPIRE_READY_MODE=apply|preview`（預設 apply）
 * - `MAINTENANCE_EXPIRE_READY_LIMIT=200`
 * - `MAINTENANCE_PURGE_HISTORY_MODE=preview|apply`（預設 preview）
 * - `MAINTENANCE_PURGE_HISTORY_RETENTION_DAYS=365`
 * - `MAINTENANCE_PURGE_HISTORY_LIMIT=500`
 * - `MAINTENANCE_PURGE_HISTORY_INCLUDE_AUDIT_EVENTS=false`
 */

await main();

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const apiBase = normalizeBaseUrl(
    (args.apiBase ?? process.env.MAINTENANCE_API_BASE_URL ?? 'http://localhost:3001').trim(),
  );

  const orgCode = (args.orgCode ?? process.env.MAINTENANCE_ORG_CODE ?? 'demo-lms-scale').trim();

  const adminExternalId = (args.adminExternalId ?? process.env.MAINTENANCE_ADMIN_EXTERNAL_ID ?? 'A0001').trim();
  const adminPassword = (args.adminPassword ?? process.env.MAINTENANCE_ADMIN_PASSWORD ?? 'demo1234').trim();

  // expire-ready（每日例行）：預設 apply
  const expireReadyMode = normalizeEnum(process.env.MAINTENANCE_EXPIRE_READY_MODE ?? 'apply', ['preview', 'apply']);
  const expireReadyLimit = parseIntEnv(process.env.MAINTENANCE_EXPIRE_READY_LIMIT ?? '200', 200);

  // purge-history（高風險刪除）：預設 preview（要 apply 請明確開）
  const purgeMode = normalizeEnum(process.env.MAINTENANCE_PURGE_HISTORY_MODE ?? 'preview', ['preview', 'apply']);
  const purgeRetentionDays = parseIntEnv(process.env.MAINTENANCE_PURGE_HISTORY_RETENTION_DAYS ?? '365', 365);
  const purgeLimit = parseIntEnv(process.env.MAINTENANCE_PURGE_HISTORY_LIMIT ?? '500', 500);
  const purgeIncludeAudit = parseBoolEnv(process.env.MAINTENANCE_PURGE_HISTORY_INCLUDE_AUDIT_EVENTS ?? 'false');

  console.log('');
  console.log('[maintenance] API base:', apiBase);
  console.log('[maintenance] orgCode:', orgCode);

  // 1) 找 orgId（以 code 定位；避免 id 不固定）
  const orgs = await fetchJson(`${apiBase}/api/v1/orgs`);
  assert(Array.isArray(orgs), 'GET /api/v1/orgs must return an array');

  const org = orgs.find((o) => o && typeof o === 'object' && o.code === orgCode) ?? null;
  assert(org && typeof org.id === 'string', `org not found by code=${orgCode}`);

  const orgId = org.id;
  console.log('[maintenance] orgId:', orgId);

  // 2) staff login（拿 token + user id）
  const login = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/auth/login`, {
    method: 'POST',
    body: { external_id: adminExternalId, password: adminPassword },
  });
  assert(typeof login?.access_token === 'string', 'staff login must return access_token');
  assert(typeof login?.user?.id === 'string', 'staff login must return user.id');

  const token = login.access_token;
  const actorUserId = login.user.id;
  console.log(`[maintenance] ✅ login: ${login.user.external_id} (${login.user.role}) actor_user_id=${actorUserId}`);

  // 3) holds：expire-ready
  console.log('');
  console.log('[maintenance] holds.expire_ready: preview');

  const expirePreview = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/holds/expire-ready`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: {
      actor_user_id: actorUserId,
      mode: 'preview',
      limit: expireReadyLimit,
      note: 'maintenance runner (daily)',
    },
  });

  console.log(
    `[maintenance] holds.expire_ready preview: candidates_total=${expirePreview?.candidates_total ?? '??'} limit=${expirePreview?.limit ?? '??'} as_of=${expirePreview?.as_of ?? '??'}`,
  );

  if (expireReadyMode === 'apply') {
    console.log('[maintenance] holds.expire_ready: apply');
    const expireApply = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/holds/expire-ready`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: {
        actor_user_id: actorUserId,
        mode: 'apply',
        limit: expireReadyLimit,
        note: 'maintenance runner (daily)',
      },
    });

    const s = expireApply?.summary ?? null;
    console.log(
      `[maintenance] ✅ holds.expire_ready apply: processed=${s?.processed ?? '??'} transferred=${s?.transferred ?? '??'} released=${s?.released ?? '??'} skipped_item_action=${s?.skipped_item_action ?? '??'}`,
    );
  } else {
    console.log('[maintenance] holds.expire_ready: skip apply (mode=preview)');
  }

  // 4) loans：purge-history（預設 preview；高風險）
  console.log('');
  console.log(`[maintenance] loans.purge_history: ${purgeMode}`);

  const purge = await fetchJson(`${apiBase}/api/v1/orgs/${orgId}/loans/purge-history`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: {
      actor_user_id: actorUserId,
      mode: purgeMode,
      retention_days: purgeRetentionDays,
      limit: purgeLimit,
      include_audit_events: purgeIncludeAudit,
      note: 'maintenance runner (daily)',
    },
  });

  if (purgeMode === 'preview') {
    console.log(
      `[maintenance] loans.purge_history preview: candidates_total=${purge?.candidates_total ?? '??'} retention_days=${purge?.retention_days ?? purgeRetentionDays} cutoff=${purge?.cutoff ?? '??'} limit=${purge?.limit ?? '??'}`,
    );
  } else {
    const s = purge?.summary ?? null;
    console.log(
      `[maintenance] ✅ loans.purge_history apply: deleted_loans=${s?.deleted_loans ?? '??'} deleted_audit_events=${s?.deleted_audit_events ?? '??'} audit_event_id=${purge?.audit_event_id ?? 'null'}`,
    );
  }

  console.log('');
  console.log('[maintenance] ✅ 完成');
}

// ----------------------------
// helpers（極簡，不引入外部依賴）
// ----------------------------

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    const trimmed = String(raw).trim();
    if (!trimmed.startsWith('--')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(2, eq);
    const value = trimmed.slice(eq + 1);
    out[key] = value;
  }
  return out;
}

function normalizeEnum(value, allowed) {
  const trimmed = String(value ?? '').trim();
  if (allowed.includes(trimmed)) return trimmed;
  throw new Error(`Invalid value: ${trimmed} (allowed: ${allowed.join(', ')})`);
}

function normalizeBaseUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new Error('apiBase is required');
  // 移除尾巴的 /，避免組 URL 時出現 //api/v1/...
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function parseIntEnv(value, fallback) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return fallback;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function parseBoolEnv(value) {
  const trimmed = String(value ?? '').trim().toLowerCase();
  return trimmed === '1' || trimmed === 'true' || trimmed === 'yes' || trimmed === 'y';
}

async function fetchJson(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'content-type': 'application/json',
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  const json = safeJsonParse(text);

  if (!res.ok) {
    // 盡量把後端錯誤印出來（通常是 { error: { code, message } }）
    const detail = json ?? text;
    throw new Error(`HTTP ${res.status} ${url}\n${typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)}`);
  }

  return json;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

