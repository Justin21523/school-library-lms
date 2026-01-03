import type { Response, TestInfo } from '@playwright/test';

import { test, expect } from './support/fixtures';
import { E2E } from './support/env';
import { saveFullPageScreenshot } from './support/page';

/**
 * Authority Thesaurus（BT/NT/RT + expand）
 *
 * 你要的不是「只有主檔能建」而已，而是：
 * - 有可用的 thesaurus 關係（BT/NT/RT）
 * - 並且能用 expand API 做「檢索擴充」的預覽（之後可用於 OPAC 搜尋/推薦）
 *
 * Scale seed 會固定建立一組 deterministic 關係（見 scripts/seed-scale.py）：
 * - 媒體識讀  → broader → 資訊素養
 * - 資訊倫理  → broader → 資訊素養
 *
 * 因此本測試以「資訊素養」為 root，驗證：
 * 1) term detail 的 NT 清單至少包含：媒體識讀、資訊倫理
 * 2) expand result（JSON）也包含這兩個 label（代表 API + UI 串接正常）
 */

async function attachApiResponse(testInfo: TestInfo, filename: string, res: Response) {
  const meta = { url: res.url(), method: res.request().method(), status: res.status() };
  try {
    const json = await res.json();
    await testInfo.attach(filename, {
      body: JSON.stringify({ ...meta, json }, null, 2),
      contentType: 'application/json',
    });
    return { ...meta, json };
  } catch {
    const text = await res.text();
    await testInfo.attach(filename, {
      body: JSON.stringify({ ...meta, text }, null, 2),
      contentType: 'application/json',
    });
    return { ...meta, text };
  }
}

test.describe('Authority Thesaurus（expand / BT-NT）', () => {
  test.use({ storageState: E2E.staffStorageStatePath });

  test('資訊素養：NT + expand 結果包含「媒體識讀」「資訊倫理」', async ({ page, org }, testInfo) => {
    // 1) 先從 terms list 找到「資訊素養」並進入 detail
    await page.goto(`/orgs/${org.id}/authority-terms`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Authority Terms' })).toBeVisible();

    // 避免撞到 local/web-ui 新增的款目：限定 builtin-zh（seed-scale 的內建詞彙庫）
    await page.locator('#authority_kind').selectOption('subject');
    await page.locator('#authority_vocab').fill('builtin-zh');
    await page.locator('#authority_query').fill('資訊素養');

    // filters 變更後會自動 refresh；等列表 link 出現即可。
    const termLink = page.getByRole('link', { name: '資訊素養' }).first();
    await expect(termLink).toBeVisible();

    await Promise.all([
      page.waitForURL(new RegExp(`/orgs/${org.id}/authority-terms/`), { timeout: 30_000 }),
      termLink.click(),
    ]);

    // 2) detail page：關係清單（NT）應包含 seed 建好的兩筆
    await expect(page.getByRole('heading', { name: '資訊素養' })).toBeVisible();
    // 這頁同時會列出 usage（書目清單），可能出現「書名含媒體識讀」等連結，
    // 因此把 selector 鎖定在「關係（BT/NT/RT）」區塊，避免 strict mode。
    const relationsPanel = page.locator('section.panel').filter({ hasText: '關係（BT/NT/RT）' }).first();
    await expect(relationsPanel.getByRole('link', { name: '媒體識讀', exact: true })).toBeVisible();
    await expect(relationsPanel.getByRole('link', { name: '資訊倫理', exact: true })).toBeVisible();

    // 3) expand preview：按下後抓 API response，並驗證 JSON 也包含兩個 label
    const expandResPromise = page.waitForResponse((res) => {
      const url = res.url();
      return res.request().method() === 'GET' && url.includes('/authority-terms/') && url.includes('/expand');
    });
    await page.getByRole('button', { name: '執行 expand', exact: true }).click();
    const expandRes = await expandResPromise;
    await attachApiResponse(testInfo, 'authority-expand.json', expandRes);

    await expect(page.getByText('已展開：labels=')).toBeVisible();

    const expandDetails = page.locator('details').filter({ hasText: 'expand result（JSON）' });
    const pre = expandDetails.locator('pre');
    await expect(pre).toBeVisible();
    const expandJsonText = await pre.innerText();
    const expand = JSON.parse(expandJsonText);

    const labels = Array.isArray(expand?.labels) ? expand.labels.map((x: any) => String(x)) : [];
    expect(labels, 'expand.labels 應包含 NT 兩筆（媒體識讀、資訊倫理）').toEqual(expect.arrayContaining(['媒體識讀', '資訊倫理']));

    await saveFullPageScreenshot(page, testInfo, 'authority-thesaurus-expand.png');
  });
});
