# 實作說明 0019：盤點（Inventory）工作台 + 差異清單 + CSV + audit

本文件說明我在第 19 輪新增的「盤點（Inventory）」核心流程：以 **掃冊條碼** 的方式完成盤點，並產出最貼近學校現場的差異清單（missing / unexpected），同時把「報表/CSV 匯出」的基礎架構沿用到盤點領域。

本輪新增：
- API（Staff-only）：
  - `POST /api/v1/orgs/:orgId/inventory/sessions`（開始盤點）
  - `GET  /api/v1/orgs/:orgId/inventory/sessions`（列出盤點 session）
  - `POST /api/v1/orgs/:orgId/inventory/sessions/:sessionId/scan`（掃冊條碼）
  - `POST /api/v1/orgs/:orgId/inventory/sessions/:sessionId/close`（關閉盤點）
- Reports（Staff-only，JSON/CSV）：
  - `GET /api/v1/orgs/:orgId/reports/inventory-diff?inventory_session_id=...&format=json|csv`
- Web Console：
  - `/orgs/:orgId/inventory`（盤點工作台：開始/掃描/結束 + 差異清單 + CSV）
- DB：
  - `inventory_sessions` / `inventory_scans`（盤點作業與掃描紀錄）
  - 延用並落地 `item_copies.last_inventory_at`（單冊最後盤點時間）
- audit：
  - `inventory.session_started` / `inventory.session_closed`（只在開始/結束寫入，避免高頻掃碼爆表）

---

## 1) 需求與情境（對齊 MVP-SPEC.md）

`MVP-SPEC.md` 的盤點核心一句話是：
> 掃描盤點 → 產出差異清單（在架但未掃 / 掃到但系統顯示非在架）

學校現場通常需要的不是「盤點完成百分比」，而是「今天要處理哪些異常」：
- **missing（在架但未掃）**：書架找不到、可能遺失/錯架/被借走未登記
- **unexpected（掃到但系統顯示非在架）**：資料狀態/位置錯誤（最常見的維護工單來源）

因此本輪的重點是：
1) 盤點要能 **用掃碼快速記錄**  
2) 差異清單要能 **固定、可重現、可匯出 CSV**（方便交辦/列印/留存）

---

## 2) 資料模型：為什麼要引入 session（inventory_sessions / inventory_scans）

如果只有 `item_copies.last_inventory_at`，我們只能回答：
- 「這本書最後一次被掃到是什麼時候」

但盤點真正需要回答的是：
- 「這本書是在哪一次盤點被掃到？」
- 「某次盤點的 missing / unexpected 清單是什麼？」

因此引入 session 是必要的：**以 inventory_session_id 作為盤點邊界**。

`db/schema.sql`（節錄）
```sql
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS inventory_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES item_copies(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_id)
);
```

設計取捨（很重要）：
- `UNIQUE(session_id, item_id)`：同一次盤點重掃同一冊只保留一筆（最新 scanned_at）  
  → MVP 先追求「差異清單正確」；未來若要分析重掃次數，可再加 scan_count 或獨立紀錄表。

---

## 3) API：盤點操作端點（Inventory module）

盤點屬於 staff 作業，因此整組 inventory controller 套用 `StaffAuthGuard`：
- 需要 `Authorization: Bearer <token>`
- `actor_user_id` 仍保留在 body（寫 audit / RBAC），且 guard 會要求它等於登入者（避免冒用）

### 3.1 開始盤點：建立 session
`apps/api/src/inventory/inventory.schemas.ts`
```ts
export const createInventorySessionSchema = z.object({
  actor_user_id: uuidSchema,
  location_id: uuidSchema,
  note: noteSchema.optional(),
});
```

行為摘要（`apps/api/src/inventory/inventory.service.ts`）：
- 建立 `inventory_sessions`
- 寫入一筆 audit：`inventory.session_started`（entity_type=`inventory_session`）

### 3.2 掃冊條碼：記錄 scan + 更新 last_inventory_at
掃描是高頻動作，因此本輪刻意 **不在每次掃描寫 audit**（避免 `audit_events` 爆量）。

掃描會做兩件事：
1) `INSERT INTO inventory_scans ... ON CONFLICT(session_id, item_id) DO UPDATE ...`
2) `UPDATE item_copies SET last_inventory_at = now()`

掃描回傳會附上 flags，方便 UI 即時提醒：
- `location_mismatch`：掃到的冊 location != 盤點 location
- `status_unexpected`：掃到的冊 status != `available`

### 3.3 結束盤點：關閉 session + 寫 audit
結束盤點會：
- 把 `inventory_sessions.closed_at` 設為 DB `now()`（確保同一 transaction 內一致）
- 計算摘要（expected/scanned/missing/unexpected）
- 寫入一筆 audit：`inventory.session_closed`（metadata 含 summary）

---

## 4) 差異清單的定義（missing/unexpected）

本輪採用最貼近現場的定義（與 API 內註解一致）：
- `expected_available_count`：該 location 內 `status=available` 的冊（理論上應在架）
- `missing_count`：expected 中「本次 session 沒掃到」的冊
- `unexpected_count`：本次 session 掃到，但 `status!=available` 或 `location!=session.location`

`apps/api/src/inventory/inventory.service.ts`（摘要計算）
```sql
-- missing：在架（available + location match）但本次盤點沒掃到
AND NOT EXISTS (
  SELECT 1
  FROM inventory_scans sc
  WHERE sc.session_id = s.id
    AND sc.item_id = i.id
)
```

---

## 5) Reports：Inventory Diff（JSON + CSV）

差異清單屬於「輸出/報表」，因此沿用既有 `/reports/*` 架構：
- 同一端點支援 `format=json|csv`
- CSV 含 UTF-8 BOM（Excel 友善）

端點：
- `GET /api/v1/orgs/:orgId/reports/inventory-diff?actor_user_id=...&inventory_session_id=...&limit=...&format=json|csv`

CSV 設計（重點）：
- missing/unexpected 合併為同一張表，用 `diff_type` 區分  
  → 現場更容易直接用 Excel 篩選/排序。

`apps/api/src/reports/reports.service.ts`
```ts
// 把 missing/unexpected 合併成同一個 CSV row shape，再用 diff_type 區分
const rows: DiffCsvRow[] = [
  ...result.missing.map((r) => ({ diff_type: 'missing', ... })),
  ...result.unexpected.map((r) => ({ diff_type: 'unexpected', ... })),
];
```

---

## 6) Web Console：盤點工作台（/orgs/:orgId/inventory）

`apps/web/app/orgs/[orgId]/inventory/page.tsx` 提供：
1) 開始盤點（選 location、備註）
2) 掃冊條碼（即時顯示掃到的冊 + flags）
3) 結束盤點（close session）
4) 顯示差異清單（missing/unexpected）
5) 下載 CSV（inventory-diff report）

Auth：
- 此頁屬於 staff 後台，需要先到 `/orgs/:orgId/login` 登入取得 token

---

## 7) 如何手動驗證（建議路徑）

1) 準備資料：
   - 至少一個 `location`
   - 至少兩本 `item_copies` 在該 location，且 `status=available`
2) 到 Web Console：`/orgs/:orgId/inventory`
3) 開始盤點（建立 session）
4) 只掃其中一本冊條碼 → 結束盤點
5) 應看到：
   - missing：另一冊（在架但未掃）
6) 再掃一個「不在該 location」或 `status!=available` 的冊
   - unexpected 應出現（並顯示 flags）
7) 下載 CSV：確認 Excel 開啟不亂碼、且有 `diff_type`
8) 到 `/orgs/:orgId/audit-events`：
   - 用 `action=inventory.session_started` / `inventory.session_closed` 查到盤點操作紀錄

---

## 8) 本輪新增/修改的主要檔案

DB：
- `db/schema.sql`

API：
- `apps/api/src/inventory/*`
- `apps/api/src/reports/reports.controller.ts`（新增 inventory-diff）
- `apps/api/src/reports/reports.schemas.ts`
- `apps/api/src/reports/reports.service.ts`

Web：
- `apps/web/app/orgs/[orgId]/inventory/page.tsx`
- `apps/web/app/orgs/[orgId]/layout.tsx`（側欄加 Inventory 連結）
- `apps/web/app/lib/api.ts`（新增 inventory/report API client）

