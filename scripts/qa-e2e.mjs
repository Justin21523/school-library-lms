/**
 * QA Runner（Docker + Scale seed + Playwright）
 *
 * 你想要的「完整自動化測試系統」最重要的是：
 * - 一鍵可重現（環境、資料、測試流程）
 * - 產出可追溯紀錄（報告、截圖、錯誤線索）
 *
 * 這支腳本負責把整個流程串起來：
 * 1) 啟動 Docker 全棧（postgres/redis/api/web）
 * 2) 匯入 Scale seed（大量假資料，demo-lms-scale）
 * 3) 在 Docker network 內跑 Playwright（真瀏覽器 E2E）
 * 4) 產出 QA summary（Markdown）
 *
 * 使用方式：
 * - `npm run qa:e2e`
 *
 * 產出位置：
 * - `playwright-report/index.html`（HTML report）
 * - `test-results/playwright/report.json`（JSON report）
 * - `test-results/playwright/qa-summary.md`（人眼可掃描）
 *
 * 注意：
 * - 這裡預設以 Docker 內的 Playwright runner 跑（避免你在 host 裝瀏覽器/系統依賴）
 * - 若你要在 host 跑：可直接用 `npm run e2e`（需自行 `npx playwright install`）
 */

import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await main();

async function main() {
  // 0) 覆蓋輸出：每次 QA 都從乾淨狀態開始
  //
  // 你提到 test-results 曾經不見/被清掉，因此這裡採「可重建、可覆蓋」策略：
  // - 先刪掉舊的 `test-results/playwright/` 與 `playwright-report/`
  // - 再重新建立必要資料夾（尤其是 .auth）
  //
  // 這樣可以確保：
  // - 本次結果不會跟舊 run 混在一起（避免誤判）
  // - 你看到的就是「最新一次完整測試」的所有產物
  await fs.rm('test-results/playwright', { recursive: true, force: true });
  await fs.rm('playwright-report', { recursive: true, force: true });

  // 1) 先確保輸出資料夾存在（避免 docker bind mount 建資料夾時變成 root-owned）
  await fs.mkdir('test-results/playwright/.auth', { recursive: true });
  await fs.mkdir('playwright-report', { recursive: true });

  // 2) up：啟動全棧（必要時會 build）
  // 注意：Playwright 在 docker network 內跑時，Web bundle 內的 `NEXT_PUBLIC_API_BASE_URL`
  // 可能會被 getApiBaseUrl() 改寫成 `${pageHost}:3001`（pageHost 在 e2e 會是 `web`）。
  //
  // 我們已在 Playwright 的 Page 層加了 API proxy（`tests/e2e/support/page.ts`）：
  // - 任何 `*/api/v1/*` 都會被重寫到 `http://api:3001`
  // 因此 QA 不需要把 web image build 成 `http://api:3001`（避免讓你在 host 瀏覽器開 http://localhost:3000 時壞掉）。
  const qaEnv = {
    NEXT_PUBLIC_API_BASE_URL: process.env.QA_NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
  };

  runDockerCompose(['up', '-d', '--build', 'postgres', 'redis', 'api', 'web'], qaEnv);

  // 3) build seed-scale：確保你改到 seed 腳本/字典/假資料規則時，QA 會用到最新版本
  // - `docker compose run` 不一定會自動 rebuild（尤其 image 已存在時）
  runDockerCompose(['--profile', 'scale', 'build', 'seed-scale'], qaEnv);

  // 4) seed：灌 Scale dataset（可重複；會刪掉同 org_code 再重建）
  runDockerCompose(['--profile', 'scale', 'run', '--rm', 'seed-scale'], qaEnv);

  // 5) build e2e runner：確保 Playwright image/依賴版本最新
  // - `docker compose run` 不一定會自動 rebuild（尤其你只改了 Dockerfile/測試碼時）
  runDockerCompose(['--profile', 'e2e', 'build', 'e2e'], qaEnv);

  // 6) e2e：跑 Playwright（真瀏覽器）
  //
  // 注意：E2E 失敗是「有價值的輸出」（代表找到問題）。
  // - 因此我們允許這一步失敗但仍繼續產出 qa-summary（方便你立刻閱讀/追查）。
  const e2eExit = runDockerComposeAllowFailure(['--profile', 'e2e', 'run', '--rm', 'e2e'], qaEnv);

  // 7) summary：把 JSON report 彙整成 Markdown（方便快速掃描）
  const result = spawnSync('node', ['scripts/qa-summarize-playwright.mjs'], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`qa summarize failed (exit=${result.status ?? 'null'})`);

  console.log('');
  console.log('[qa] ✅ 完成');
  console.log('[qa] - HTML report：playwright-report/index.html');
  console.log('[qa] - QA summary：test-results/playwright/qa-summary.md');
  console.log('[qa] - Raw results：test-results/playwright/');

  // 8) 若 E2E 失敗，最後才用非 0 exit 結束（讓 CI/腳本能判斷失敗）
  if (e2eExit !== 0) {
    throw new Error(`[qa] E2E failed (exit=${e2eExit}) — 請查看 playwright-report/index.html`);
  }
}

function runDockerCompose(args, envOverride) {
  console.log(`[qa] $ docker compose ${args.join(' ')}`);
  const result = spawnSync('docker', ['compose', ...args], {
    stdio: 'inherit',
    env: envOverride ? { ...process.env, ...envOverride } : process.env,
  });
  if (result.status !== 0) throw new Error(`docker compose failed (exit=${result.status ?? 'null'})`);
}

function runDockerComposeAllowFailure(args, envOverride) {
  console.log(`[qa] $ docker compose ${args.join(' ')}`);
  const result = spawnSync('docker', ['compose', ...args], {
    stdio: 'inherit',
    env: envOverride ? { ...process.env, ...envOverride } : process.env,
  });
  if (result.status !== 0) {
    console.warn(`[qa] ⚠️ 這一步失敗但會繼續（exit=${result.status ?? 'null'}）`);
  }
  return result.status ?? 1;
}
