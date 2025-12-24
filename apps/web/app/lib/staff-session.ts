/**
 * Staff Session（Web Console Auth）
 *
 * 目的：
 * - 在 Web Console 端保存「staff 登入後取得的 access_token」
 * - 讓所有 API 呼叫可以自動帶上 Authorization header（Bearer token）
 * - 並把 actor_user_id 從「使用者下拉選單」收斂成「登入者本人」
 *
 * 為什麼用 localStorage？
 * - MVP 階段先追求「可用」與「易理解」
 * - 我們使用 Bearer token（放在 Authorization header），不依賴 cookie（跨 origin 更容易踩 CORS/credentials 坑）
 *
 * 注意（安全性取捨）：
 * - localStorage 仍有 XSS 風險；正式上線建議改成更安全的 session cookie + CSRF 防護
 * - 本專案尚未有完整 CSP/安全標頭；因此仍需把「前端 XSS」視為高優先風險
 */

export type StaffRole = 'admin' | 'librarian' | 'teacher' | 'student' | 'guest';
export type StaffStatus = 'active' | 'inactive';

export type StaffUser = {
  id: string;
  organization_id: string;
  external_id: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
};

export type StaffSession = {
  access_token: string;
  expires_at: string;
  user: StaffUser;
};

function storageKey(orgId: string) {
  return `library_system_staff_session:${orgId}`;
}

export function loadStaffSession(orgId: string): StaffSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isStaffSession(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStaffSession(orgId: string, session: StaffSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(orgId), JSON.stringify(session));
}

export function clearStaffSession(orgId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(orgId));
}

export function getStaffAccessToken(orgId: string) {
  const session = loadStaffSession(orgId);
  return session?.access_token ?? null;
}

function isStaffSession(value: unknown): value is StaffSession {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  if (typeof record['access_token'] !== 'string') return false;
  if (typeof record['expires_at'] !== 'string') return false;

  const user = record['user'];
  if (!user || typeof user !== 'object') return false;
  const u = user as Record<string, unknown>;

  return (
    typeof u['id'] === 'string' &&
    typeof u['organization_id'] === 'string' &&
    typeof u['external_id'] === 'string' &&
    typeof u['name'] === 'string' &&
    typeof u['role'] === 'string' &&
    typeof u['status'] === 'string'
  );
}

