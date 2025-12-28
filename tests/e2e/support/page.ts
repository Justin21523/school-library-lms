/**
 * Playwright Page 層的共用工具
 *
 * 1) API proxy（解決 docker network 內的 localhost 問題）
 * 2) 觀測/紀錄（console error / pageerror / requestfailed）
 * 3) 截圖（用於 UI 完整性回顧）
 */

import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

import { E2E } from './env';

export type PageDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
};

export async function installApiProxyIfNeeded(page: Page) {
  // 若未指定 proxy target，就不做任何事（host 跑測試通常不需要）
  if (!E2E.apiProxyTarget) return;

  // 只重寫 Web bundle 常見的 API base（localhost:3001）
  // - 這個 repo 的 Web client 預設用 NEXT_PUBLIC_API_BASE_URL（預設 http://localhost:3001）
  // - 在 docker network 內跑 Playwright 時，需要把它導到 http://api:3001
  await page.route('http://localhost:3001/**', async (route) => {
    const original = route.request().url();
    const rewritten = original.replace('http://localhost:3001', E2E.apiProxyTarget);
    await route.continue({ url: rewritten });
  });
}

export function startDiagnostics(page: Page): PageDiagnostics {
  const diag: PageDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
  };

  // console：只收集 error（warn/info 先不當成失敗，但可視需要擴充）
  const onConsole = (msg: any) => {
    if (msg?.type?.() !== 'error') return;
    diag.consoleErrors.push(msg.text());
  };

  // pageerror：通常代表未捕捉的 runtime error（應該視為嚴重問題）
  const onPageError = (err: any) => {
    diag.pageErrors.push(err?.stack || err?.message || String(err));
  };

  // requestfailed：用於追查「某頁空白/載不出資料」的根因（API 連不到、CORS、DNS…）
  const onRequestFailed = (req: any) => {
    const failure = req.failure?.();
    diag.requestFailures.push(
      `${req.method?.() ?? 'GET'} ${req.url?.() ?? '(unknown url)'} ${failure?.errorText ?? ''}`.trim(),
    );
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  // 回傳 diag（讓 test 端能看到），同時把 listener 存到 page 上（方便 teardown）
  // - 我們不用 WeakMap，因為 Playwright 的 Page 生命週期短、且這裡僅用於測試。
  (page as any).__e2e_diag_listeners = { onConsole, onPageError, onRequestFailed };
  return diag;
}

export async function stopDiagnosticsAndAttach(page: Page, testInfo: TestInfo, diag: PageDiagnostics) {
  const listeners = (page as any).__e2e_diag_listeners;
  if (listeners) {
    page.off('console', listeners.onConsole);
    page.off('pageerror', listeners.onPageError);
    page.off('requestfailed', listeners.onRequestFailed);
  }

  // 附加到報告：方便你在 HTML report 直接看到（不用翻 terminal logs）
  if (diag.consoleErrors.length) {
    await testInfo.attach('console-errors.txt', {
      body: diag.consoleErrors.join('\n\n'),
      contentType: 'text/plain',
    });
  }
  if (diag.requestFailures.length) {
    await testInfo.attach('request-failures.txt', {
      body: diag.requestFailures.join('\n'),
      contentType: 'text/plain',
    });
  }
  if (diag.pageErrors.length) {
    await testInfo.attach('page-errors.txt', {
      body: diag.pageErrors.join('\n\n'),
      contentType: 'text/plain',
    });
  }

  // pageerror 視為嚴重：直接讓測試失敗（這通常代表 UI 真的壞了，而不是「沒有資料」）
  expect(diag.pageErrors, '頁面不應出現未捕捉的 runtime error（pageerror）').toEqual([]);
}

export async function saveFullPageScreenshot(page: Page, testInfo: TestInfo, filename: string) {
  // 用 testInfo.outputPath：確保每個測試的輸出互不覆蓋
  const path = testInfo.outputPath(filename);
  await page.screenshot({ path, fullPage: true });

  // 同步 attach 到 HTML report：
  // - 你可以在 `playwright-report/index.html` 直接點開看截圖（不用自己去檔案系統找）
  // - 因為是「測試驗證輸出」，我們保留在 testInfo.outputPath 對應的資料夾中
  await testInfo.attach(filename, { path, contentType: 'image/png' });
  return path;
}
