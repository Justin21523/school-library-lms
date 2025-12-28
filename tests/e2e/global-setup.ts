/**
 * Playwright global setup：建立「已登入」的 storageState
 *
 * 為什麼要做 storageState？
 * - Web Console / OPAC 都採用 localStorage 保存 Bearer token
 * - 若每個測試都重跑一次登入，會：
 *   1) 變慢（大量頁面都要先登入）
 *   2) 更容易 flaky（登入頁 + redirect + localStorage timing）
 *
 * 因此我們在 global setup 先做一次登入，保存成 storageState 檔：
 * - staff：test-results/playwright/.auth/staff.json
 * - patron：test-results/playwright/.auth/patron.json
 *
 * 然後 spec 檔案用 `test.use({ storageState })` 直接復用。
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium, type FullConfig } from '@playwright/test';

import { getOrgByCode } from './support/api';
import { E2E } from './support/env';
import { installApiProxyIfNeeded } from './support/page';

function webBaseUrlFromEnv() {
  const v = process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3000';
  return String(v).trim();
}

async function ensureParentDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export default async function globalSetup(_config: FullConfig) {
  // 0) 先準備輸出路徑（避免寫檔失敗）
  await ensureParentDir(E2E.staffStorageStatePath);
  await ensureParentDir(E2E.patronStorageStatePath);

  // 1) 找到 target org（用 code 找 UUID）
  const org = await getOrgByCode();

  // 2) 啟動瀏覽器（headless；由 docker/CI 控制時不需要 GUI）
  const browser = await chromium.launch();

  try {
    const webBase = webBaseUrlFromEnv();

    // 3) 寫入 run context（給報告彙整/除錯用）
    // - 這能讓你在看 QA 報告時知道：
    //   - 測試當下的 baseUrl / orgId / orgCode
    //   - 以及是否啟用 apiProxy（docker network 內常見）
    await fs.writeFile(
      'test-results/playwright/run-context.json',
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          web_base_url: webBase,
          api_base_url: E2E.apiBaseUrl,
          api_proxy_target: E2E.apiProxyTarget || null,
          org,
          staff_external_id: E2E.staffExternalId,
          patron_external_id: E2E.patronExternalId,
        },
        null,
        2,
      ),
      'utf-8',
    );

    // ----------------------------
    // A) Staff login（Web Console）
    // ----------------------------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installApiProxyIfNeeded(page);

      await page.goto(`${webBase}/orgs/${org.id}/login`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('external_id（員編）').fill(E2E.staffExternalId);
      await page.getByLabel('password').fill(E2E.staffPassword);

      await Promise.all([
        // 登入後會 setTimeout(300ms) 導回 dashboard；我們用 waitForURL 等待跳轉。
        page.waitForURL(new RegExp(`/orgs/${org.id}$`), { timeout: 30_000 }),
        page.getByRole('button', { name: '登入' }).click(),
      ]);

      // 基本 sanity：確保 dashboard 的主標題出現（代表頁面真的渲染起來）
      await page.getByRole('heading', { name: 'Organization Dashboard' }).waitFor({ timeout: 30_000 });

      await context.storageState({ path: E2E.staffStorageStatePath });
      await context.close();
    }

    // ----------------------------
    // B) Patron login（OPAC）
    // ----------------------------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installApiProxyIfNeeded(page);

      await page.goto(`${webBase}/opac/orgs/${org.id}/login`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('external_id（學號/員編）').fill(E2E.patronExternalId);
      await page.getByLabel('password').fill(E2E.patronPassword);

      await Promise.all([
        page.waitForURL(new RegExp(`/opac/orgs/${org.id}$`), { timeout: 30_000 }),
        page.getByRole('button', { name: '登入' }).click(),
      ]);

      await page.getByRole('heading', { name: 'OPAC：搜尋與預約' }).waitFor({ timeout: 30_000 });

      await context.storageState({ path: E2E.patronStorageStatePath });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
