import { test, expect } from './support/fixtures';
import { saveFullPageScreenshot } from './support/page';

test('Organizations 列表可找到 Scale org，並可進入 Dashboard', async ({ page, org }, testInfo) => {
  // 1) /orgs：Web Console 入口（不需要登入）
  await page.goto('/orgs', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();

  // 2) 列表應包含我們的 Scale org（以名稱 link 作為入口）
  // - 注意：列表 render 依賴 API；若 API 打不通，這裡會卡住或出現錯誤
  const orgLink = page.getByRole('link', { name: org.name });
  await expect(orgLink).toBeVisible();

  // 3) 點進 org dashboard
  await Promise.all([
    page.waitForURL(new RegExp(`/orgs/${org.id}$`), { timeout: 30_000 }),
    orgLink.click(),
  ]);

  await expect(page.getByRole('heading', { name: 'Organization Dashboard' })).toBeVisible();
  await expect(page.getByText(org.name)).toBeVisible();
  await expect(page.getByText(org.code ?? '(no code)')).toBeVisible();

  // 4) 截圖：方便你回顧 UI（成功也保留一張）
  await saveFullPageScreenshot(page, testInfo, 'org-dashboard.png');
});

