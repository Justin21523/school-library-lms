import type { Response, TestInfo } from '@playwright/test';

import { test, expect } from './support/fixtures';
import { E2E } from './support/env';
import { saveFullPageScreenshot } from './support/page';

/**
 * MARC21 編輯器（MARC extras + authority quick create）
 *
 * 你選的是「B) 常用欄位完整 + 可擴充」：
 * - 表單欄位（title/subjects/term_ids...）是治理真相來源
 * - marc_extras 用來承載「表單未覆蓋」但現場常見的 MARC 欄位（例如 246/500/520/856/650...）
 *
 * 因此這支測試的驗證重點是：
 * 1) 哨兵書目可被搜尋與選取（大量資料下仍可用）
 * 2) marc_extras 可以載入（GET /bibs/:id/marc-extras）
 * 3) 可新增欄位（650）並用 authority helper「新增款目並套用」
 *    - 期望：650 變成 term-based（$0=urn:uuid:<term_id> + $2=vocabulary_code）
 * 4) marc_extras 儲存後可再載回（PUT → GET round-trip）
 *
 * 中間產物（可回溯）：
 * - 會 attach：GET/PUT marc-extras、POST authority-terms 的 response。
 */

const SENTINEL_TITLE = '【E2E】預約/借還流程測試書（請勿刪除）';

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

function mustFindMarcField(extras: any[], tag: string) {
  const hit = extras.find((f) => f && typeof f === 'object' && String(f.tag) === tag) ?? null;
  expect(hit, `marc_extras 應包含 tag=${tag}`).toBeTruthy();
  return hit;
}

test.describe('MARC21 Editor（authority quick create）', () => {
  test.use({ storageState: E2E.staffStorageStatePath });

  test('load marc_extras → add 650 → quick create term → save → reload', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/bibs/marc-editor`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'MARC21 編輯器' })).toBeVisible();

    // 1) 找到哨兵書目（用 query 降低列表量，避免點錯）
    await page.locator('#marc_bib_query').fill('E2E');
    await page.getByRole('button', { name: '搜尋/重新整理' }).click();
    await expect(page.getByText(SENTINEL_TITLE)).toBeVisible();

    // DataTable row 在 marc-editor 這頁是 clickable，因此 <tr role="button">：
    // - 用 role selector 比 getByText 更穩（避免同頁其他區塊也出現相同文字造成 strict mode）
    await page.getByRole('button', { name: new RegExp(SENTINEL_TITLE) }).click();

    // 2) 載入 marc_extras（GET）
    const loadExtrasResPromise = page.waitForResponse((res) => {
      const url = res.url();
      return res.request().method() === 'GET' && url.includes('/bibs/') && url.endsWith('/marc-extras');
    });
    await page.getByRole('button', { name: '載入 marc_extras' }).click();
    const loadExtrasRes = await loadExtrasResPromise;
    await attachApiResponse(testInfo, '01-marc-extras-get.json', loadExtrasRes);

    await expect(page.getByText('已載入 marc_extras')).toBeVisible();

    // 3) 從 UI 的「檢視 marc_extras JSON」讀回目前 extras（比逐個 selector 找 field 更穩）
    const extrasDetails = page.locator('details').filter({ hasText: '檢視 marc_extras JSON' });
    await extrasDetails.locator('summary').click();
    const extrasTextarea = extrasDetails.locator('textarea');
    await expect(extrasTextarea).toBeVisible();
    const initialExtras = JSON.parse(await extrasTextarea.inputValue());

    expect(Array.isArray(initialExtras), 'marc_extras 應該是一個陣列（MarcField[]）').toBeTruthy();
    mustFindMarcField(initialExtras, '246');
    mustFindMarcField(initialExtras, '500');
    mustFindMarcField(initialExtras, '520');
    mustFindMarcField(initialExtras, '856');

    // 4) 新增一個 650（主題詞欄位），並用 authority helper「新增款目並套用」
    //
    // 注意：我們刻意用「每次都不一樣」的 label，讓測試可以在同一個 DB 上重跑而不會撞到 unique constraint。
    const uniqueLabel = `E2E 主題詞 ${Date.now()}`;

    await page.getByLabel('新增欄位（tag）').fill('650');
    // 注意：同頁面會有「新增 subfield」等按鈕；這裡用 exact 避免誤點。
    await page.getByRole('button', { name: '新增', exact: true }).click();

    const field650TagInput = page.locator('input[value="650"]').first();
    await expect(field650TagInput).toBeVisible();

    // 用「650 那個 callout」當 scope，避免同頁其他按鈕/輸入混在一起
    const field650Callout = field650TagInput.locator('xpath=ancestor::div[contains(@class,"callout")]').first();
    await field650Callout.getByRole('button', { name: '搜尋/連結' }).click();

    // authority helper 的輸入沒有 label，因此用 placeholder 鎖定（避免 strict mode）
    await field650Callout
      .getByPlaceholder('輸入關鍵字（例：汰舊 / 台灣 / 少年小說）')
      .fill(uniqueLabel);

    const createTermResPromise = page.waitForResponse((res) => {
      const url = res.url();
      return res.request().method() === 'POST' && url.includes('/api/v1/orgs/') && url.endsWith('/authority-terms');
    });
    await field650Callout.getByRole('button', { name: '新增款目並套用' }).click();
    const createTermRes = await createTermResPromise;
    await attachApiResponse(testInfo, '02-authority-term-create.json', createTermRes);

    // 套用後應看到 $0=urn:uuid:... 與 $2=local（vocabulary_code 空白預設 local）
    // 同一個 callout 內可能同時顯示多個 code（例如 $0 的值 + 其他提示），用 first() 避免 strict mode
    await expect(field650Callout.getByText('urn:uuid:').first()).toBeVisible();
    await expect(field650Callout.getByText('$2：')).toBeVisible();
    await expect(field650Callout.getByText('local').first()).toBeVisible();

    // 5) 儲存 marc_extras（PUT）
    const saveExtrasResPromise = page.waitForResponse((res) => {
      const url = res.url();
      return res.request().method() === 'PUT' && url.includes('/bibs/') && url.endsWith('/marc-extras');
    });
    await page.getByRole('button', { name: '儲存 marc_extras' }).click();
    const saveExtrasRes = await saveExtrasResPromise;
    await attachApiResponse(testInfo, '03-marc-extras-put.json', saveExtrasRes);
    await expect(page.getByText('已儲存 marc_extras')).toBeVisible();

    // 6) 再載一次（GET）驗證 round-trip（避免「看起來有改，其實沒存」）
    const reloadExtrasResPromise = page.waitForResponse((res) => {
      const url = res.url();
      return res.request().method() === 'GET' && url.includes('/bibs/') && url.endsWith('/marc-extras');
    });
    // 第一次載入後，頁面會把 btnSmall 改成「重新載入 marc_extras」（避免同頁面出現兩個同名按鈕造成 strict mode）
    await page.getByRole('button', { name: '重新載入 marc_extras' }).click();
    const reloadExtrasRes = await reloadExtrasResPromise;
    await attachApiResponse(testInfo, '04-marc-extras-get-after-save.json', reloadExtrasRes);

    const reloadedExtras = JSON.parse(await extrasTextarea.inputValue());
    expect(Array.isArray(reloadedExtras)).toBeTruthy();

    // 應包含我們剛新增的 650（且 subfields 內有 $a=uniqueLabel、$0 urn、$2 local）
    const field650 = mustFindMarcField(reloadedExtras, '650');
    const subfields = Array.isArray((field650 as any).subfields) ? (field650 as any).subfields : [];
    const a = subfields.find((sf: any) => sf && sf.code === 'a')?.value ?? null;
    const zero = subfields.find((sf: any) => sf && sf.code === '0')?.value ?? '';
    const two = subfields.find((sf: any) => sf && sf.code === '2')?.value ?? '';
    expect(a, '650$a 應等於我們的 quick create label').toBe(uniqueLabel);
    expect(String(zero), '650$0 應該是 urn:uuid:<term_id> 形式').toMatch(/^urn:uuid:/i);
    expect(String(two), '650$2 應等於 vocabulary_code（預設 local）').toBe('local');

    await saveFullPageScreenshot(page, testInfo, 'marc-editor-authority-linking.png');
  });
});
