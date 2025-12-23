# 實作說明 0002：書目與館藏冊（bibliographic_records / item_copies）

本文件說明我在第二輪實作完成的「書目/冊 CRUD + 基本搜尋」，包含設計取捨、資料一致性處理、以及關鍵程式片段的逐段說明。這一輪的目的，是讓後續 circulation（借還/預約）有完整的主資料可依附。

> 延續你的學習需求：本輪新增/修改的 TypeScript 程式檔都已加上高密度註解，可直接當教材閱讀。

## 1) 這一輪完成了什麼（對照 MVP/故事）
對照 `USER-STORIES.md`：
- **US-020 新增/編輯書目**：已做（API）
- **US-021 為同一書目新增多冊**：已做（API）
- **US-030 搜尋館藏（關鍵字/欄位）**：完成基礎搜尋（書目 query + 可借冊數）
- **US-022 批次匯入書目/冊**：尚未做（後續加入匯入流程）

對照 `API-DRAFT.md`（v1）已落地端點：
- `GET /api/v1/orgs/:orgId/bibs?query=&isbn=&classification=`
- `POST /api/v1/orgs/:orgId/bibs`
- `GET /api/v1/orgs/:orgId/bibs/:bibId`
- `PATCH /api/v1/orgs/:orgId/bibs/:bibId`
- `GET /api/v1/orgs/:orgId/items?barcode=&status=&location_id=&bibliographic_id=`
- `POST /api/v1/orgs/:orgId/bibs/:bibId/items`
- `GET /api/v1/orgs/:orgId/items/:itemId`
- `PATCH /api/v1/orgs/:orgId/items/:itemId`

## 2) 為什麼要加「跨租戶檢查」？
`item_copies` 同時有 `organization_id`、`bibliographic_id`、`location_id`。  
DB 的 FK 只保證「bib/location 存在」，但無法保證「同一 org」。  
這會造成一個很危險的情境：**A 校的冊誤連到 B 校的書目或位置**。  

因此我在 `ItemsService` 做了兩個應用層檢查：
- `assertBibliographicExists(orgId, bibId)`：確認書目屬於該 org
- `assertLocationExists(orgId, locationId)`：確認位置屬於該 org

這是「多租戶一致性」的最低限度保護；未來若要更嚴謹，可加 DB trigger 或將 `bibliographic_records`/`locations` 以複合 key 正規化。

## 3) 基本搜尋怎麼做？（MVP 版本）
MVP 先追求「能用、可維運」：
- **`query` 關鍵字**：用 `ILIKE` + `%...%`，比對 `title/creators/subjects/publisher/isbn/classification`。
- **`isbn`**：採精確比對（掃描/複製 ISBN 時最準）。
- **`classification`**：採 prefix 比對（輸入 823 可找 823.914）。
- **可借冊數**：用 `COUNT` + `FILTER` 在 DB 端計算，避免前端自己算。

> 這裡選用 `ILIKE` 的原因是：`db/schema.sql` 已建立 `pg_trgm`，title 的模糊搜尋會被 trigram index 加速；而作者/主題詞目前是 text[]，先用 `array_to_string` 做簡化比對即可。

## 4) 重要實作片段（逐段落帶讀）

### 4.1 書目建立/更新的驗證規則
`apps/api/src/bibs/bibs.schemas.ts`
```ts
export const createBibliographicSchema = z.object({
  title: z.string().trim().min(1).max(500),
  creators: textArray.optional(),
  contributors: textArray.optional(),
  publisher: z.string().trim().min(1).max(200).optional(),
  published_year: z.number().int().min(1400).max(2100).optional(),
  language: z.string().trim().min(1).max(16).optional(),
  subjects: textArray.optional(),
  isbn: isbnSchema.optional(),
  classification: z.string().trim().min(1).max(64).optional(),
});

export const updateBibliographicSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  creators: textArray.nullable().optional(),
  // ...其餘欄位同理
});
```
重點說明：
1. `create` 要求 `title`，其他欄位可選，符合 MVP「先能建檔」。
2. `update` 允許 `null`，代表「清空該欄位」，避免只能新增不能移除。
3. `isbn` 只先做格式篩選（數字/破折號）；checksum 可後續再加。

### 4.2 書目搜尋與可借冊數
`apps/api/src/bibs/bibs.service.ts`
```ts
const search = filters.query?.trim() ? `%${filters.query.trim()}%` : null;
const classification = filters.classification?.trim()
  ? `${filters.classification.trim()}%`
  : null;

const result = await this.db.query<BibliographicWithCountsRow>(
  `
  SELECT
    b.id,
    b.title,
    COUNT(i.id)::int AS total_items,
    COUNT(i.id) FILTER (WHERE i.status = 'available')::int AS available_items
  FROM bibliographic_records b
  LEFT JOIN item_copies i
    ON i.organization_id = b.organization_id
   AND i.bibliographic_id = b.id
  WHERE b.organization_id = $1
    AND ($3::text IS NULL OR b.classification ILIKE $3)
    AND (
      $4::text IS NULL
      OR b.title ILIKE $4
      OR COALESCE(array_to_string(b.creators, ' '), '') ILIKE $4
    )
  GROUP BY b.id
  `,
  [orgId, isbn, classification, search],
);
```
重點說明：
1. `COUNT(...) FILTER (...)` 在 SQL 端直接算出「可借冊數」，前端不用再做二次計算。
2. `array_to_string` 是因為 creators/subjects 目前是 `text[]`，先用簡化搜尋。
3. `classification` 用 prefix 搜尋（`823%`）更符合館員輸入習慣。

### 4.3 新增冊的「跨租戶一致性」檢查
`apps/api/src/items/items.service.ts`
```ts
await this.assertBibliographicExists(orgId, bibId);
await this.assertLocationExists(orgId, input.location_id);

const result = await this.db.query<ItemRow>(
  `
  INSERT INTO item_copies (
    organization_id,
    bibliographic_id,
    barcode,
    call_number,
    location_id,
    status
  )
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING id, barcode, status
  `,
  [orgId, bibId, input.barcode, input.call_number, input.location_id, input.status ?? 'available'],
);
```
重點說明：
1. 先查 bib/location 是否屬於同 org，避免跨校混用。
2. `status` 沒給時預設 `available`，符合新書入庫流程。

### 4.4 更新冊時只改「有提供」的欄位
`apps/api/src/items/items.service.ts`
```ts
const setClauses: string[] = [];
const params: unknown[] = [orgId, itemId];

if (input.barcode !== undefined) addClause('barcode', input.barcode);
if (input.location_id !== undefined) {
  await this.assertLocationExists(orgId, input.location_id);
  addClause('location_id', input.location_id);
}

setClauses.push('updated_at = now()');
```
重點說明：
1. `PATCH` 只更新傳入的欄位，避免把未傳欄位覆蓋成 `NULL`。
2. 任何更新都會刷新 `updated_at`，方便同步或排序。

## 5) 如何手動驗證（不用測試框架也能確認）
前置：
1. `docker compose up -d postgres`
2. 套用 `db/schema.sql`
3. 設定 `DATABASE_URL`
4. `npm run dev:api`

用 curl（或 Postman）測試：
- 建立書目：
  - `POST http://localhost:3001/api/v1/orgs/{orgId}/bibs`
  - body：`{ "title": "哈利波特：神秘的魔法石", "creators": ["J. K. Rowling"], "isbn": "9789573317248" }`
- 在書目下新增冊：
  - `POST http://localhost:3001/api/v1/orgs/{orgId}/bibs/{bibId}/items`
  - body：`{ "barcode": "LIB-00001234", "call_number": "823.914 R79 v.1", "location_id": "{locationId}" }`
- 搜尋書目（含可借冊數）：
  - `GET http://localhost:3001/api/v1/orgs/{orgId}/bibs?query=哈利`
- 依書目列出冊：
  - `GET http://localhost:3001/api/v1/orgs/{orgId}/items?bibliographic_id={bibId}`
