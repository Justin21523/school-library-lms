# 實作說明 0018：Staff Auth / 權限收斂（Bearer token + actor_user_id 對齊）

本文件說明我在第 18 輪補上的「館員後台登入/權限」能力：把原本 MVP 依賴 `actor_user_id` 的最小稽核方式，收斂成真正的身分驗證（authentication），並用 Guard 在後端強制 `actor_user_id` 必須等於登入者（避免冒用）。

本輪新增/調整：
- DB：新增 `user_credentials`（密碼雜湊/鹽；與 users 分表）
- API：
  - `POST /api/v1/orgs/:orgId/auth/login`
  - `POST /api/v1/orgs/:orgId/auth/set-password`（需 Bearer token）
  - `POST /api/v1/orgs/:orgId/auth/bootstrap-set-password`（需 `AUTH_BOOTSTRAP_SECRET`）
  - `StaffAuthGuard`：保護 staff 端點、檢查 org 邊界、對齊 `actor_user_id`
- Web Console：
  - `/orgs/:orgId/login`、`/orgs/:orgId/logout`
  - `apps/web/app/lib/api.ts` 自動帶 `Authorization: Bearer`
  - 各頁移除「actor_user_id 下拉選單」，改由 session 推導並顯示（避免冒用）

---

## 1) 為什麼要做 Staff Auth（actor_user_id 的問題）

早期 MVP 先用 `actor_user_id` 讓後端能寫入 `audit_events`（可追溯），但它有兩個硬傷：
1) **可冒用**：前端可以任意填/選 actor，後端很難知道「誰真的就是誰」
2) **擴充困難**：當你開始做報表/匯入/維運/稽核，沒有登入會讓敏感端點不得不暴露在沒有身份驗證的情況下

因此本輪的核心目標是：
- 讓 Web Console 先有「最小可用」登入（staff only）
- 後端用 Guard 強制：`actor_user_id` 必須等於登入者（token.sub）

> 補充：後續已新增 OPAC Account（讀者登入 + `/me/*`），見 `docs/implementation/0022-opac-account.md`；本篇重點仍以 staff 後台登入/權限收斂為主。

---

## 2) DB：新增 user_credentials（與 users 分表）

`db/schema.sql`
```sql
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  algorithm text NOT NULL DEFAULT 'scrypt-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

為什麼要分表？
- **降低誤回傳風險**：users 查詢/列表不會不小心把密碼欄位帶出去
- **方便未來替換**：若改 SSO/LDAP，只要替換 auth 模組與憑證表策略，不必動 users 主檔

---

## 3) 密碼：scrypt + salt（不依賴外部套件）

`apps/api/src/auth/auth.service.ts`
```ts
const salt = crypto.randomBytes(16).toString('base64');
const hash = await scryptAsync(password, salt, 64);
```

設計重點：
- 使用 Node.js 內建 `crypto.scrypt`（避免安裝套件；也符合 sandbox/network 限制）
- 每位使用者一個 salt，避免同密碼相同 hash
- `algorithm` 欄位保留版本字串（例如 `scrypt-v1`），方便未來平滑升級（多版本驗證）

---

## 4) Token：簡化版「可驗證、可過期」Bearer token（HMAC）

`apps/api/src/auth/auth.service.ts`
```ts
const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
const sigB64 = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
return `${payloadB64}.${sigB64}`;
```

payload 內容（重點欄位）：
- `sub`：user_id（UUID）
- `org`：org_id（UUID；多租戶隔離）
- `role`：admin/librarian（staff role）
- `iat/exp`：簽發/過期時間（epoch seconds）

環境變數：
- `AUTH_TOKEN_SECRET`：token 簽章 secret（未設定時 dev 會 fallback `dev-insecure-secret`，正式上線務必設定）

為什麼不是 JWT？
- MVP 先追求「依賴最少、易理解、可替換」
- token 的用途只是讓 Guard 能驗證「這個 request 是哪個 staff」以及「是否過期」
- 後續若要整合 SSO / 標準 JWT，可把 token 實作替換掉，不影響 controller/guard 的呼叫方式

---

## 5) Guard：StaffAuthGuard 的責任與規則

`apps/api/src/auth/staff-auth.guard.ts`
```ts
if (payload.org !== orgId) throw new ForbiddenException(...);      // 多租戶隔離
if (actorUserIdFromRequest && actorUserIdFromRequest !== payload.sub) throw new ForbiddenException(...); // 防冒用
```

這個 Guard 做了哪些事：
1) 解析 `Authorization: Bearer <token>`
2) 驗證 token（簽章/過期）
3) 驗證 token.org == route orgId（隔離不同學校）
4) 查 DB 確認 user 存在且 `active`
5) 限制角色必須是 staff（`admin/librarian`）
6) 若 request body/query 有 `actor_user_id`：必須等於 token.sub

> 這就是本輪「actor_user_id 收斂」的核心：前端不再能任意冒用他人 actor。

---

## 6) API：登入/設密碼/Bootstrap

端點（詳見 `API-DRAFT.md` 的「11) Auth（Staff）」）：
- `POST /api/v1/orgs/:orgId/auth/login`
- `POST /api/v1/orgs/:orgId/auth/set-password`（需 Bearer token）
- `POST /api/v1/orgs/:orgId/auth/bootstrap-set-password`（需 `AUTH_BOOTSTRAP_SECRET`）

Audit：
- set-password：寫入 `audit_events`（action=`auth.set_password`）
- bootstrap-set-password：寫入 `audit_events`（action=`auth.bootstrap_set_password`）

Bootstrap 為什麼需要 secret？
- 解決「第一次導入時，還沒有人能登入」的雞生蛋問題
- 但 bootstrap 本身很危險，因此採「必須設定 `AUTH_BOOTSTRAP_SECRET` 才能啟用」的策略

---

## 7) Web Console：localStorage session + 自動帶 Authorization

`apps/web/app/lib/staff-session.ts`
```ts
function storageKey(orgId: string) {
  return `library_system_staff_session:${orgId}`;
}
```

`apps/web/app/lib/api.ts`
```ts
const orgIdForAuth = extractOrgIdFromApiPath(path);
const token = orgIdForAuth ? getStaffAccessToken(orgIdForAuth) : null;
if (token) headers['authorization'] = `Bearer ${token}`;
```

配套頁面：
- `/orgs/:orgId/login`：登入成功後把 `{ access_token, expires_at, user }` 存到 localStorage
- `/orgs/:orgId/logout`：清除 localStorage session
- 側欄顯示登入狀態：`apps/web/app/orgs/[orgId]/staff-session-nav.tsx`

頁面行為調整（很重要）：
- 原本各頁都有「actor_user_id 下拉選單」→ 本輪改成「由 session 推導並鎖定」
- 若未登入就打到受 guard 保護的 API，會 401/403；因此各頁改成「先顯示登入門檻」再載入資料

---

## 8) 如何驗證（本機）

1) 設定環境變數（API 端）
   - `AUTH_TOKEN_SECRET`：任意長字串（production 請用強 secret）
   - `AUTH_BOOTSTRAP_SECRET`：任意長字串（只在初始化時使用）

2) 若你還沒有任何 staff 使用者（admin/librarian）
   - 由於 `/users` 現在是 staff-only 端點（受 guard 保護），第一次導入時建議直接在 DB 建一個 admin
   - 例（PostgreSQL）：
     ```sql
     INSERT INTO users (organization_id, external_id, name, role, org_unit, status)
     VALUES ('<orgId>', 'A0001', 'Admin', 'admin', NULL, 'active')
     RETURNING id;
     ```

2) 用 bootstrap 設定第一個 admin 密碼（HTTP）
   - `POST /api/v1/orgs/:orgId/auth/bootstrap-set-password`
   - body：`bootstrap_secret + target_external_id + new_password`

3) 登入取得 token
   - `POST /api/v1/orgs/:orgId/auth/login`

4) 開 Web Console
   - 進 `/orgs/:orgId/login` 登入
   - 登入後到 `/orgs/:orgId/*`（Users/Loans/Reports/Audit/Items…）確認不再需要選 actor_user_id

---

## 9) 本輪新增/修改的主要檔案

API：
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/staff-auth.guard.ts`
- `apps/api/src/app.module.ts`

DB：
- `db/schema.sql`（新增 `user_credentials`）

Web：
- `apps/web/app/lib/staff-session.ts`
- `apps/web/app/lib/use-staff-session.ts`
- `apps/web/app/lib/api.ts`（自動帶 Authorization）
- `apps/web/app/orgs/[orgId]/login/page.tsx`
- `apps/web/app/orgs/[orgId]/logout/page.tsx`
- `apps/web/app/orgs/[orgId]/staff-session-nav.tsx`
