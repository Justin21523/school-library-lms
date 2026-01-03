# 0039 — Web UI 套用：Reports（剩餘）/ Maintenance / MARC Pages（表格/表單/狀態一致化）

延續：
- `0037-web-ui-primitives-tables-forms-and-states.md`
- `0038-web-ui-authority-and-reports-primitives-apply.md`

本輪把「你指定的 A/B/C」依序收斂到同一套 UI primitives（`DataTable` / `FormSection` / `Alert` / `EmptyState` / `Skeleton`）：

- A) 報表頁剩餘 `<table>` → `DataTable`
- B) maintenance / preview-apply 類頁面：warning/empty/loading 統一
- C) MARC dictionary / MARC import：表格與表單套同一套樣式

目標：讓館員在「查詢 → 批次作業 → MARC/字典」之間切換時，視覺與互動語言一致，降低操作誤差與學習成本。

---

## 1) 變更摘要

### 1.1 Reports：circulation-summary / ready-holds
檔案：
- `apps/web/app/orgs/[orgId]/reports/circulation-summary/page.tsx`
- `apps/web/app/orgs/[orgId]/reports/ready-holds/page.tsx`

重點：
- 結果表格：`<table>` → `DataTable`（欄位對齊一致、可排序）
- 查詢參數：改用 `FormSection + Field + FormActions`（避免每頁手刻 label/spacing）
- 狀態：
  - loading：`SkeletonTable`
  - 尚未查詢 / 0 筆：`EmptyState`
  - 錯誤：`Alert danger`
- `#（API rank）` 以 `useMemo()` 固定原始排行（避免排序後順位語意混亂）

### 1.2 Maintenance：holds / loans（preview/apply）
檔案：
- `apps/web/app/orgs/[orgId]/holds/maintenance/page.tsx`
- `apps/web/app/orgs/[orgId]/loans/maintenance/page.tsx`

重點：
- 參數輸入：`FormSection`（含清楚的不可逆/先 preview 的 `Alert warning`）
- Preview/Apply 結果：統一用 `DataTable`（含固定 rank 的欄位）
- 狀態：
  - previewing/applying：`Alert info` + `SkeletonTable`
  - 空結果：`EmptyState`
  - 成功/錯誤：`Alert success/danger`

### 1.3 Bibs maintenance：backfill-*(subject/name/geographic/genre)
檔案：
- `apps/web/app/orgs/[orgId]/bibs/maintenance/backfill-subject-terms/page.tsx`
- `apps/web/app/orgs/[orgId]/bibs/maintenance/backfill-name-terms/page.tsx`
- `apps/web/app/orgs/[orgId]/bibs/maintenance/backfill-geographic-terms/page.tsx`
- `apps/web/app/orgs/[orgId]/bibs/maintenance/backfill-genre-terms/page.tsx`

重點：
- 參數區：`FormSection + Field + FormActions`
- preview 提醒：用 `Alert warning`（強調 preview term id 只是 transaction 內預覽用）
- 狀態：loading 用 `Alert info` + `SkeletonText`；0 rows 用 `EmptyState`
- 報表下載/next_cursor：維持原功能，但呈現更一致

### 1.4 MARC Dictionary：搜尋/清單/子欄位表格統一
檔案：`apps/web/app/orgs/[orgId]/bibs/marc-dictionary/page.tsx`

重點：
- 搜尋：改用 `FormSection + Field`
- 欄位清單：改用 `DataTable`（tag/label/kind/repeatable；並用 badge 標示 selected）
- Subfields：原生 `<table>` → `DataTable`
- 詳情摘要：用 `Alert info`（避免一頁混用多種訊息容器）

### 1.5 MARC Import：表單容器/狀態/預覽表格統一 + apply 結果可視化
檔案：`apps/web/app/orgs/[orgId]/bibs/import-marc/page.tsx`

重點：
- 來源檔案、匯入選項、草稿映射：全部改用 `FormSection + Field`
- 狀態：解析/預覽/套用 → `Alert info` + `SkeletonText`；錯誤/成功 → `Alert danger/success`
- Preview results：`<table>` → `DataTable`（並保留 decision select）
- Apply results：新增 `applyResult` 顯示（summary + per-record 結果表）
- Warnings/Errors JSON：改用 `details.details`（更一致、可收合）

---

## 2) 如何驗證
- Typecheck：`npx tsc -p apps/web/tsconfig.json --noEmit`
- Build：`npm run build -w @library-system/web`
- 手動檢查：
  - Reports：`/orgs/:orgId/reports/circulation-summary`、`/orgs/:orgId/reports/ready-holds`
  - Maintenance：`/orgs/:orgId/holds/maintenance`、`/orgs/:orgId/loans/maintenance`
  - MARC：`/orgs/:orgId/bibs/marc-dictionary`、`/orgs/:orgId/bibs/import-marc`

---

## 3) 下一步（建議）
- 把其餘仍有 `<table>` 的頁面逐步收斂（例如 circulation / inventory / CSV import / users import），讓整站表格互動一致。
- 把 preview/apply 類頁面補上「危險動作二次確認」的共用元件（避免每頁各自 `window.confirm`）。
- 若要再往 UX 提升：讓 `DataTable` 支援 row highlight / row action（對於字典瀏覽器、治理清單會更直覺）。

