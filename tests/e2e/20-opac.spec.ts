import { test, expect } from './support/fixtures';
import { E2E } from './support/env';
import { saveFullPageScreenshot } from './support/page';

/**
 * OPAC（讀者端）驗證重點：
 * - 能登入（Patron token 存到 localStorage）
 * - 能載入 locations（取書地點）
 * - 能搜尋書目（大量資料下仍能 render）
 * - /me/*（我的借閱/我的預約）頁面可正常打 API（PatronAuthGuard）
 */

test.describe('OPAC（Scale org）', () => {
  test.use({ storageState: E2E.patronStorageStatePath });

  const SENTINEL_TITLE = '【E2E】預約/借還流程測試書（請勿刪除）';
  const UNAVAILABLE_TITLE = '【E2E】全部借出（不可借）測試書（請勿刪除）';

  test('OPAC 主頁可載入，並可搜尋書目', async ({ page, org }, testInfo) => {
    await page.goto(`/opac/orgs/${org.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'OPAC：搜尋與預約' })).toBeVisible();

    // 已登入提示（代表 Patron session 生效）
    //
    // 注意：此頁面同時在「OPAC Session 區塊」與「主內容提示文字」各顯示一次已登入資訊，
    // 直接用 getByText('已登入：') 會觸發 strict mode violation（匹配到多個元素）。
    // 因此我們把檢查限定在具名 region（OPAC Session）內，並順手確認 Logout link 存在。
    const sessionRegion = page.getByRole('region', { name: 'OPAC Session' });
    await expect(sessionRegion.getByText('已登入：')).toBeVisible();
    await expect(sessionRegion.getByRole('link', { name: 'Logout' })).toBeVisible();

    // 選一個取書地點（避免「未選擇」導致 place hold 等功能無法測）
    // - option[0] 是（請選擇）；所以我們選 index=1
    const pickup = page.getByLabel('取書地點（pickup location）');
    const firstRealValue = await pickup.locator('option').nth(1).getAttribute('value');
    expect(firstRealValue, 'pickup location 應至少有一個可用選項').toBeTruthy();
    await pickup.selectOption(firstRealValue ?? '');

    // 直接送出搜尋（query 留空代表「最新/預設列表」）
    await page.getByRole('button', { name: '搜尋' }).click();

    // 成功載入後應該至少看到一筆資料列（DataTable）
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'title' })).toBeVisible();
    await expect(table.locator('tbody tr').first()).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'opac-search.png');
  });

  test('OPAC 進階搜尋（must + search_fields）可命中哨兵書目', async ({ page, org }, testInfo) => {
    await page.goto(`/opac/orgs/${org.id}`, { waitUntil: 'domcontentloaded' });

    // 必要前置：選一個取書地點（避免「未選擇」導致後續預約流程不可用）
    const pickup = page.getByLabel('取書地點（pickup location）');
    const firstRealValue = await pickup.locator('option').nth(1).getAttribute('value');
    expect(firstRealValue, 'pickup location 應至少有一個可用選項').toBeTruthy();
    await pickup.selectOption(firstRealValue ?? '');

    // 進階搜尋：用 must 限定必須包含「【E2E】」
    await page.getByLabel('must（AND：每行一個 term）').fill('【E2E】');
    await page.getByRole('button', { name: '搜尋' }).click();

    await expect(page.getByText(SENTINEL_TITLE)).toBeVisible();
    await saveFullPageScreenshot(page, testInfo, 'opac-advanced-search.png');
  });

  test('OPAC available_only 可排除「全部不可借」的哨兵書目', async ({ page, org }, testInfo) => {
    await page.goto(`/opac/orgs/${org.id}`, { waitUntil: 'domcontentloaded' });

    // 前置：選一個取書地點（避免後續預約流程不可用）
    const pickup = page.getByLabel('取書地點（pickup location）');
    const firstRealValue = await pickup.locator('option').nth(1).getAttribute('value');
    expect(firstRealValue, 'pickup location 應至少有一個可用選項').toBeTruthy();
    await pickup.selectOption(firstRealValue ?? '');

    // 先確認「不可借哨兵」在未套用 available_only 時可被搜尋到（作為 baseline）
    await page.getByLabel('query（關鍵字）').fill(UNAVAILABLE_TITLE);
    await page.getByRole('button', { name: '搜尋' }).click();
    await expect(page.getByRole('table').getByText(UNAVAILABLE_TITLE)).toBeVisible({ timeout: 30_000 });

    // 套用 available_only 後，同一個 query 應該被排除（因為它只有 1 冊且預設為 checked_out）
    await page.getByLabel('available_only（只顯示可借）').check();
    await page.getByRole('button', { name: '搜尋' }).click();
    await expect(page.getByText('沒有符合條件的書目')).toBeVisible({ timeout: 30_000 });

    await saveFullPageScreenshot(page, testInfo, 'opac-available-only.png');
  });

  test('我的借閱 / 我的預約頁面可載入（/me/*）', async ({ page, org }, testInfo) => {
    await page.goto(`/opac/orgs/${org.id}/loans`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '我的借閱' })).toBeVisible();

    await page.goto(`/opac/orgs/${org.id}/holds`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '我的預約' })).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'opac-me.png');
  });
});
