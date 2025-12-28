# 0027：補齊「API 已有但前端未覆蓋」+ Me Cursor Pagination + Maintenance Runner

本文件記錄一輪「把缺口補到可用」的改動，聚焦在三件事：
1) **API 已有但前端缺 UI**：Bootstrap 設密碼、Users 主檔更正、Inventory sessions filter。
2) **OPAC Account 可承受大量資料**：`/me/loans`、`/me/holds` 導入 cursor pagination，OPAC 頁面支援「載入更多」。
3) **例行維運可自動化**：新增 maintenance runner（腳本 + docker compose profile），可用 cron 觸發。

> 這輪的原則是「不改資料模型、以最小介面補齊可操作性」，並且沿用既有的 cursor/page 模式，避免前後端分歧。

---

## 1) Bootstrap：Set Staff Password UI（初始化密碼）

### 1.1 為什麼需要 UI？
`POST /api/v1/orgs/:orgId/auth/bootstrap-set-password` 的用途是解決「雞生蛋問題」：
- 初次導入時 `user_credentials` 尚未建立 → 沒有人能登入
- 沒有 staff token → 也無法使用 `POST /auth/set-password`
- 因此需要一個「一次性通關」的 bootstrap secret（`AUTH_BOOTSTRAP_SECRET`）

### 1.2 Web：不保存 secret 的頁面
新增頁面：`apps/web/app/orgs/[orgId]/bootstrap-set-password/page.tsx`
- 使用者必須手動輸入 `bootstrap_secret`（不寫入 localStorage/cookie/URL）
- 成功後清空欄位，避免敏感資訊留在畫面上

---

## 2) Users：更正主檔 UI（name/role/org_unit）

後端 `PATCH /api/v1/orgs/:orgId/users/:userId` 已支援更新 `name/role/org_unit/status`，但原本 UI 只有「停用/啟用」與「設定/重設密碼」。

本輪在 `apps/web/app/orgs/[orgId]/users/page.tsx` 加上：
- 每位使用者的「更正資料」表單（一次只展開一位）
- librarian 的最小 RBAC 防呆（不可編輯 staff，也不可把人升級成 staff）

---

## 3) Inventory sessions：location/status filter UI

`GET /api/v1/orgs/:orgId/inventory/sessions` 原本已支援：
- `location_id`
- `status=open|closed|all`
- `limit`

但 UI 先前固定只抓 `limit=50`。

本輪在 `apps/web/app/orgs/[orgId]/inventory/page.tsx` 新增 sessions filters 表單，並補齊兩個 UX 防呆：
- 改 filter 後，若目前選到的 session 不在清單內，自動切到最新的一筆
- 關閉 session 後自動把 status filter 切回 `all`，避免「open 篩選下關閉後消失」造成使用者找不到結果

---

## 4) OPAC Account：/me cursor pagination（大量資料可翻頁）

### 4.1 API：/me/loans、/me/holds 回傳 envelope
將 `/me/loans` 與 `/me/holds` 改為與後台 list endpoints 一致的回傳：
```ts
// apps/api/src/common/cursor.ts 的 CursorPage
{ items: T[]; next_cursor: string | null }
```

並在 query schema 補上 `cursor`：
```ts
// apps/api/src/me/me.schemas.ts
export const listMyLoansQuerySchema = z.object({
  status: meLoanStatusSchema.optional(),
  limit: intFromStringSchema.optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
});
```

### 4.2 MeService：沿用既有 CursorV1（sort + id）
`/me/loans` 的排序鍵對齊 staff `/loans`：`checked_out_at DESC, id DESC`：
```ts
// apps/api/src/me/me.service.ts（節錄）
if (query.cursor) {
  const cursor = decodeCursorV1(query.cursor);
  whereClauses.push(`(l.checked_out_at, l.id) < ($${...}::timestamptz, $${...}::uuid)`);
}
ORDER BY l.checked_out_at DESC, l.id DESC
```

`/me/holds` 的 cursor 策略對齊 staff `/holds`（status 不同排序鍵不同）：
- `ready`：`ready_at ASC`
- `queued`：`placed_at ASC`
- 其他/`all`：`placed_at DESC`

> 這樣做的好處是：前端不需要理解 cursor 的內容，只要帶回 `next_cursor` 就能續查；同時避免為 `/me/holds` 另造一個不相容的 cursor 格式。

### 4.3 Web：OPAC Loans/Holds 加上「載入更多」
更新：
- `apps/web/app/opac/orgs/[orgId]/loans/page.tsx`
- `apps/web/app/opac/orgs/[orgId]/holds/page.tsx`

共用模式：
- `refresh()`：抓第一頁 → `setItems(page.items)` + `setNextCursor(page.next_cursor)`
- `loadMore()`：帶 `cursor=next_cursor` → append items

---

## 5) Maintenance runner：把例行作業做成可自動化的 script + docker profile

### 5.1 腳本：Node fetch 打 API
新增：`scripts/maintenance-daily.mjs`
- 先用 `/api/v1/orgs` 以 `orgCode` 找 `orgId`
- 用 `POST /auth/login` 取得 token + `actor_user_id`
- 呼叫：
  - `POST /holds/expire-ready`（預設 apply）
  - `POST /loans/purge-history`（預設 preview；不可逆刪除需明確切到 apply）

### 5.2 Docker compose profile
在 `docker-compose.yml` 新增：
- `maintenance` service（profile=`maintenance`）
- 依賴 `api` healthcheck

執行：
```bash
npm run docker:maintenance
```

設定請見 `.env.example` 的 `MAINTENANCE_*` 區段。

---

## 6) 主要異動檔案（索引）

API：
- `apps/api/src/me/me.schemas.ts`
- `apps/api/src/me/me.service.ts`

Web：
- `apps/web/app/orgs/[orgId]/bootstrap-set-password/page.tsx`
- `apps/web/app/orgs/[orgId]/login/page.tsx`
- `apps/web/app/orgs/[orgId]/users/page.tsx`
- `apps/web/app/orgs/[orgId]/inventory/page.tsx`
- `apps/web/app/opac/orgs/[orgId]/loans/page.tsx`
- `apps/web/app/opac/orgs/[orgId]/holds/page.tsx`
- `apps/web/app/lib/api.ts`
- `apps/web/app/globals.css`

Ops：
- `scripts/maintenance-daily.mjs`
- `docker-compose.yml`
- `package.json`
- `.env.example`

