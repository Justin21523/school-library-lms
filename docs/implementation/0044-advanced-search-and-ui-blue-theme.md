# 0044：進階搜尋（欄位多選 + AND/OR/NOT）與藍白 UI 風格收斂

> 目標：解決「查詢只能靠 id/UUID 不方便」與「OPAC 只有 keyword 不夠用」，並把 topbar 的 UI 設定收斂成單一入口，整體視覺往「白底 + 藍色主色」靠攏。

## 對應需求/痛點（本輪）
- 查詢不應只靠 id：館員/讀者應能用「姓名/書名/條碼/索書號/館別代碼」快速找資料。
- OPAC 書目檢索要支援：欄位選擇、AND/OR/NOT（布林）、常用 metadata（語言、出版年、ISBN、分類號）。
- Topbar 的 UI 設定（主題/字體）太擠：需要收斂成一顆設定按鈕。
- 整體 UI 想走藍白清淡風：白底為主、藍色作為互動與主色。

## API 變更摘要（v1 仍維持 GET + query string）
### 1) 書目查詢：`GET /api/v1/orgs/:orgId/bibs`
新增 query params：
- `search_fields`：逗號分隔欄位集合（例如 `title,author,subject`）
- `must` / `should` / `must_not`：逗號或換行分隔 term 清單（分別對應 AND / OR / NOT）
- `published_year_from` / `published_year_to`：出版年區間
- `language`：語言代碼 prefix（例如 `zh` 命中 `zh-TW`）
- `available_only`：只回傳「目前至少有 1 冊可借」的書目（v1 以 `item_copies.status='available'` 判斷）

實作位置：
- `apps/api/src/bibs/bibs.schemas.ts`：Zod 解析（把逗號/換行拆成陣列）
- `apps/api/src/bibs/bibs.service.ts`：SQL 用 `unnest()` + `bool_and/bool_or` 做布林條件

**Snippet 1：Zod（逗號/換行 → array）**
```ts
// apps/api/src/bibs/bibs.schemas.ts
function splitCommaOrNewlineList(value: unknown): string[] | undefined {
  // ...略
  return trimmed.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
}

export const listBibsQuerySchema = z.object({
  search_fields: z.preprocess(splitCommaOrNewlineList, z.array(bibSearchFieldSchema).min(1).max(20)).optional(),
  must: z.preprocess(splitCommaOrNewlineList, z.array(z.string().trim().min(1).max(200)).min(1).max(50)).optional(),
  should: z.preprocess(splitCommaOrNewlineList, z.array(z.string().trim().min(1).max(200)).min(1).max(50)).optional(),
  must_not: z.preprocess(splitCommaOrNewlineList, z.array(z.string().trim().min(1).max(200)).min(1).max(50)).optional(),
});
```

**Snippet 2：SQL（must/should/must_not 用 bool_and/bool_or）**
```sql
-- apps/api/src/bibs/bibs.service.ts（節錄）
AND (
  $12::text[] IS NULL
  OR COALESCE(
    (
      SELECT bool_and( /* term 逐一比對，所有 term 都要命中 */ )
      FROM unnest($12::text[]) AS term
    ),
    true
  )
)
AND (
  $13::text[] IS NULL
  OR COALESCE(
    (
      SELECT bool_or( /* 至少一個 term 命中 */ )
      FROM unnest($13::text[]) AS term
    ),
    true
  )
)
AND (
  $14::text[] IS NULL
  OR NOT COALESCE(
    (
      SELECT bool_or( /* 任一命中即排除 */ )
      FROM unnest($14::text[]) AS term
    ),
    false
  )
)
```

### 2) items 查詢：`GET /api/v1/orgs/:orgId/items`
新增 query param：
- `query`：模糊搜尋（條碼/索書號/書名/館別）

同時把 list 回傳補齊「可讀欄位」：
- `bibliographic_title` / `bibliographic_isbn` / `bibliographic_classification`
- `location_code` / `location_name`

實作位置：
- `apps/api/src/items/items.schemas.ts`：`query` 驗證
- `apps/api/src/items/items.service.ts`：list 改成 join `bibliographic_records` + `locations`

**Snippet 3：items list join（避免 UI 只剩 UUID）**
```sql
-- apps/api/src/items/items.service.ts（節錄）
SELECT
  i.*,
  b.title AS bibliographic_title,
  l.code  AS location_code,
  l.name  AS location_name
FROM item_copies i
JOIN bibliographic_records b ON b.id = i.bibliographic_id AND b.organization_id = i.organization_id
JOIN locations l            ON l.id = i.location_id      AND l.organization_id = i.organization_id
WHERE i.organization_id = $1
```

### 3) holds / loans 查詢：`GET /api/v1/orgs/:orgId/holds`、`GET /api/v1/orgs/:orgId/loans`
新增 query param：
- `query`：模糊搜尋（姓名/學號/條碼/書名/取書地點）

## DB 索引（讓模糊搜尋更可擴充）
新增 trigram index（支援 `%...%` ILIKE）：
- `items_barcode_trgm`
- `items_call_number_trgm`
- `users_external_id_trgm`
- `users_org_unit_trgm`

另新增常用 btree index（支援 OPAC available_only / bib counts join）：
- `items_org_bib_status`

位置：`db/schema.sql`
（正式環境：`db/migrations/0003_search_indexes.sql`）

## Web / OPAC UI 變更摘要
### 1) OPAC `/opac/orgs/:orgId`
- 新增「搜尋欄位多選」與「進階搜尋（must/should/must_not + ISBN/分類號/出版年/語言/只顯示可借）」。
- 搜尋結果列內顯示作者/出版者/年份/語言/ISBN/分類號（降低只看 id 的依賴）。

**Snippet 4：OPAC 組 filters（欄位 + must/should/must_not）**
```ts
// apps/web/app/opac/orgs/[orgId]/page.tsx（節錄）
const filters = {
  query: query.trim() || undefined,
  search_fields: searchFields.join(','),
  must: must.trim() || undefined,
  should: should.trim() || undefined,
  must_not: mustNot.trim() || undefined,
  isbn: isbn.trim() || undefined,
  classification: classification.trim() || undefined,
  language: language.trim() || undefined,
  published_year_from: fromNumber,
  published_year_to: toNumber,
  available_only: availableOnly ? true : undefined,
  limit: 50,
};
```

### 2) Staff Items `/orgs/:orgId/items`
- 新增 `query` 欄位（書名/條碼/索書號/館別）與 location 下拉選單。
- 列表改顯示 `bib title` 與 `location_code/name`（不再要求看 UUID 才能操作）。

### 3) Staff Loans `/orgs/:orgId/loans`、Staff Holds `/orgs/:orgId/holds`
- 查詢新增 `query` 欄位（模糊搜尋）。
- Holds 的建立預約新增「書目搜尋選取」（避免要求先去複製 UUID）。
- Holds 的建立預約新增「借閱者搜尋選取（姓名/學號/班級）」（避免要求先去 Users 頁找 external_id）。

### 4) Topbar UI 設定收斂
- 新增 `PreferencesMenu`：把主題/字體大小合併成一顆「設定」按鈕。
- 位置：
  - `apps/web/app/components/layout/preferences-menu.tsx`
  - `apps/web/app/components/layout/console-topbar.tsx`
  - `apps/web/app/opac/layout.tsx`

### 5) 藍白清淡風 token 調整
- `apps/web/app/globals.css`：
  - `--bg` 改為白底
  - `--panelMuted` 改為淡藍白
  - `--hover/--active` 改為藍色系互動底色

## 如何驗證
- 本機：`npm run qa:e2e`
  - 會 build/up/seed/跑 Playwright，並輸出：
    - `playwright-report/index.html`
    - `test-results/playwright/qa-summary.md`

## 後續可擴充（你可能會想要的下一步）
- `search_fields` 增加「同義詞/權威詞展開」：把 `subject/geographic/genre` 與 authority terms 的 BT/NT/RT/variants 連動成 OPAC facets。
- 更完整的「嵌套布林」：目前採 must/should/must_not，若要 `(A OR B) AND (C NOT D)` 可升級成 AST 形式（POST /search）。
- items/holds/loans 的 query 進一步做 relevance/ranking（目前以既有排序 + keyset 為主）。
