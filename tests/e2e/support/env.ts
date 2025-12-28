/**
 * E2E 測試用的 env 讀取（集中管理）
 *
 * 為什麼要集中？
 * - E2E 會同時牽涉：
 *   - Web base URL（Playwright 要開哪個網站）
 *   - API base URL（Node 端要去哪裡查 orgId / 做輔助驗證）
 *   - 以及「docker network vs host」的差異（見 E2E_API_PROXY_TARGET）
 *
 * 把 env 集中在一個檔案，能避免：
 * - 每個 spec 檔案都各自 hardcode default
 * - 變數命名不一致造成的排錯時間
 */

function envStr(name: string, fallback: string) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : String(raw);
  return value.trim();
}

export const E2E = {
  // 測試目標 org（我們主要用 Scale seed 的 org：demo-lms-scale）
  orgCode: envStr('E2E_ORG_CODE', 'demo-lms-scale'),

  // Node 端打 API 用的 base（docker 內通常用 http://api:3001；host 上通常用 http://localhost:3001）
  apiBaseUrl: envStr('E2E_API_BASE_URL', 'http://localhost:3001'),

  /**
   * 瀏覽器端 API proxy 目標（可選）
   *
   * 背景問題：
   * - Web client bundle 的 API base 預設是 http://localhost:3001（NEXT_PUBLIC_API_BASE_URL）
   * - 若 Playwright 在 docker network 內跑：
   *   - 瀏覽器的 localhost 指向 Playwright 容器本身
   *   - 會造成 Web 打 API 失敗
   *
   * 解法：
   * - 讓測試端把 `http://localhost:3001/*` 重寫到你指定的目標（例如 http://api:3001）
   *
   * 若你在 host 跑 Playwright：
   * - 通常不需要設這個（留空即可）
   */
  apiProxyTarget: envStr('E2E_API_PROXY_TARGET', ''),

  // Staff（Web Console）登入
  staffExternalId: envStr('E2E_STAFF_EXTERNAL_ID', 'A0001'),
  staffPassword: envStr('E2E_STAFF_PASSWORD', 'demo1234'),

  // Patron（OPAC）登入
  patronExternalId: envStr('E2E_PATRON_EXTERNAL_ID', 'S1130123'),
  patronPassword: envStr('E2E_PATRON_PASSWORD', 'demo1234'),

  // storageState 路徑：global-setup 會產生，spec 會讀取
  staffStorageStatePath: envStr('E2E_STAFF_STORAGE_STATE', 'test-results/playwright/.auth/staff.json'),
  patronStorageStatePath: envStr('E2E_PATRON_STORAGE_STATE', 'test-results/playwright/.auth/patron.json'),
};

