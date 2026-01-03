# 0041 Web UI：OPAC Holds 重構 + 報表/維護頁首一致化

## 1) 這輪解決什麼問題
- OPAC「我的預約」頁仍是舊版樣式（大量 `<h1>/<h2>` + `<label>` + `<ul>`），跟全站新 UI primitives 不一致。
- 報表/maintenance 類頁面（preview/apply、報表查詢）仍混用各自的頁首與分區樣式，視覺層級不穩定。
- `Link` 想做「主要動作」時常用 `className="btnSmall btnPrimary"`，但因為 `a.btnSmall` 覆蓋了背景/邊框，導致看起來仍是灰底（不夠「主要」）。

## 2) 做了哪些改動（重點檔案）

### 2.1 OPAC：我的預約（Holds）
檔案：`apps/web/app/opac/orgs/[orgId]/holds/page.tsx`
- 改成 `PageHeader` + `FormSection` + `DataTable` + `CursorPagination`（跟 OPAC Loans / OPAC 搜尋頁一致）。
- 取消動作改成 `DataTable.rowActions`（queued/ready 才顯示 `btnDanger`）。
- 狀態用 badge 呈現（queued/ready/expired…），讓讀者更快判讀。
- 登入門檻維持原本策略：
  - 已登入：走安全的 `/me/holds`（PatronAuthGuard）
  - 未登入：保留 `user_external_id`（過渡模式，UI 以 warning 明示風險）

### 2.2 OPAC：登出頁（Logout）
檔案：`apps/web/app/opac/orgs/[orgId]/logout/page.tsx`
- 改成 `PageHeader` + `Alert`，並把「回搜尋 / 前往登入」收斂成 `btnSmall` actions。

### 2.3 報表 / 維護頁：PageHeader / SectionHeader 一致化
- `apps/web/app/orgs/[orgId]/reports/circulation-summary/page.tsx`
- `apps/web/app/orgs/[orgId]/reports/ready-holds/page.tsx`
- `apps/web/app/orgs/[orgId]/holds/maintenance/page.tsx`
- `apps/web/app/orgs/[orgId]/loans/maintenance/page.tsx`

調整方向：
- 把頁首統一改成 `PageHeader`（title/description/actions/全域訊息）。
- 把段落標題統一改成 `SectionHeader`（查詢/結果/Preview/Apply）。
- 移除各頁自訂的 `<hr style=...>`，避免每頁視覺密度與分隔線不一致。

### 2.4 Button 視覺：讓 Link 也能正確呈現 Primary/Danger
檔案：`apps/web/app/globals.css`
- 新增 `a.btnSmall.btnPrimary` / `a.btnSmall.btnDanger` 覆蓋規則：
  - 讓 `Link` 也能有明確的主動作/危險動作視覺層級（不再被 `a.btnSmall` 灰底覆蓋）。
- 新增 `.field--narrow`（供 limit 這類小欄位使用，版面更乾淨）。

## 3) 如何驗證
- Build：`npm run build -w @library-system/web`
- 手動：
  - `/opac/orgs/:orgId/holds`：查詢表單/結果表格/取消 action、loading/empty state
  - `/orgs/:orgId/reports/circulation-summary`：PageHeader/查詢/結果的層級一致
  - `/orgs/:orgId/reports/ready-holds`：PageHeader actions、查詢/結果分區、badge 顯示
  - `/orgs/:orgId/holds/maintenance`、`/orgs/:orgId/loans/maintenance`：Preview/Apply 的分區一致，主要按鈕樣式一致

## 4) 下一步（建議）
- 以同樣手法把 `authority-terms` list/detail 與 thesaurus visual editor 的 toolbar/card sections 做一致化（你提的「更圖形化」方向）。
- 把更多「主要動作」逐頁收斂成 `btnPrimary/btnDanger`（新增/儲存/套用/刪除），並用 `btnSmall` 控制密度。
