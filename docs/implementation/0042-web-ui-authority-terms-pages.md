# 0042 Web UI：Authority Terms（主檔）列表/詳情頁一致化

## 1) 目標
把「權威詞主檔」變成真正的治理入口（不再只是資料列表）：
- 統一全站的 `PageHeader / SectionHeader / FormSection / DataTable / EmptyState / Skeleton` 視覺與操作。
- 讓使用者在 **Terms list** 與 **Term detail** 都能清楚看見：
  - 目前治理範圍（kind/status/vocabulary_code）
  - 下一步入口（Thesaurus Browser/Quality/Visual、Bibs term_id 過濾）
  - 主要動作（新增、啟用/停用、merge/新增關係）

## 2) 變更摘要（重點檔案）

### 2.1 Authority Terms 列表
檔案：`apps/web/app/orgs/[orgId]/authority-terms/page.tsx`
- 頁首改成 `PageHeader`：
  - 顯示 org / 登入者 / 目前範圍（badge）
  - 主要 actions：回主控入口、新增款目、Dashboard
- filters 與 create 改成雙欄（`grid2`）卡片式 layout：
  - 左：搜尋/篩選（自動 refresh + 手動 refresh）
  - 右：建立新款目（anchor `#create`）
- Thesaurus 快捷入口：
  - 只有 `subject/geographic/genre` 才顯示 Browser/Quality/Visual（自動帶 `kind` + `vocabulary_code`）
- DataTable 改用 `rowActions`（把操作統一放到右側 actions 欄）：
  - row click 直接進 term detail（`getRowHref`）
  - actions：詳情 / 編輯 / 啟用/停用（`btnPrimary/btnDanger`）
- 編輯面板改成 `SectionHeader`（含關閉/開啟詳情 actions）

### 2.2 Authority Term 詳情
檔案：`apps/web/app/orgs/[orgId]/authority-terms/[termId]/page.tsx`
- 頁首改成 `PageHeader`：
  - title 直接顯示 preferred_label + kind/status badge
  - actions：重新整理、回 Terms（帶 kind）、主控入口、Bibs 過濾（term_id-driven）、Visual（hierarchy kind 才顯示）
  - 內嵌 toolbar：Thesaurus Browser/Quality/Visual（自動帶 kind/vocabulary_code）
- 主要段落全部改成 `SectionHeader`（款目資訊/usage/merge/breadcrumbs/graph/relations/新增關係/expand）
- suggestions（merge target / relation target）改用共用 `list/listRow` 樣式（更像可點選的清單）
- JSON 檢視改用共用 `details/detailsBody` 樣式（避免每頁 details 長相不一致）
- `<hr style=...>` 改用 `hr.divider`

## 3) 如何驗證
- Build：`npm run build -w @library-system/web`
- 手動：
  - `/orgs/:orgId/authority-terms`：filters/create/list/edit actions、Thesaurus 快捷入口
  - `/orgs/:orgId/authority-terms/:termId`：PageHeader actions、merge/relations 的 suggestion list 與 details JSON

## 4) 下一步（建議）
- 把 `Authority Control 主頁` 的「kind 切換」做成更圖形化的 tabs/chips（並同步 URL query），減少下拉依賴。
- 針對 term detail 的「新增關係 / merge」表單，把目前的 `<label>` 區塊逐步收斂成 `FormSection + Field`（錯誤/提示位置更一致）。
