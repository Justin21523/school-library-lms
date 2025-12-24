/**
 * OPAC Session（Patron Auth / 讀者端登入）
 *
 * 目的：
 * - 在 OPAC（讀者端）保存「讀者登入後取得的 access_token」
 * - 讓 `/api/v1/orgs/:orgId/me/*` 這類「只允許本人」的端點能自動帶上 Authorization header
 *
 * 與 Staff Session 的差異：
 * - Staff Session（Web Console）用於 admin/librarian 的後台操作（受 StaffAuthGuard 保護）
 * - OPAC Session（Patron）用於 student/teacher 的自助查詢（受 PatronAuthGuard 保護）
 *
 * 為什麼仍用 localStorage？
 * - 與目前的 Staff Auth 同步：用 Bearer token（不依賴 cookie）
 * - MVP 優先「可用」與「容易理解」
 *
 * 注意（安全性取捨）：
 * - localStorage 仍有 XSS 風險；正式上線建議改成 session cookie + CSRF + CSP
 * - 本檔案只負責「保存/讀取/清除 token」，不處理權限判斷（權限由後端 guard 負責）
 */

export type PatronRole = 'student' | 'teacher';
export type PatronStatus = 'active' | 'inactive';

export type PatronUser = {
  id: string;
  organization_id: string;
  external_id: string;
  name: string;
  role: PatronRole;
  status: PatronStatus;
};

export type OpacSession = {
  access_token: string;
  expires_at: string;
  user: PatronUser;
};

function storageKey(orgId: string) {
  // key 以 orgId 分開，避免同一瀏覽器同時操作不同學校時互相覆蓋。
  return `library_system_opac_session:${orgId}`;
}

export function loadOpacSession(orgId: string): OpacSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isOpacSession(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOpacSession(orgId: string, session: OpacSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(orgId), JSON.stringify(session));
}

export function clearOpacSession(orgId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(orgId));
}

export function getOpacAccessToken(orgId: string) {
  const session = loadOpacSession(orgId);
  return session?.access_token ?? null;
}

function isOpacSession(value: unknown): value is OpacSession {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  if (typeof record['access_token'] !== 'string') return false;
  if (typeof record['expires_at'] !== 'string') return false;

  const user = record['user'];
  if (!user || typeof user !== 'object') return false;
  const u = user as Record<string, unknown>;

  // role 只允許 student/teacher（對齊 PatronAuthGuard 的 allowlist）。
  const role = u['role'];
  if (role !== 'student' && role !== 'teacher') return false;

  return (
    typeof u['id'] === 'string' &&
    typeof u['organization_id'] === 'string' &&
    typeof u['external_id'] === 'string' &&
    typeof u['name'] === 'string' &&
    typeof u['status'] === 'string'
  );
}

