/**
 * Demo DB 工具（reset/seed）
 *
 * 這支腳本的定位：
 * - 讓你「一鍵」把本機 Docker Postgres/Redis 啟動起來
 * - 並把 `db/schema.sql` + `db/seed-demo.sql` 匯入資料庫
 *
 * 你會需要它的原因：
 * - 我們的功能面板（loans/holds/reports/inventory/audit/auth…）需要一套「完整關聯資料」才能驗證
 * - 手動建立資料太慢、也很難重現同一個狀態
 * - demo 時最怕「DB 被玩壞」→ reset 可以回到乾淨可預期的狀態
 *
 * 安全性提醒：
 * - `reset` 會執行 `docker compose down -v`，等同刪掉 postgres volume（資料全清空）
 * - 只建議用在本機開發/示範環境，請勿指向正式環境
 *
 * 使用方式：
 * - `node scripts/demo-db.mjs seed`  ：啟動 postgres/redis → 匯入 schema → 匯入 seed（不清空 volume）
 * - `node scripts/demo-db.mjs reset` ：down -v 清空 → up → 匯入 schema → 匯入 seed
 *
 * 對應 npm scripts（建議用）：
 * - `npm run demo:db:seed`
 * - `npm run demo:db:reset`
 */

import { spawnSync } from 'node:child_process';

// ----------------------------
// CLI 參數解析（極簡，不引入依賴）
// ----------------------------

const command = process.argv[2]?.trim() ?? '';

if (!command || (command !== 'seed' && command !== 'reset')) {
  printUsageAndExit(1);
}

// ----------------------------
// 可調參數（用 env 覆蓋，方便 CI/不同 compose 設定）
// ----------------------------

// compose：我們使用「docker compose」子命令（新版 docker plugin）。
// - 這裡不支援舊版 `docker-compose`，若你的環境是舊版可自行改成 docker-compose。
const composeServicePostgres = process.env.DEMO_PG_SERVICE?.trim() || 'postgres';
const composeServiceRedis = process.env.DEMO_REDIS_SERVICE?.trim() || 'redis';

// psql 連線參數：對齊 `docker-compose.yml` 的預設。
const pgUser = process.env.DEMO_PG_USER?.trim() || 'library';
const pgDb = process.env.DEMO_PG_DB?.trim() || 'library_system';

// 重要：schema/seed 匯入不是用 `docker compose exec postgres psql -f ...`
// 因為 postgres service 沒有把 repo 的 `./db` bind mount 進去（容器內看不到 host 的檔案）。
//
// 我們改用 docker-compose.yml 內的 `seed` 一次性 service：
// - 會把 `./db` mount 成 `/db:ro`
// - 直接在 seed container 內跑 `psql -f /db/schema.sql && psql -f /db/seed-demo.sql`
const composeServiceSeed = process.env.DEMO_SEED_SERVICE?.trim() || 'seed';

// ----------------------------
// 主流程
// ----------------------------

// 用 top-level await 的原因：
// - `.mjs` 可直接使用 top-level await（Node 14+）
// - 我們在 waitForPostgresReady 需要真正的 async sleep（避免 busy-wait 佔 CPU）
await main();

async function main() {
  if (command === 'reset') {
    // reset：清空 volume → 回到乾淨狀態
    // - 即使目前沒有 container/volume，down -v 也可能回傳非 0（例如沒東西可關）
    // - 我們採「最佳努力」：失敗仍繼續，避免第一次執行就被卡住
    runComposeAllowFailure(['down', '-v']);
  }

  // 1) up：啟動 postgres/redis（-d 背景執行）
  runCompose(['up', '-d', composeServicePostgres, composeServiceRedis]);

  // 2) 等 postgres ready：避免在啟動尚未完成時就跑 psql 造成 intermittent 失敗
  await waitForPostgresReady({
    service: composeServicePostgres,
    user: pgUser,
    db: pgDb,
    timeoutMs: 60_000,
  });

  // 3) 匯入 schema + seed（一次性 container）
  // - `--profile demo`：seed service 掛在 demo profile 底下，避免平常 up 時常駐
  // - `run --rm`：跑完就刪 container（可重複執行、乾淨）
  runCompose(['--profile', 'demo', 'run', '--rm', composeServiceSeed]);

  console.log('');
  console.log('[demo-db] ✅ 完成：schema + seed 已匯入。');
}

// ----------------------------
// helpers
// ----------------------------

function printUsageAndExit(code) {
  console.error('');
  console.error('用法：');
  console.error('  node scripts/demo-db.mjs seed');
  console.error('  node scripts/demo-db.mjs reset');
  console.error('');
  console.error('說明：');
  console.error('  seed  ：啟動 DB → 匯入 schema → 匯入 demo seed（不清空 volume）');
  console.error('  reset ：docker compose down -v（清空）→ 啟動 DB → 匯入 schema → 匯入 demo seed');
  console.error('');
  process.exit(code);
}

function runCompose(args) {
  console.log(`[demo-db] $ docker compose ${args.join(' ')}`);

  // spawnSync：因為我們希望「步驟順序」完全可預期（先 up 才能 exec psql）。
  const result = spawnSync('docker', ['compose', ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    // status=null 通常代表訊號中止；在這裡統一當成失敗處理。
    throw new Error(`docker compose failed (exit=${result.status ?? 'null'})`);
  }
}

function runComposeAllowFailure(args) {
  console.log(`[demo-db] $ docker compose ${args.join(' ')}`);
  const result = spawnSync('docker', ['compose', ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.warn(`[demo-db] ⚠️ 這一步失敗但會繼續（exit=${result.status ?? 'null'}）`);
  }
}

async function waitForPostgresReady({ service, user, db, timeoutMs }) {
  const startedAt = Date.now();
  const intervalMs = 1000;

  // 我們用 pg_isready（postgres image 內建）來做健康檢查：
  // - 優點：不用依賴本機安裝 psql/pg_isready
  // - 直接在 container 內跑，跟你後續的 `psql -f` 路徑一致
  while (true) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > timeoutMs) {
      throw new Error(`[demo-db] Postgres did not become ready within ${timeoutMs}ms`);
    }

    const result = spawnSync(
      'docker',
      ['compose', 'exec', '-T', service, 'pg_isready', '-U', user, '-d', db],
      { stdio: 'ignore' },
    );

    if (result.status === 0) {
      console.log('[demo-db] Postgres is ready.');
      return;
    }

    // 尚未 ready：等一下再試。
    await sleep(intervalMs);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
