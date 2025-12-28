/**
 * Playwright 設定（UI E2E / 真瀏覽器）
 *
 * 本 repo 的 E2E 目標是「驗證 UI 完整性」而不是「只測 API」：
 * - 走真瀏覽器（Chromium）把 Next.js Web Console / OPAC 的主要路由跑過一輪
 * - 產出可追溯的紀錄（HTML report / JSON report / failure trace / screenshots）
 * - 讓你能更快回答：
 *   1) 目前哪些頁面是正常的？
 *   2) 哪些流程在大量資料（Scale seed）下會變慢或壞掉？
 *   3) 若之後改 UI/API，哪裡出現 regression？
 *
 * 重要背景：目前 Web 端 API base 是 `NEXT_PUBLIC_API_BASE_URL`（預設 http://localhost:3001）
 * - 在「從 host 瀏覽器操作 docker compose」時這是正確的（localhost 走 port mapping）
 * - 但在「Playwright 跑在 Docker network 內」時，瀏覽器的 localhost 會變成 Playwright 容器本身
 *
 * 解法（不改動 app 架構的前提下）：
 * - 測試端用 `page.route` 把瀏覽器要打的 `http://localhost:3001/*` 重寫到 `E2E_API_PROXY_TARGET`
 * - 例如：在 docker compose 內設 `E2E_API_PROXY_TARGET=http://api:3001`
 */

import { defineConfig, devices } from '@playwright/test';

const webBaseUrl = (process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3000').trim();

export default defineConfig({
  // 測試檔案放在 repo root 的 tests/e2e，避免與 app workspace 混在一起。
  testDir: './tests/e2e',

  // 先做一次登入，產出 storageState（讓各測試更快、更穩）
  globalSetup: './tests/e2e/global-setup',

  // 單筆測試預設 timeout（UI 在 docker/大量資料下可能較慢，因此給較寬裕值）
  timeout: 60_000,

  // expect 等待時間（避免 flaky）
  expect: { timeout: 10_000 },

  // 初期先以「穩定」為優先：worker=1（避免同時開多頁造成 docker 內資源競爭）
  workers: 1,

  // CI 重跑策略：在 CI/自動化環境可考慮 retries=1（先保留介面）
  retries: process.env.CI ? 1 : 0,

  // 產出物：
  // - playwright-report：HTML 報告（可直接用瀏覽器打開）
  // - test-results/playwright/report.json：機器可讀（用於彙整成 QA summary）
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/playwright/report.json' }],
  ],

  // 原始輸出（screenshots/traces/videos）集中放在這裡
  outputDir: 'test-results/playwright',

  use: {
    // baseURL 讓你在 test 裡可用 `page.goto('/orgs')` 這種相對路徑
    baseURL: webBaseUrl,

    // UX：失敗才保留（避免大量檔案把 repo 撐爆）
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',

    // 導覽 timeout（大量資料頁面首次載入可能較慢）
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
