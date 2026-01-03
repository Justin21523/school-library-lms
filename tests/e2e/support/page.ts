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
  /**
   * httpErrors：收集「有拿到 response 但 status >= 400」的 API 呼叫
   *
   * 為什麼 requestfailed 不夠？
   * - requestfailed 只代表「網路層」失敗（DNS/CORS/連線拒絕）
   * - 但很多真 bug 其實會回 4xx/5xx（例如 validation/guard/DB error），UI 可能吞掉或只顯示 toast
   *
   * 因此我們把 status>=400 的 API response 也收集起來，方便在 qa-summary 看「最常壞在哪些 endpoint」。
   */
  httpErrors: Array<{
    method: string;
    url: string;
    status: number;
    statusText?: string;
    /** bodySnippet：避免把整段 stack/HTML 塞爆報告，只保留前 N 字。 */
    bodySnippet?: string;
  }>;
};

export async function installApiProxyIfNeeded(page: Page) {
  // 若未指定 proxy target，就不做任何事（host 跑測試通常不需要）
  if (!E2E.apiProxyTarget) return;

  // 重寫「任何 host 的 /api/v1/*」到指定 target（例如 http://api:3001）
  //
  // 背景坑：
  // - Web 的 getApiBaseUrl() 會在「page 不是 localhost」時，把 env=localhost:3001 改成 `${pageHost}:3001`
  //   - 在 docker network 內，pageHost 會是 `web`
  //   - 若未特判，實際請求可能變成 `http://web:3001/api/v1/...`（但 API 不在 web:3001）
  //
  // 因此只重寫 localhost:3001 不夠，我們直接以 path 為準：
  // - 只要是 /api/v1/* 就導到 apiProxyTarget（保留 path/query）
  const target = new URL(E2E.apiProxyTarget);
  const targetOrigin = `${target.protocol}//${target.host}`;

  await page.route('**/api/v1/**', async (route) => {
    const original = route.request().url();

    try {
      const u = new URL(original);
      const origin = `${u.protocol}//${u.host}`;
      if (origin !== targetOrigin) {
        u.protocol = target.protocol;
        u.host = target.host;
      }
      await route.continue({ url: u.toString() });
    } catch {
      // 若 URL parse 失敗：保守起見不重寫（讓 diagnostics 記錄 requestfailed）
      await route.continue();
    }
  });
}

export function startDiagnostics(page: Page): PageDiagnostics {
  const diag: PageDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };

  // httpErrors 的 body 需要 async 讀取；我們把 pending promises 存起來，teardown 時再 await。
  const pendingHttpErrorReads: Promise<void>[] = [];

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

  // response：補齊「有回應但 status=4xx/5xx」的情境（通常是更常見的真 bug）
  //
  // 注意：我們只收集 /api/*，避免把 Next.js 靜態資源 404（favicon 等）當成雜訊。
  const onResponse = (res: any) => {
    const status = Number(res?.status?.() ?? 0);
    if (!Number.isFinite(status) || status < 400) return;

    const url = String(res?.url?.() ?? '');
    if (!url.includes('/api/')) return;

    // 避免爆量：若 API 完全壞掉，可能每個頁面都狂噴；先給一個上限（仍可在特定測試內自行 attach）。
    if (diag.httpErrors.length >= 80) return;

    const method = String(res?.request?.()?.method?.() ?? 'GET');
    const statusText = String(res?.statusText?.() ?? '');

    const readBody = Promise.resolve()
      .then(async () => {
        // Playwright 的 response.text() 可能 throw（例如 body 太大/非文字）；我們用 try/catch 保守處理。
        let text = '';
        try {
          text = await res.text();
        } catch {
          text = '';
        }

        const clipped = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200);
        diag.httpErrors.push({
          method,
          url,
          status,
          statusText: statusText || undefined,
          bodySnippet: clipped || undefined,
        });
      })
      .catch(() => {
        // ignore
      });

    pendingHttpErrorReads.push(readBody);
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  // 回傳 diag（讓 test 端能看到），同時把 listener 存到 page 上（方便 teardown）
  // - 我們不用 WeakMap，因為 Playwright 的 Page 生命週期短、且這裡僅用於測試。
  (page as any).__e2e_diag_listeners = { onConsole, onPageError, onRequestFailed, onResponse, pendingHttpErrorReads };
  return diag;
}

export async function stopDiagnosticsAndAttach(page: Page, testInfo: TestInfo, diag: PageDiagnostics) {
  const listeners = (page as any).__e2e_diag_listeners;
  if (listeners) {
    page.off('console', listeners.onConsole);
    page.off('pageerror', listeners.onPageError);
    page.off('requestfailed', listeners.onRequestFailed);
    page.off('response', listeners.onResponse);
  }

  // 確保 httpErrors 的 bodySnippet 都已讀取完（避免 teardown 太快導致漏記錄）
  try {
    await Promise.allSettled((listeners?.pendingHttpErrorReads as Promise<void>[] | undefined) ?? []);
  } catch {
    // ignore
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
  if (diag.httpErrors.length) {
    await testInfo.attach('http-errors.json', {
      body: JSON.stringify(diag.httpErrors, null, 2),
      contentType: 'application/json',
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
