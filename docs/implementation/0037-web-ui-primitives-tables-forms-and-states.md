# 0037 — Web UI 統一化：列表/表格 + 分頁/空狀態/骨架 + 表單容器

你要求 UI/UX 往「更人性化、可擴充」方向走，因此這一輪先做 **全站可重用的 UI primitives**，把最常見的互動樣式統一：
- 列表/表格：一致的表頭、欄位對齊、hover、client-side sorting（先對「已載入資料」）
- 分頁：cursor pagination 的 meta + Load more（避免每頁手刻）
- 狀態：空狀態（EmptyState）、載入骨架（Skeleton）
- 表單：段落/欄位/動作列（FormSection / Field / FormActions）與一致的錯誤呈現（Alert）

> 這輪的目標不是「把所有頁面一次改完」，而是先建立一套可持續擴張的元件與 CSS token，接著用同一套語言逐頁套用。

---

## 1) 變更摘要

### 1.1 新增 UI primitives（可重用元件）
檔案（新增）：
- `apps/web/app/components/ui/alert.tsx`
- `apps/web/app/components/ui/empty-state.tsx`
- `apps/web/app/components/ui/skeleton.tsx`
- `apps/web/app/components/ui/cursor-pagination.tsx`
- `apps/web/app/components/ui/data-table.tsx`
- `apps/web/app/components/ui/form.tsx`

### 1.2 CSS tokens + 樣式骨架（Light/Dark 都支援）
檔案（更新）：
- `apps/web/app/globals.css`

重點：
- 新增 alerts / skeleton 的 tokens（避免每頁手寫 RGBA）
- 新增 `.dataTable` / `.paginationBar` / `.emptyState` / `.formSection` 等共用 class

### 1.3 套用到核心頁面（先從高頻工作流下手）
檔案（更新）：
- `apps/web/app/orgs/page.tsx`（orgs 列表 + 建立表單）
- `apps/web/app/orgs/[orgId]/bibs/page.tsx`（bibs 結果列表）
- `apps/web/app/orgs/[orgId]/items/page.tsx`（items 結果列表 + 篩選表單）
- `apps/web/app/orgs/[orgId]/loans/page.tsx`（loans 結果列表 + 查詢表單 + renew action）

---

## 2) 關鍵程式碼片段

### 2.1 DataTable：欄位定義 + sortValue（只排序已載入資料）
檔案：`apps/web/app/components/ui/data-table.tsx`

```ts
export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
};
```

在頁面中使用（例：bibs）：
檔案：`apps/web/app/orgs/[orgId]/bibs/page.tsx`

```tsx
<DataTable
  rows={bibs}
  getRowKey={(b) => b.id}
  initialSort={{ columnId: 'title', direction: 'asc' }}
  sortHint="排序僅影響目前已載入資料（cursor pagination）。"
  columns={[
    { id: 'title', header: 'title', cell: (b) => <Link ...>{b.title}</Link>, sortValue: (b) => b.title },
    { id: 'isbn', header: 'isbn', cell: (b) => b.isbn ?? '(none)', sortValue: (b) => b.isbn ?? '' },
  ]}
/>
```

### 2.2 CursorPagination：統一 next_cursor 的 meta + Load more
檔案：`apps/web/app/components/ui/cursor-pagination.tsx`

```tsx
<CursorPagination
  showing={items.length}
  nextCursor={nextCursor}
  loadingMore={loadingMore}
  loading={loading}
  onLoadMore={() => void loadMore()}
/>
```

### 2.3 Form primitives：FormSection / Field / FormActions
檔案：`apps/web/app/components/ui/form.tsx`

```tsx
<Form onSubmit={onFilter}>
  <FormSection title="篩選" description="所有條件皆為選填。">
    <Field label="barcode" htmlFor="items_barcode">
      <input id="items_barcode" ... />
    </Field>
    <FormActions>
      <button type="submit">查詢</button>
      <button type="button">清除</button>
    </FormActions>
  </FormSection>
</Form>
```

---

## 3) 如何驗證
- Typecheck：`npx tsc -p apps/web/tsconfig.json --noEmit`
- Build：`npm run build -w @library-system/web`
- 手動（建議順序）：
  - `/orgs`：建立 org + 列表呈現（空狀態/載入骨架/排序）
  - `/orgs/:orgId/items`：篩選 + 列表 + Load more
  - `/orgs/:orgId/loans`：查詢 + renew（actions 欄）+ Load more
  - `/orgs/:orgId/bibs`：結果表格 + Load more

---

## 4) 下一步（建議）
- 把 `authority-terms`、reports、maintenance 等頁面逐步套到同一套 primitives（避免 UI 漂移）
- 若要「真正全量排序」：
  - API 增加 `sort_by/sort_dir`（並用 index 支援）
  - Web 把 sort state 變成 query params，交由 DB 做排序（搭配 cursor pagination）

