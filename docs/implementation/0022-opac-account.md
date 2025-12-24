# 實作說明 0022：OPAC Account（讀者登入 + 我的借閱/我的預約）

本文件說明我在第 22 輪把 OPAC 從「用 external_id 當身份（可用但不安全）」升級到 **真正可登入** 的版本：
- Patron login：`POST /api/v1/orgs/:orgId/auth/patron-login`
- Me endpoints（PatronAuthGuard）：`/api/v1/orgs/:orgId/me/*`
- Web（OPAC）新增登入/登出與「我的借閱/我的預約」頁面

同時保留既有的 `user_external_id` 模式作為過渡（避免一次改爆），但會在 UI 明確標示風險並引導登入。

---

## 1) 問題：外部 ID 模式為什麼不安全

早期 MVP 的 OPAC 為了快速可用，採用：
- 讀者輸入 `user_external_id`（學號/員編）
- 後端用 external_id 找到 borrower，再允許查詢/取消

它的問題是：
- 任何人只要知道某人的 external_id，就能查/取消對方預約

因此這一輪的目標是：
1) 導入 Patron authentication（最小可用）
2) 讓「我的借閱 / 我的預約」真正只回本人資料

---

## 2) API：Patron login（student/teacher）

端點：
- `POST /api/v1/orgs/:orgId/auth/patron-login`

Request：
```json
{ "external_id": "S1130123", "password": "your-password" }
```

Response（shape 與 staff login 一致，方便前端共用）：
```json
{
  "access_token": "base64url(payload).base64url(signature)",
  "expires_at": "2025-12-25T12:00:00Z",
  "user": { "id": "u_...", "external_id": "S1130123", "name": "王小明", "role": "student", "status": "active" }
}
```

限制（MVP）：
- 只允許 `student/teacher` 登入（對齊 circulation_policies.audience_role）
- 若密碼尚未設定，回 409（`PASSWORD_NOT_SET`）

---

## 3) Guard：PatronAuthGuard 的責任

`apps/api/src/auth/patron-auth.guard.ts` 做六件事：
1) 解析 `Authorization: Bearer <token>`
2) 驗證 token（HMAC 簽章 + exp）
3) 驗證 token.org == route orgId（多租戶隔離）
4) 查 DB：user 必須存在且 `active`
5) role 必須是 `student/teacher`
6) 若 request 帶 `actor_user_id`，必須等於 token.sub（防冒用）

這讓 `/me/*` 端點可以做到：
- 前端不需要也不允許傳 `user_external_id`
- user_id 永遠由 token 推導

---

## 4) Me endpoints：登入後的「本人資料」

路由前綴：
- `/api/v1/orgs/:orgId/me`（PatronAuthGuard）

提供：
- `GET /me`：我的基本資料
- `GET /me/loans?status=&limit=`：我的借閱
- `GET /me/holds?status=&limit=`：我的預約
- `POST /me/holds`：替自己建立預約（place hold）
- `POST /me/holds/:holdId/cancel`：取消自己的預約

設計重點：
- listMyLoans/listMyHolds：SQL 直接用 `WHERE user_id = token.sub` 篩選（最清楚也最安全）
- place/cancel hold：重用 `HoldsService` 商業規則，但強制帶 `actor_user_id=token.sub`，避免授權漏洞

---

## 5) Web（OPAC）：session、登入、我的借閱/我的預約

### 5.1 OPAC session（localStorage）
新增：
- `apps/web/app/lib/opac-session.ts`
- `apps/web/app/lib/use-opac-session.ts`

與 staff session 類似：
- access_token 存 localStorage（依 orgId 分開）
- 以 `expires_at` 判斷過期，過期就清掉避免一直 401

### 5.2 API client：依路徑決定 token
`apps/web/app/lib/api.ts`：
- `/api/v1/orgs/:orgId/me/*` 自動帶 OPAC token
- 其他 org scoped 端點仍帶 staff token（若有）

這能避免「同一瀏覽器同時登入 staff + OPAC」時 token 混用造成 403。

### 5.3 OPAC routes
新增/改造：
- `/opac/orgs/:orgId/login`、`/logout`
- `/opac/orgs/:orgId/loans`（我的借閱）
- `/opac/orgs/:orgId/holds`（我的預約）
- `/opac/orgs/:orgId`（搜尋/預約：已登入走 `/me/holds`；未登入走 legacy `/holds`）

---

## 6) 密碼從哪裡來？（最小可用落地）

MVP 先採「館員替讀者設定密碼」：
- staff 端 endpoint：`POST /api/v1/orgs/:orgId/auth/set-password`
- 本輪 Web Console 的 Users 頁新增「設定/重設密碼」按鈕（可對 student/teacher 使用）

好處：
- 不需要立刻整合 SSO 就能開始用「我的借閱/我的預約」

後續可擴充：
- 校務系統 SSO / LDAP
- PIN / 生日驗證（更貼近部分學校）

---

## 7) 如何手動驗證（建議路徑）

1) 用 Web Console 建立一個 student/teacher 使用者（或用 US-010 名冊匯入）
2) 在 Web Console `/orgs/:orgId/users`：
   - 用「設定/重設密碼」替該讀者設密碼
3) 到 OPAC：
   - `/opac/orgs/:orgId/login` 登入
4) 驗證：
   - `/opac/orgs/:orgId/loans` 能看到自己的借閱
   - `/opac/orgs/:orgId/holds` 能看到自己的預約，並可取消 queued/ready
   - 在 `/opac/orgs/:orgId` 預約書目時，已登入會走 `/me/holds`（不用再輸入 external_id）

---

## 8) 本輪新增/修改的主要檔案

API：
- `apps/api/src/auth/auth.controller.ts`（新增 patron-login）
- `apps/api/src/auth/auth.schemas.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/patron-auth.guard.ts`
- `apps/api/src/me/*`
- `apps/api/src/holds/holds.module.ts`（export HoldsService 給 MeService DI）

Web：
- `apps/web/app/lib/api.ts`（/me token routing + me functions）
- `apps/web/app/lib/opac-session.ts`
- `apps/web/app/lib/use-opac-session.ts`
- `apps/web/app/opac/orgs/[orgId]/layout.tsx` + `opac-session-nav.tsx`
- `apps/web/app/opac/orgs/[orgId]/login/page.tsx`
- `apps/web/app/opac/orgs/[orgId]/logout/page.tsx`
- `apps/web/app/opac/orgs/[orgId]/loans/page.tsx`
- `apps/web/app/opac/orgs/[orgId]/holds/page.tsx`
- `apps/web/app/opac/orgs/[orgId]/page.tsx`
- `apps/web/app/orgs/[orgId]/users/page.tsx`（新增設定/重設密碼按鈕）

