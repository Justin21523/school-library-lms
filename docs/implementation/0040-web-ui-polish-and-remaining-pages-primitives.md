# 0040 — Web UI 美化與收斂：Button Variants / DataTable 進階視覺 / Circulation・Inventory・CSV Import 統一

延續：
- `0037-web-ui-primitives-tables-forms-and-states.md`
- `0038-web-ui-authority-and-reports-primitives-apply.md`
- `0039-web-ui-reports-maintenance-and-marc-primitives-apply.md`

本輪的目標是把「剩下仍偏 MVP 粗糙」的核心工作台頁面也一起收斂，並補齊更明確的視覺線索（visual cues），讓 UI 更漂亮、也更不容易誤操作：

- 全站：新增 `btnPrimary/btnDanger`、`divider`、DataTable 的 sticky header + zebra stripe、`prefers-reduced-motion` 支援。
- Console 工作台：`/circulation`、`/inventory` 改用同一套 `Alert / FormSection / DataTable / EmptyState`。
- CSV 匯入：`/bibs/import`、`/users/import` 也完全套用 primitives，並把 `<table>` 全數收斂到 `DataTable`。

---

## 1) 視覺與互動強化（CSS cues）
檔案：`apps/web/app/globals.css`

### 1.1 Button variants（主要動作更清楚）
新增 tokens 與 class：
- tokens：`--primaryBg/*...*/`、`--dangerSolid/*...*/`（含 dark theme 覆蓋）
- classes：`.btnPrimary` / `.btnDanger`（可與 `.btnSmall` 疊加）

範例：
```css
.btnPrimary {
  border-color: var(--primaryBorder);
  background: var(--primaryBg);
  color: var(--primaryText);
}
```

### 1.2 DataTable：sticky header + zebra stripe
目的：讓「寬表格」更好掃描，尤其是匯入 preview、盤點差異清單、掃描歷史。

```css
.dataTable th {
  position: sticky;
  top: 0;
  z-index: 2;
}
.dataTable tbody tr:nth-child(even) td {
  background: var(--tableStripe);
}
```

### 1.3 可及性：尊重 `prefers-reduced-motion`
目的：避免轉場/動畫對敏感使用者造成不適；同時不影響一般使用者的微互動。

---

## 2) 頁面收斂（不再混用原生 `<table>` / `<label>`）

### 2.1 Circulation（借還/取書借出）
檔案：`apps/web/app/orgs/[orgId]/circulation/page.tsx`
- `error/success` → `Alert`
- 三段表單（Fulfill/Checkout/Check-in）→ `FormSection + Field + FormActions`
- `ready holds candidates` 表格 → `DataTable`
- 主要動作按鈕套 `btnPrimary`

### 2.2 Inventory（盤點工作台）
檔案：`apps/web/app/orgs/[orgId]/inventory/page.tsx`
- Login/狀態訊息統一為 `Alert`
- sessions 篩選 + 選擇 → `FormSection`
- scan / close session / diff 產出 → `FormSection`
- scan history / missing / unexpected → `DataTable` + badge flags
- inline `<hr>` → `hr.divider`

### 2.3 Catalog CSV Import（書目/冊匯入）
檔案：`apps/web/app/orgs/[orgId]/bibs/import/page.tsx`
- 三段（來源/選項/preview-apply）全部改用 `FormSection`
- preview rows `<table>` → `DataTable`
- apply：UI 上要求「先 preview 且無 errors」才可按（降低誤操作）
- 重要資訊用 `Alert` 與 `details` 收合呈現（errors、列錯誤）

### 2.4 Users CSV Import（名冊匯入）
檔案：`apps/web/app/orgs/[orgId]/users/import/page.tsx`
- 來源/選項/roster sync/preview-apply 全改用 `FormSection`
- preview rows `<table>` → `DataTable`，to_deactivate_preview 也改成 `DataTable`
- `bgSubtle`（未定義 token）移除，改用統一容器/提示樣式
- `error/success/apply result/import errors` 全改成 `Alert`

---

## 3) 如何驗證
- Typecheck：`npx tsc -p apps/web/tsconfig.json --noEmit`
- Build：`npm run build -w @library-system/web`
- 手動：
  - `/orgs/:orgId/circulation`：Fulfill 候選表格、三段表單、訊息提示一致
  - `/orgs/:orgId/inventory`：scan history / diff tables 的 sticky header + stripe、旗標 badge
  - `/orgs/:orgId/bibs/import`：preview rows 表格、apply 前條件提示與按鈕狀態
  - `/orgs/:orgId/users/import`：preview rows/to_deactivate 表格、roster sync 設定與警告

---

## 4) 下一步（建議）
- 把 `btnPrimary/btnDanger` 套用到更多「明確主動作」：新增/儲存/套用/刪除（逐頁收斂，避免一次大改）。
- 針對 `DataTable` 追加 v2：row action（右側 actions）、row click、density（compact）選項。
- 做一個「通用 Preview/Apply 框架元件」：把 warning/confirm/loading/empty/report download 收斂成一個可重用 pattern。

