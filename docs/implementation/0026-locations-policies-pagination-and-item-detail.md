# 0026：Locations/Poiicies 治理 + Cursor Pagination + Item Detail 組合狀態

本文件說明為了讓 `scripts/seed-scale.py`（大量假資料）在 Web Console / OPAC 下「真的可用」，我們補齊的三個關鍵能力：
- **Master data 治理**：Locations 可編輯/停用，且「停用的 location 不可被新建冊/取書地點/盤點使用」。
- **政策治理**：Circulation Policies 導入 `is_active`（同 org + role 同時只能有一筆生效），避免政策越建越多卻無法治理。
- **大量資料 UX**：users/bibs/items/loans/holds 導入 cursor pagination（keyset），前端提供「載入更多」；item detail 一次回傳「冊 + 目前借閱/保留狀態」。

> 這一輪的核心目標是：**讓 scale seed 的資料量不會把列表與頁面撐爆**，並且讓館員能在 UI 直接完成常見治理工作。

---

## 1) Locations：PATCH + UI +「inactive 不可用」規則

### 1.1 API：新增 PATCH /locations/:locationId
- 後端新增 `PATCH /api/v1/orgs/:orgId/locations/:locationId`，支援更新 `code/name/area/shelf_code/status`。
- `area/shelf_code` 支援送 `null` 清空（對齊「可選欄位」的治理需求）。

### 1.2 規則：inactive location 不可被用於「新建」關鍵流程
落實位置治理的目標不是「能停用」，而是「停用後不會再被拿去用」：
- 新增冊/改冊位置：若指定 `location_id` 為 inactive → 後端回 `LOCATION_INACTIVE`
- 建立 hold：若指定 `pickup_location_id` 為 inactive → 後端回 `LOCATION_INACTIVE`
- 盤點 session：原本即要求 active（沿用既有 `requireActiveLocation`）
- Catalog CSV import：default location / location codes 僅允許 active

### 1.3 Web：Locations 後台頁支援 inline 編輯與停用/啟用
Web Console 的 `/orgs/:orgId/locations` 提供：
- inline 編輯欄位 → PATCH
- 停用/啟用按鈕（停用會 confirm）
- 下拉選單預設只顯示 active locations（減少「送出後才被後端擋」的挫折）

---

## 2) Policies：active/default 機制 + PATCH + UI

### 2.1 DB：circulation_policies.is_active + partial unique index
在 `db/schema.sql` 新增欄位與唯一性約束：
- `is_active boolean NOT NULL DEFAULT false`
- `UNIQUE (organization_id, audience_role) WHERE is_active`

設計理由：
- 我們需要能「治理」政策：同一角色永遠只有一套生效政策，避免 checkout/renew/hold 的規則來源不確定。

### 2.2 API：create 即生效、PATCH 只允許 `is_active=true`
- 建立 policy 時會先停用同 role 其他 active，再插入新 policy 為 active（「建立即生效」）。
- PATCH 僅允許把某筆設為 active（`is_active=true`），不允許直接設為 false。
  - 目的：避免「整個 role 沒有有效政策」導致 circulation 全面失效。

### 2.3 Web：Circulation Policies UI 支援「設為有效」與 inline 編輯
Web Console 的 `/orgs/:orgId/circulation-policies` 提供：
- 建立 policy（提示「建立即生效」）
- 列表顯示 active/inactive
- 一鍵「設為有效」（PATCH `is_active=true`）
- inline 編輯欄位 → PATCH

---

## 3) Cursor Pagination（Keyset）：users/bibs/items/loans/holds

### 3.1 為什麼不用 OFFSET？
大量資料下 offset pagination 常見問題：
- `LIMIT/OFFSET` 越往後越慢（DB 需要跳過越多筆）
- 翻頁期間若資料新增/刪除，容易跳漏/重複

因此改採 **keyset/cursor pagination**：
- 以「排序鍵 + id」作為游標
- 下一頁用 `(sort, id) < (...)` 或 `(sort, id) > (...)` 取連續區間

### 3.2 Cursor 格式與回傳 envelope
後端統一回傳：
```ts
{ items: T[]; next_cursor: string | null }
```

Cursor 格式（v1）是 Base64URL(JSON)：
```ts
// apps/api/src/common/cursor.ts
export type CursorV1 = { sort: string; id: string };
```

### 3.3 排序鍵（每個 endpoint）
- users：`created_at DESC, id DESC`（cursor.sort=created_at）
- bibs：`created_at DESC, id DESC`（cursor.sort=created_at）
- items：`created_at DESC, id DESC`（cursor.sort=created_at）
- loans：`checked_out_at DESC, id DESC`（cursor.sort=checked_out_at）
- holds：依 status 採不同排序（cursor.sort 對應 ready_at 或 placed_at；前端只需原樣帶回）

後端用「多抓 1 筆」判斷是否還有下一頁：
- `queryLimit = pageSize + 1`
- 若 `rows.length > pageSize` → `next_cursor` 以本頁最後一筆產生

### 3.4 Web：「載入更多」實作模式
前端的關鍵做法是 **把「已套用的 filters」固定下來**：
- `appliedFilters`：這次列表真正使用的 filters（避免使用者改了輸入但沒按搜尋，卻拿舊 cursor 續查）
- `nextCursor`：後端回傳的 next_cursor

範例（概念）：
```ts
// 1) refresh：抓第一頁 → setItems(page.items) + setNextCursor(page.next_cursor)
// 2) loadMore：帶 cursor → append items + 更新 nextCursor
```

---

## 4) Item detail：一次回傳「冊 + 目前借閱/保留狀態」

### 4.1 API：GET /items/:itemId 回傳組合狀態
後端在 item detail 使用 `LATERAL ... LIMIT 1` 保證回傳固定 1 row：
- `current_loan`：open loan（returned_at IS NULL）
- `assigned_hold`：ready hold（status='ready' 且 assigned_item_id=itemId）

核心 SQL（節錄）：
```sql
-- apps/api/src/items/items.service.ts
LEFT JOIN LATERAL (
  SELECT id, user_id, checked_out_at, due_at
  FROM loans
  WHERE organization_id = i.organization_id
    AND item_id = i.id
    AND returned_at IS NULL
  LIMIT 1
) l ON true
```

### 4.2 Web：Item Detail 顯示「open loan / assigned ready hold」與一致性提示
Web Console 的 `/orgs/:orgId/items/:itemId` 會顯示：
- open loan（借閱者、到期日）
- assigned ready hold（預約者、取書期限、取書地點）
- 若 `item.status` 與組合狀態不一致，會顯示提示（方便你用 scale seed 快速抓資料不一致）

---

## 5) 驗證方式（建議）

### 5.1 重新建 DB（若你之前已跑過且保留 volume）
本 repo 目前沒有 migrations；`db/schema.sql` 有變更時建議重置一次：
```bash
npm run docker:down:volumes
npm run docker:scale
```

### 5.2 Web Console / OPAC 手動驗證重點
- `/orgs/:orgId/users`：搜尋後可連續「載入更多」
- `/orgs/:orgId/bibs`、`/opac/orgs/:orgId`：搜尋/列表可連續「載入更多」
- `/orgs/:orgId/items`、`/orgs/:orgId/bibs/:bibId`：items 列表可「載入更多」
- `/orgs/:orgId/loans`、`/orgs/:orgId/holds`：列表可「載入更多」
- `/orgs/:orgId/items/:itemId`：可看到 open loan / assigned hold 組合狀態

