import type { Response, TestInfo } from '@playwright/test';

import { test, expect } from './support/fixtures';
import { E2E } from './support/env';
import { installApiProxyIfNeeded, saveFullPageScreenshot, startDiagnostics, stopDiagnosticsAndAttach } from './support/page';

/**
 * Circulation Workflow（端到端流程測試）
 *
 * 這支測試的定位是「真流程」而不是「頁面可載入」：
 * - Staff（館員）：
 *   1) checkout：把哨兵冊借給 T0001（讓 OPAC hold 變成 queued）
 *   2) checkin：歸還後觸發 hold ready（item_status 變成 on_hold）
 *   3) fulfill：掃條碼把 ready hold 取書借出給讀者（建立 loan）
 * - OPAC（讀者）：
 *   1) 搜尋哨兵書目
 *   2) place hold（/me/holds，PatronAuthGuard）
 *   3) 查看 holds 狀態 queued → ready
 *   4) 查看 loans：確認最終借閱成立
 *
 * 為什麼用「哨兵資料」？
 * - Scale seed 會產生上千筆 loans/holds；若我們用隨機書目，很容易遇到：
 *   - 這本書剛好沒冊 / 都已撤架 / 已被預約塞滿
 *   - 同一個條碼對到多筆 ready hold（資料不一致）→ UI 需要手動選擇
 * - 因此 seed-scale.py 會固定產生一筆「E2E 哨兵書目」與固定條碼：
 *   - title：SENTINEL_TITLE
 *   - item_barcode：SENTINEL_ITEM_BARCODE
 *
 * 中間產物（你要的「可回溯」）：
 * - 我們會把每一步的 API response attach 到 Playwright report：
 *   - checkout / placeHold / checkin / fulfill
 * - 失敗時你可以在 `playwright-report/index.html` 直接點開看 JSON，對照 UI 發生什麼事。
 */

const SENTINEL_TITLE = '【E2E】預約/借還流程測試書（請勿刪除）';
const SENTINEL_ITEM_BARCODE = 'SCL-00000001';

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

test.describe('Circulation Workflow（E2E sentinel）', () => {
  // 這支測試的「主 page」以 staff 身分操作（checkout/checkin/fulfill 都是 staff 行為）
  test.use({ storageState: E2E.staffStorageStatePath });

  test('checkout → OPAC hold(queued) → checkin(ready) → fulfill → OPAC loans', async ({ page, org, browser }, testInfo) => {
    // OPAC（讀者）需要另一個 context：
    // - storageState 不能在同一個 context 內「動態切換」
    // - 因此我們用 browser.newContext() 建一個 patron context，與 staff 分開。
    const patronContext = await browser.newContext({ storageState: E2E.patronStorageStatePath });
    const patronPage = await patronContext.newPage();

    // 重要：fixtures.ts 只會自動幫「主 page」安裝 proxy/diagnostics；
    // 這裡我們要手動對 patronPage 安裝（否則 docker network 內會打不到 API）。
    await installApiProxyIfNeeded(patronPage);
    const patronDiag = startDiagnostics(patronPage);

    try {
      // ----------------------------
      // Step 1) Staff：checkout 哨兵冊 → 讓 hold 之後變 queued
      // ----------------------------
      await page.goto(`/orgs/${org.id}/circulation`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Circulation' })).toBeVisible();

      // Staff circulation page 的 input label 有重複（checkout/checkin 都叫 item_barcode），
      // 因此 E2E 用固定 id selector 來避免 strict mode。
      await page.locator('#checkout_user_external_id').fill('T0001');
      await page.locator('#checkout_item_barcode').fill(SENTINEL_ITEM_BARCODE);

      const checkoutResPromise = page.waitForResponse((res) => {
        return (
          res.request().method() === 'POST' &&
          res.url().includes(`/api/v1/orgs/${org.id}/circulation/checkout`) &&
          res.status() >= 200
        );
      });

      // 注意：同頁面還有「取書借出」按鈕，會包含「借出」字樣；
      // 因此這裡用 exact 避免 Playwright 角色查詢匹配到多個元素。
      await page.getByRole('button', { name: '借出', exact: true }).click();
      const checkoutRes = await checkoutResPromise;
      await attachApiResponse(testInfo, '01-checkout.json', checkoutRes);

      await expect(page.getByText('Checkout 結果')).toBeVisible();
      await saveFullPageScreenshot(page, testInfo, '01-staff-checkout.png');

      // ----------------------------
      // Step 2) OPAC：搜尋哨兵書目 → place hold（預期 queued）
      // ----------------------------
      await patronPage.goto(`/opac/orgs/${org.id}`, { waitUntil: 'domcontentloaded' });
      await expect(patronPage.getByRole('heading', { name: 'OPAC：搜尋與預約' })).toBeVisible();

      // 取書地點：確保後續 place hold 不會因 pickup_location_id 為空而失敗。
      const pickup = patronPage.locator('#opac_pickup_location');
      const firstRealPickup = await pickup.locator('option').nth(1).getAttribute('value');
      expect(firstRealPickup, 'OPAC pickup location 應至少有一個 active 選項').toBeTruthy();
      await pickup.selectOption(firstRealPickup ?? '');

      await patronPage.locator('#opac_bib_query').fill('E2E');
      await patronPage.getByRole('button', { name: '搜尋' }).click();
      await expect(patronPage.getByText(SENTINEL_TITLE)).toBeVisible();

      // place hold：把 waitForResponse 綁在「點預約」之前（避免 race）
      const placeHoldResPromise = patronPage.waitForResponse((res) => {
        return (
          res.request().method() === 'POST' &&
          res.url().includes(`/api/v1/orgs/${org.id}/me/holds`) &&
          res.status() >= 200
        );
      });

      // DataTable 右側的 row action button（預約）很多；我們把 scope 限定在「哨兵書目那一列」。
      const sentinelRow = patronPage.getByRole('row', { name: new RegExp(SENTINEL_TITLE) });
      await sentinelRow.getByRole('button', { name: '預約' }).click();
      const placeHoldRes = await placeHoldResPromise;
      const placedHoldPayload = await attachApiResponse(testInfo, '02-opac-place-hold.json', placeHoldRes);

      await saveFullPageScreenshot(patronPage, testInfo, '02-opac-after-place-hold.png');

      // ----------------------------
      // Step 3) OPAC：我的預約（queued）
      // ----------------------------
      await patronPage.goto(`/opac/orgs/${org.id}/holds`, { waitUntil: 'domcontentloaded' });
      await expect(patronPage.getByRole('heading', { name: '我的預約' })).toBeVisible();

      // queued 篩選：降低資料量（seed-scale 預設會有大量 ready/queued holds）
      await patronPage.locator('#opac_holds_status').selectOption('queued');
      await patronPage.getByRole('button', { name: '查詢' }).click();

      // 基本驗證：哨兵書名出現在列表，且狀態 badge = queued
      // - DataTable 內的 badge 文字就是 status 本身（queued/ready...）
      const queuedRow = patronPage.getByRole('row', { name: new RegExp(SENTINEL_TITLE) });
      await expect(queuedRow.getByText('queued')).toBeVisible();
      await saveFullPageScreenshot(patronPage, testInfo, '03-opac-holds-queued.png');

      // ----------------------------
      // Step 4) Staff：checkin → 觸發 hold ready（item_status=on_hold）
      // ----------------------------
      await page.locator('#checkin_item_barcode').fill(SENTINEL_ITEM_BARCODE);

      const checkinResPromise = page.waitForResponse((res) => {
        return (
          res.request().method() === 'POST' &&
          res.url().includes(`/api/v1/orgs/${org.id}/circulation/checkin`) &&
          res.status() >= 200
        );
      });

      await page.getByRole('button', { name: '歸還', exact: true }).click();
      const checkinRes = await checkinResPromise;
      const checkinPayload = await attachApiResponse(testInfo, '04-checkin.json', checkinRes);

      await expect(page.getByText('Check-in 結果')).toBeVisible();
      await saveFullPageScreenshot(page, testInfo, '04-staff-checkin.png');

      // ----------------------------
      // Step 5) OPAC：我的預約（ready）
      // ----------------------------
      await patronPage.locator('#opac_holds_status').selectOption('ready');
      await patronPage.getByRole('button', { name: '查詢' }).click();

      const readyRow = patronPage.getByRole('row', { name: new RegExp(SENTINEL_TITLE) });
      await expect(readyRow.getByText('ready')).toBeVisible();
      await saveFullPageScreenshot(patronPage, testInfo, '05-opac-holds-ready.png');

      // ----------------------------
      // Step 6) Staff：fulfill（掃冊條碼）
      // ----------------------------
      await page.locator('#fulfill_item_barcode').fill(SENTINEL_ITEM_BARCODE);

      // fulfill 流程會先 GET ready holds（依 item_barcode），再 POST fulfill；
      // 我們只要抓最後的 fulfill response（含 loan_id）。
      const fulfillResPromise = page.waitForResponse((res) => {
        const url = res.url();
        return res.request().method() === 'POST' && url.includes('/holds/') && url.endsWith('/fulfill') && res.status() >= 200;
      });

      await page.getByRole('button', { name: '取書借出', exact: true }).click();
      const fulfillRes = await fulfillResPromise;
      await attachApiResponse(testInfo, '06-fulfill.json', fulfillRes);

      await expect(page.getByText('Fulfill 結果')).toBeVisible();
      await saveFullPageScreenshot(page, testInfo, '06-staff-fulfill.png');

      // ----------------------------
      // Step 7) OPAC：我的借閱（應看到哨兵冊）
      // ----------------------------
      await patronPage.goto(`/opac/orgs/${org.id}/loans`, { waitUntil: 'domcontentloaded' });
      await expect(patronPage.getByRole('heading', { name: '我的借閱' })).toBeVisible();

      // 強制 refresh（避免還停留在 useEffect 初次載入的舊結果）
      await patronPage.getByRole('button', { name: '查詢' }).click();

      // loans 列表中應包含哨兵書名 + 條碼
      const loanRow = patronPage.getByRole('row', { name: new RegExp(SENTINEL_TITLE) });
      await expect(loanRow.getByText(SENTINEL_ITEM_BARCODE)).toBeVisible();
      await saveFullPageScreenshot(patronPage, testInfo, '07-opac-loans.png');

      // ----------------------------
      // 便於除錯：把某些「關鍵 id」也 attach（方便你不用打開 report 就能快速看到）
      // ----------------------------
      await testInfo.attach('meta.txt', {
        body: [
          `sentinel_title=${SENTINEL_TITLE}`,
          `sentinel_item_barcode=${SENTINEL_ITEM_BARCODE}`,
          `place_hold_response_keys=${Object.keys((placedHoldPayload as any)?.json ?? (placedHoldPayload as any)?.text ?? {}).join(',') || '(n/a)'}`,
          `checkin_response_keys=${Object.keys((checkinPayload as any)?.json ?? (checkinPayload as any)?.text ?? {}).join(',') || '(n/a)'}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      // patronPage 的 diagnostics 需要手動 teardown；否則失敗時你會少掉一半線索。
      await stopDiagnosticsAndAttach(patronPage, testInfo, patronDiag);
      await patronContext.close();
    }
  });
});
