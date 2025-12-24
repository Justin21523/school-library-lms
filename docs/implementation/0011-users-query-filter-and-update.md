# 0011 — US-011 使用者查詢/篩選 + 停用/啟用（API + Web + audit）

本篇把 `USER-STORIES.md` 的 **US-011 查詢與篩選使用者** 落地成：
- API：`GET /api/v1/orgs/:orgId/users` 支援 `query/role/status/limit`
- API：`PATCH /api/v1/orgs/:orgId/users/:userId` 支援停用/啟用與主檔更正，並寫入 `audit_events`
- Web Console：`/orgs/:orgId/users` 新增篩選器與「停用/啟用」按鈕

> 為什麼這一輪重要？因為借還/預約/報表都高度依賴「快速找到正確的使用者」，而名冊更新後也需要能停用畢業/轉出的帳號。

---

## 1) 對照 user story（驗收條件）

`USER-STORIES.md` → **US-011 查詢與篩選使用者**
- 驗收：可搜尋 `external_id`、`name`、`org_unit`

本輪補齊：
- 後端：`query`（模糊搜尋）+ `role/status`（精準篩選）+ `limit`
- 前端：把篩選器做在 `/users` 頁，讓館員操作更順手

並額外補上（對維運很重要）：
- `PATCH /users/:userId`：停用/啟用與資料更正（並寫入稽核）

---

## 2) API：GET /users（query/role/status/limit）

### 2.1 Query params
- `query`：模糊搜尋字串（會比對 `external_id/name/org_unit`）
- `role`：精準篩選角色（`admin/librarian/teacher/student/guest`）
- `status`：精準篩選狀態（`active/inactive`）
- `limit`：回傳筆數上限（預設 200）

### 2.2 實作重點（Service）
檔案：`apps/api/src/users/users.service.ts`
- 用「動態 where clauses」方式組 SQL（只拼有提供的條件）
- `query` 使用 `ILIKE '%...%'` 做模糊查詢（MVP 最實用）
- `role/status` 用 enum cast（`::user_role` / `::user_status`）讓 DB 端也能幫忙驗證

---

## 3) API：PATCH /users/:userId（停用/啟用 + audit）

### 3.1 Request body（JSON）
```json
{
  "actor_user_id": "UUID（admin/librarian）",
  "status": "inactive",
  "note": "113-1 畢業名單停用"
}
```

可更新欄位：
- `name`（更正姓名）
- `org_unit`（班級/單位；可送 `null` 清空）
- `role`（更正角色）
- `status`（停用/啟用：`inactive/active`）

### 3.2 為什麼要帶 actor_user_id？
因為 MVP 尚未做 auth，後端無法從 token 推導操作者；但停用/改角色是敏感操作，所以仍要求 `actor_user_id` 並在後端做最小 RBAC。

### 3.3 最小 RBAC（避免一般館員誤改 staff）
檔案：`apps/api/src/users/users.service.ts`
- actor 必須是 active 的 `admin/librarian`
- `librarian` 只能管理 `student/teacher/guest`
  - 不可修改 `admin/librarian`
  - 不可把人升級成 `admin/librarian`
- `admin` 才能管理 staff 或調整 staff 角色

### 3.4 稽核（audit_events）
PATCH 成功且確實有變更時，會寫入：
- `action`：`user.update`
- `entity_type`：`user`
- `entity_id`：`{userId}`
- `metadata`：`changes`（from/to）+ `note`（選填）

---

## 4) Web Console：/users（篩選 + 停用/啟用）

檔案：`apps/web/app/orgs/[orgId]/users/page.tsx`

做法：
- 查詢區塊新增 `role/status/limit` 篩選器，直接呼叫後端 filters
- 停用/啟用按鈕：
  - 需要先選 `actor_user_id`（admin/librarian）
  - 點「停用」會 `confirm()`（降低誤操作）
  - 成功後會重新 refresh 列表

API Client 擴充：
- 檔案：`apps/web/app/lib/api.ts`
  - `listUsers()`：第二參數支援 `string | filters object`（避免一次改爆所有頁）
  - `updateUser()`：呼叫 `PATCH /users/:userId`

---

## 5) 如何手動驗證

1) 建立/確認有一個 staff 帳號（admin 或 librarian）
- `/orgs/:orgId/users` 建立 `librarian` 或 `admin`

2) 在 `/orgs/:orgId/users`：
- 用 `query` 搜尋（姓名/學號/班級）
- 用 `role/status` 篩選
- 選擇 `actor_user_id`（admin/librarian）
- 對某位 student/teacher 點「停用」或「啟用」

3) 到 `/orgs/:orgId/audit-events`：
- action 輸入 `user.update`
- 確認能看到 `changes`（from/to）與 `note`（若有填）

---

## 6) 後續可擴充（MVP 先不做）
- users 分頁（cursor/next_cursor）
- 更完整的 user profile 欄位（email、座號、年級、畢業年度）
- 改成真正 auth（actor 不再由 body 傳入）
- 更細的權限（例如 librarian 只能停用 student/teacher，不能改 role）

