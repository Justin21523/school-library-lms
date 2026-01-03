# 0038 — Web UI 套用：Authority Terms + Reports（表格/表單/狀態一致化）

延續 `0037-web-ui-primitives-tables-forms-and-states.md`，本輪把同一套 UI primitives（DataTable / CursorPagination / EmptyState / Skeleton / FormSection / Alert）進一步套用到：
- Authority Terms（主檔列表 + term detail usage）
- Reports（Top Circulation、Zero Circulation）

目標：讓「治理主工作流」與「高頻報表」也有一致的視覺與操作語言，降低學習成本與維護成本。

---

## 1) 變更摘要

### 1.1 Authority Terms 列表頁：改為表格 + 編輯面板
檔案：`apps/web/app/orgs/[orgId]/authority-terms/page.tsx`
- 款目列表：改用 `DataTable`（可排序、欄位對齊一致）
- 分頁：改用 `CursorPagination`（顯示 showing/next_cursor）
- 狀態：loading 用 `SkeletonTable`、空資料用 `EmptyState`
- 表單：filters / create / edit 全改用 `FormSection + Field + FormActions`
- 編輯 UX：從「row 內嵌表單」改成「列表下方的編輯面板」
  - 好處：列表更可掃描，不會每列被表單撐爆
  - 仍保留一次只編輯一筆的保守策略（避免治理誤操作）

### 1.2 Authority Term detail：usage 改成表格（含分頁）
檔案：`apps/web/app/orgs/[orgId]/authority-terms/[termId]/page.tsx`
- 頁首訊息：error/success 改用 `Alert`
- 「編修 term」：改用 `FormSection`（維持原本的 PATCH payload 最小化策略）
- Usage：
  - 改用 `DataTable` 顯示書目使用清單
  - `CursorPagination` 取代手刻 Load more
  - loading 用 `SkeletonTable`，usage 尚未載入/無資料用 `EmptyState`

### 1.3 Reports：Top Circulation / Zero Circulation 結果表格統一
檔案：
- `apps/web/app/orgs/[orgId]/reports/top-circulation/page.tsx`
- `apps/web/app/orgs/[orgId]/reports/zero-circulation/page.tsx`

重點：
- 登入門檻：用 `Alert`（danger）
- 查詢條件：用 `FormSection` + `grid3`
- 結果：
  - loading 用 `SkeletonTable`
  - 尚未查詢 / 無資料：用 `EmptyState`
  - 表格：用 `DataTable`（可排序、對齊一致）
- `#（API rank）` 用 `useMemo()` 固定住原始排行，避免使用者切排序後「順位」語意混亂

---

## 2) 如何驗證
- Typecheck：`npx tsc -p apps/web/tsconfig.json --noEmit`
- Build：`npm run build -w @library-system/web`
- 手動：
  - `/orgs/:orgId/authority-terms`：切 kind/status/query → 列表為表格 + 可排序；按 actions「編輯」→ 下方出現編輯面板
  - `/orgs/:orgId/authority-terms/:termId`：Usage 以表格顯示、Load more 變成統一 pagination bar
  - `/orgs/:orgId/reports/top-circulation`：查詢後表格可排序、可下載 CSV
  - `/orgs/:orgId/reports/zero-circulation`：查詢後表格可排序、可下載 CSV

---

## 3) 下一步（建議）
- 把 `circulation-summary`、`ready-holds`、`overdue` 等報表頁也改成 DataTable（大量 `<table>` 可逐頁收斂）
- 把 `maintenance/*`（尤其有 preview/apply 的頁面）套用同一套 Alert + EmptyState + Skeleton（批次作業更需要一致的安全提示）

