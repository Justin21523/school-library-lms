# 實作說明 0014：取書架清單（Ready Holds）＋ CSV 匯出＋列印小條

本文件說明我在第 14 輪新增的「櫃台每日工作」報表：**取書架清單（Ready Holds）**。它把 `holds.status=ready` 的資料整理成「可直接使用的清單」，並提供：
- **JSON 查詢**：給 Web Console 顯示（可篩取書地點、可選 as_of）
- **CSV 匯出（含 Excel 友善 BOM）**：方便每天留存、交接、或做紙本流程
- **列印小條（print slips）**：在現場把小條塞進書裡或貼在取書架分格（多數學校仍會用）

> 這一題的價值很高：因為「預約到書」後，現場真正每天在用的不是 CRUD，而是「一張清單」。我們把它做成 `/reports/*` 風格，等於也把「報表/匯出」的共通架構再多驗證一次。

---

## 1) 需求與場景（為什麼要做這張表）

在本專案的 Holds 流程中：
- `queued`：排隊中
- `ready`：可取書（已指派冊、冊通常為 `on_hold`）
- `fulfilled`：已取書借出（已建立 loan）
- `cancelled` / `expired`：已取消 / 取書逾期

`ready` 的本質就是「取書架」：
- 書已經在館內，並被保留給某位讀者
- 館員需要知道：**哪本書要給誰、到期日是什麼、放在哪個取書地點**

因此我們新增「Ready Holds 報表」來解決三個現場問題：
1) **每日取書架清單**（櫃台照清單找書/找人）
2) **可視化已過期但仍卡在 ready 的 hold**（提醒跑到期處理）
3) **CSV/列印**（學校常見紙本交接、留存、貼條）

---

## 2) API 契約（Reports 模式：同端點 JSON/CSV）

新增端點：
- `GET /api/v1/orgs/:orgId/reports/ready-holds?actor_user_id=...&as_of=...&pickup_location_id=...&limit=...&format=json|csv`

權限（MVP 最小控管）：
- `actor_user_id` 必填，後端驗證必須是 `admin/librarian` 且 `active`

query params：
- `as_of`：可選（timestamptz 字串），用來推導 `is_expired`/`days_until_expire`
- `pickup_location_id`：可選（UUID），用於「多取書地點」分開拉清單
- `limit`：可選（預設 200；上限 5000）
- `format`：可選 `json|csv`（預設 `json`；`csv` 會回 `text/csv` + `Content-Disposition` 觸發下載）

對應文件：`API-DRAFT.md` 已補上 9.3 節。

---

## 3) 後端實作（為什麼用推導欄位，而不是存狀態）

### 3.1 Schema：新增 ready-holds report query

`apps/api/src/reports/reports.schemas.ts`
```ts
export const readyHoldsReportQuerySchema = z.object({
  actor_user_id: uuidSchema,
  as_of: z.string().trim().min(1).max(64).optional(),
  pickup_location_id: uuidSchema.optional(),
  limit: intFromStringSchema.optional(),
  format: reportFormatSchema.optional(),
});
```

關鍵取捨：
- `as_of` 用字串驗證（讓 Postgres 解析 timestamptz），錯誤統一由 DB error code 轉成 400
- `format` 沿用 reports 共通規則（同端點切 json/csv）

### 3.2 Service：SQL 直接算出 `is_expired` / `days_until_expire`

`apps/api/src/reports/reports.service.ts`
```ts
CASE
  WHEN h.ready_until IS NULL THEN false
  ELSE (h.ready_until < $2::timestamptz)
END AS is_expired,

CASE
  WHEN h.ready_until IS NULL THEN NULL
  ELSE FLOOR(EXTRACT(EPOCH FROM (h.ready_until - $2::timestamptz)) / 86400)::int
END AS days_until_expire,
```

為什麼不存 `is_expired` 狀態？
- 與逾期（overdue）一致：**用時間比較推導，不用額外狀態**，避免「狀態忘了更新」造成資料不一致。
- `days_until_expire` 可以是負數，代表「已過期幾天仍卡在 ready」；這對現場提醒很有用。

### 3.3 Controller：CSV 下載 header（含檔名）

`apps/api/src/reports/reports.controller.ts`
```ts
res.setHeader('content-type', 'text/csv; charset=utf-8');
res.setHeader('content-disposition', `attachment; filename="ready-holds-${safeAsOf}.csv"`);
res.setHeader('cache-control', 'no-store');
```

CSV 的 BOM 策略沿用既有報表：讓 Excel 在中文環境更穩定顯示 UTF-8。

---

## 4) 前端實作（查詢＋CSV＋列印小條）

### 4.1 Web → API client

`apps/web/app/lib/api.ts`
- 新增 `ReadyHoldsReportRow` 型別
- 新增 `listReadyHoldsReport()` / `downloadReadyHoldsReportCsv()`

### 4.2 Web Console 報表頁

新增頁面：
- `/orgs/:orgId/reports/ready-holds`

頁面提供：
- `actor_user_id`（必填）
- `as_of`（本地時間輸入 → 轉 ISO 傳後端）
- `pickup_location_id`（可選；預設第一個 active location）
- `下載 CSV`
- `列印小條`

### 4.3 列印小條：為什麼用「新視窗 + 自動 print」

`apps/web/app/orgs/[orgId]/reports/ready-holds/page.tsx`
```ts
const win = window.open('', '_blank', 'noopener,noreferrer');
// ... fetch rows ...
win.document.write(html);
// html 裡在 load 後 window.print()
```

設計理由：
- 讓列印輸出使用「白底黑字」，避免深色主題印出來浪費墨水
- 把列印版面與 Web Console UI 分離（避免 @media print 影響全站）
- 為了避免 popup blocker：先同步開窗，再做 async fetch（這是瀏覽器常見限制）

---

## 5) 如何驗證（建議路徑）

前置：
1. `docker compose up -d postgres redis`
2. 匯入 `db/schema.sql`
3. `npm run dev`

建議驗證流程：
1) 建立 org / locations / users（至少 librarian）
2) 建立 bib + items
3) 建立 holds 並讓它們進入 `ready`（例如：該書目有 available item 時建立 hold 會自動 ready）
4) 到 `/orgs/:orgId/reports/ready-holds`
   - 查詢應看到 ready holds
   - 下載 CSV 應能開啟且中文不亂碼（BOM）
   - 列印小條應開新視窗並觸發列印
5) 若看到 `is_expired=true`：
   - 到 `/orgs/:orgId/holds/maintenance` 執行到期處理（preview → apply）
   - 回來重新查 ready-holds，過期筆數應下降

---

## 6) 本輪新增/修改的主要檔案

API：
- `apps/api/src/reports/reports.schemas.ts`
- `apps/api/src/reports/reports.controller.ts`
- `apps/api/src/reports/reports.service.ts`

Web：
- `apps/web/app/lib/api.ts`
- `apps/web/app/orgs/[orgId]/layout.tsx`
- `apps/web/app/orgs/[orgId]/reports/ready-holds/page.tsx`

Docs：
- `API-DRAFT.md`
- `README.md`
- `docs/README.md`
- `docs/implementation/0014-ready-holds-report-and-print-slips.md`

