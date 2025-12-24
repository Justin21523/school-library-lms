# 0012 — US-050 熱門書 + 借閱量彙總（API + Web + CSV）

本篇把 `USER-STORIES.md` 的 **US-050 熱門書與借閱量** 落地成一套「可查、可匯出」的報表骨架，並沿用我們在 US-044（逾期清單）建立的 reports/CSV 模式：

- API（NestJS）
  - `GET /api/v1/orgs/:orgId/reports/top-circulation`：熱門書（Top Circulation）
  - `GET /api/v1/orgs/:orgId/reports/circulation-summary`：借閱量彙總（Circulation Summary）
  - 兩者都支援 `format=json|csv`（CSV 會加 BOM，Excel 友善）
- Web Console（Next.js）
  - `/orgs/:orgId/reports/top-circulation`
  - `/orgs/:orgId/reports/circulation-summary`

> 為什麼先做這兩個？因為它們是學校現場最常拿來做「閱讀推廣 / 補書決策 / 校內成果」的日常報表，而且能把「報表/匯出」的基礎架構穩定化。

---

## 1) 對照 user story（驗收條件）

`USER-STORIES.md` → **US-050 熱門書與借閱量**
- 驗收：可選期間（日/週/月/學期）
- 驗收：可匯出 CSV

本輪實作對應：
- 期間（學期）＝由使用者在 UI 選擇 `from/to`（例如 113-1 的起訖）
- 日/週/月 ＝ `group_by=day|week|month`（借閱量彙總使用）
- CSV 匯出 ＝ `format=csv` + `UTF-8 BOM` + `Content-Disposition`（下載）

---

## 2) API 設計

### 2.1 報表共同原則（沿用 US-044）
- 報表端點通常包含較敏感的行為資料，因此 **MVP 仍要求 `actor_user_id`**（admin/librarian）
- 同一個 endpoint 支援 JSON/CSV：
  - `format=json`（預設）：回傳 JSON，給 Web Console 顯示
  - `format=csv`：回傳 `text/csv`，並加 BOM 方便 Excel

### 2.2 熱門書（Top Circulation）
- Endpoint：`GET /orgs/{orgId}/reports/top-circulation`
- Query：
  - `actor_user_id`：必填（admin/librarian）
  - `from/to`：必填（timestamptz；ISO 8601）
  - `limit`：選填（預設 50）
  - `format`：選填（json/csv）
- Response（JSON）：
  - `bibliographic_id`
  - `bibliographic_title`
  - `loan_count`：期間內借出次數（COUNT loans）
  - `unique_borrowers`：期間內借閱人數（COUNT DISTINCT user_id）

### 2.3 借閱量彙總（Circulation Summary）
- Endpoint：`GET /orgs/{orgId}/reports/circulation-summary`
- Query：
  - `actor_user_id`：必填（admin/librarian）
  - `from/to`：必填
  - `group_by`：必填（`day|week|month`）
  - `format`：選填（json/csv）
- Response（JSON）：
  - `bucket_start`：該 bucket 起始時間（UTC ISO）
  - `loan_count`：該 bucket 借出筆數

---

## 3) 後端實作導讀（NestJS）

### 3.1 Schemas（Zod）
檔案：`apps/api/src/reports/reports.schemas.ts`
- 新增：
  - `topCirculationReportQuerySchema`
  - `circulationSummaryReportQuerySchema`
- 仍沿用 `reportFormatSchema`（json/csv）

### 3.2 Controller（format=csv 的回應 header）
檔案：`apps/api/src/reports/reports.controller.ts`
- 兩個新端點都沿用 Overdue 的模式：
  1. 先查 rows（JSON 同用）
  2. `format=csv` 時呼叫 service 的 `build...Csv()`
  3. 設定：
     - `content-type: text/csv; charset=utf-8`
     - `content-disposition: attachment; filename="..."`

### 3.3 Service（SQL + CSV builder）
檔案：`apps/api/src/reports/reports.service.ts`

#### 熱門書 SQL（核心概念）
- 統計母體：`loans`（借出交易）
- 期間條件：`checked_out_at BETWEEN from AND to`
- join：`loans -> item_copies -> bibliographic_records`
- group：以 `bibliographic_records` 為單位

#### 借閱量彙總 SQL（核心概念）
為了讓 Excel/圖表不會「中間缺洞」，我們用 `generate_series` 先產生 bucket，再 LEFT JOIN 借出筆數：
- `buckets`：用 `date_trunc(group_by, from/to)` + `generate_series(...)`
- `counts`：聚合 `COUNT(*)` by `date_trunc(group_by, checked_out_at)`
- `LEFT JOIN`：補 0

#### 安全防呆（避免超大區間）
因為 `generate_series` 會產生「每個 bucket 一列」，若使用者選了太長期間可能導致大量輸出，本輪在 service 做了 1000 bucket 上限：
- day：約 2.7 年
- week：約 19 年
- month：約 83 年

---

## 4) 前端實作導讀（Next.js Web Console）

### 4.1 新增頁面
- 熱門書：`apps/web/app/orgs/[orgId]/reports/top-circulation/page.tsx`
  - 選 actor（admin/librarian）
  - 選 from/to + limit
  - 查詢 + 下載 CSV
  - title 可點進書目詳情 `/bibs/:bibId`
- 借閱量彙總：`apps/web/app/orgs/[orgId]/reports/circulation-summary/page.tsx`
  - 選 actor
  - 選 from/to + group_by
  - 提供「近 7 天/30 天/180 天（約一學期）」快速按鈕

### 4.2 API Client 擴充
檔案：`apps/web/app/lib/api.ts`
- 新增型別：
  - `TopCirculationRow`
  - `CirculationSummaryRow`
- 新增呼叫：
  - `listTopCirculationReport()` / `downloadTopCirculationReportCsv()`
  - `listCirculationSummaryReport()` / `downloadCirculationSummaryReportCsv()`

---

## 5) DB 索引（效能）

因為這兩個報表都會用 `loans.checked_out_at` 做期間查詢，本輪在 `db/schema.sql` 新增：
- `CREATE INDEX loans_org_checked_out_at ON loans (organization_id, checked_out_at);`

目的：
- 讓「指定期間」的掃描更快（尤其資料量大時差異很明顯）

---

## 6) 如何手動驗證

1) 先確保有資料：
- 建立 org / users / policies / bib / item
- 做幾筆 checkout（會建立 loans）

2) 啟動 Web：
- `npm run dev:web`

3) 到 Web Console：
- `/orgs/:orgId/reports/top-circulation`
- `/orgs/:orgId/reports/circulation-summary`

4) 下載 CSV：
- 檢查 Excel 打開是否正常顯示中文（BOM 目的）

