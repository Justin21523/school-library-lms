/**
 * Playwright fixtures（共用前置/後置）
 *
 * 我們在這裡做兩件事：
 * 1) 提供 org fixture：讓每個測試都能拿到 orgId（避免 hardcode UUID）
 * 2) 統一安裝 page hooks：
 *    - API proxy（docker network 內重寫 localhost:3001 → api:3001）
 *    - diagnostics（console error / pageerror / requestfailed）
 *
 * 這樣每個 spec 檔案就能專注在「測什麼頁面/流程」，
 * 而不用重複寫一堆 setup 樣板碼。
 */

import { test as base, expect } from '@playwright/test';

import type { OrgInfo } from './api';
import { getOrgByCode } from './api';
import type { PageDiagnostics } from './page';
import { installApiProxyIfNeeded, startDiagnostics, stopDiagnosticsAndAttach } from './page';

export type Fixtures = {
  org: OrgInfo;
  diag: PageDiagnostics;
};

export const test = base.extend<Fixtures>({
  // org：每個測試都可直接用 org.id
  org: async ({}, use) => {
    const org = await getOrgByCode();
    await use(org);
  },

  // diag：每個測試都會自動收集，並在測試結束時附加到報告
  //
  // 關鍵：這個 fixture 必須是「auto」，原因是：
  // - 我們需要在每個測試開始前就安裝 API proxy（docker network 內的 localhost 重寫）
  // - 若 fixture 不是 auto，只有在 test function 解構出 `{ diag }` 時才會執行
  //   → 很容易某個測試漏寫 diag，導致整個頁面打不到 API（Failed to fetch）
  diag: [
    async ({ page }, use, testInfo) => {
      await installApiProxyIfNeeded(page);
      const diag = startDiagnostics(page);
      await use(diag);
      await stopDiagnosticsAndAttach(page, testInfo, diag);
    },
    { auto: true },
  ],
});

export { expect };
