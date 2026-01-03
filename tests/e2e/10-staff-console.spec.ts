import { test, expect } from './support/fixtures';
import { E2E } from './support/env';
import { saveFullPageScreenshot } from './support/page';

/**
 * Staff Web Console：核心頁面巡覽
 *
 * 覆蓋目標（先以 UI 完整性為主）：
 * - Dashboard / Users / Bibs / Items / Loans / Holds
 * - Reports（Overdue / Ready Holds / Top / Summary / Zero）
 * - Inventory / Audit Events
 *
 * 設計取捨：
 * - 我們先以「頁面能載入 + 能查到資料 + 不出現錯誤」為最低門檻
 * - 流程型（checkout/fulfill/maintenance 等）後續可再補「更像真實操作」的互動測試
 */

test.describe('Staff Web Console（Scale org）', () => {
  // global-setup 已產出 staff storageState（localStorage Bearer token）
  test.use({ storageState: E2E.staffStorageStatePath });

  test('Dashboard 可載入並顯示 org 資訊', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Organization Dashboard' })).toBeVisible();
    await expect(page.getByText(org.name)).toBeVisible();
    await saveFullPageScreenshot(page, testInfo, 'staff-dashboard.png');
  });

  test('Users 列表可載入（大量資料）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/users`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

    // 登入後應顯示「操作者（actor_user_id）」提示（代表 session 生效）
    await expect(page.getByRole('status').filter({ hasText: '操作者（actor_user_id）' })).toBeVisible();

    // 列表行的辨識字串（避免誤抓到 input label）
    //
    // 注意：大量資料下，這個字串會出現很多次（每筆 user 一次）；
    // 直接用 getByText(...) 會觸發 Playwright strict mode violation（匹配到多個元素）。
    // 因此我們只驗證「第一筆」可見即可，代表列表已成功 render。
    await expect(page.getByText('external_id=').first()).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'staff-users.png');
  });

  test('Bibs 列表可載入（大量資料）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/bibs`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Bibs' })).toBeVisible();
    // Bibs 列表已改為 DataTable：用「表格存在 + 至少一筆資料列」作為成功判斷
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'title' })).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();
    await saveFullPageScreenshot(page, testInfo, 'staff-bibs.png');
  });

  test('Items 列表可載入（大量資料）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/items`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'barcode' })).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();
    await saveFullPageScreenshot(page, testInfo, 'staff-items.png');
  });

  test('Loans 列表可載入（open loans）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/loans`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Loans' })).toBeVisible();

    // Loans 已改為 DataTable：確認 table 有資料列（seed-scale 應該會產生 open loans）
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'status' })).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();
    await saveFullPageScreenshot(page, testInfo, 'staff-loans.png');
  });

  test('Holds 列表可載入（ready/queued）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/holds`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Holds' })).toBeVisible();
    await expect(page.getByText('hold_id=').first()).toBeVisible();
    await saveFullPageScreenshot(page, testInfo, 'staff-holds.png');
  });

  test('Overdue Report 可查詢並回傳結果（或顯示 0 筆）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/reports/overdue`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Overdue Report' })).toBeVisible();

    // 同頁存在 topbar 的 Global Search「查詢」按鈕；需鎖定在 Content 區域避免 strict mode
    const content = page.getByLabel('Content');
    await content.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText('已載入逾期清單：')).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'staff-report-overdue.png');
  });

  test('Ready Holds Report 可查詢（含過期提示）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/reports/ready-holds`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Ready Holds' })).toBeVisible();

    const content = page.getByLabel('Content');
    await content.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText('已載入取書架清單：')).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'staff-report-ready-holds.png');
  });

  test('Top Circulation Report 可查詢（預設近 30 天）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/reports/top-circulation`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Top Circulation' })).toBeVisible();

    const content = page.getByLabel('Content');
    await content.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText('已載入熱門書排行：')).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'staff-report-top-circulation.png');
  });

  test('Circulation Summary Report 可查詢（day buckets）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/reports/circulation-summary`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Circulation Summary' })).toBeVisible();

    // 預設 group_by=day，因此直接查詢即可
    const content = page.getByLabel('Content');
    await content.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText('已載入借閱量彙總：')).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'staff-report-circulation-summary.png');
  });

  test('Zero Circulation Report 可查詢（預設近 180 天）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/reports/zero-circulation`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Zero Circulation' })).toBeVisible();

    const content = page.getByLabel('Content');
    await content.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText('已載入零借閱清單：')).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'staff-report-zero-circulation.png');
  });

  test('Inventory 工作台可載入（含 sessions 列表）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/inventory`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Inventory/ })).toBeVisible();

    // Inventory 頁會自動載入 sessions；成功時應至少看得到 session_id=...
    await expect(page.getByText('session_id=')).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'staff-inventory.png');
  });

  test('Audit Events 可載入（預設最近 7 天自動查詢）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/audit-events`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Audit Events' })).toBeVisible();

    // Audit 頁 useEffect 會自動 refresh；成功時會顯示 success message
    await expect(page.getByText('已載入稽核事件：')).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'staff-audit-events.png');
  });
});
