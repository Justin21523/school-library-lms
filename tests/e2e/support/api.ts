/**
 * Node 端輔助 API（給 E2E 測試用）
 *
 * 目的：
 * - UI 測試常需要「先知道 orgId」才能進入 /orgs/:orgId/...
 * - 但 orgId 是 UUID（由 DB 生成/seed 決定），不適合 hardcode 在測試裡
 *
 * 因此我們在測試端用 API 先查出 orgId：
 * - GET /api/v1/orgs → 找到 code=demo-lms-scale 的那筆
 *
 * 這不是在「用 API 取代 UI 測試」：
 * - UI 本身仍會被 Playwright 驗證（登入/導覽/頁面渲染）
 * - 這裡只是把「找 orgId」這種不重要且容易脆的步驟，改成更穩定的方式
 */

import { E2E } from './env';

export type OrgInfo = {
  id: string;
  name: string;
  code: string | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`[e2e] HTTP ${res.status} ${url}\n${text}`);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`[e2e] Expected JSON but got:\n${text}`);
  }
}

let cachedOrg: OrgInfo | null = null;

export async function getOrgByCode(): Promise<OrgInfo> {
  if (cachedOrg) return cachedOrg;

  const url = new URL('/api/v1/orgs', E2E.apiBaseUrl).toString();
  const orgs = await fetchJson<OrgInfo[]>(url);

  const target = orgs.find((o) => o && typeof o === 'object' && o.code === E2E.orgCode) ?? null;
  if (!target || typeof target.id !== 'string') {
    throw new Error(`[e2e] org not found by code=${E2E.orgCode} (apiBase=${E2E.apiBaseUrl})`);
  }

  cachedOrg = target;
  return target;
}

