# 0033：subjects 正規化 + authority linking（term_id-driven）+ MARC $0

你提出的方向很明確：
- 主題詞一律先做「正規化」再落庫（prefer preferred_label）
- 檢索擴充不要再靠字串長相，逐步改成「term_id 驅動」
- MARC 與 controlled vocabulary 的對應規則要定死（指標/`$2`）
- 把「authority term id」放進 MARC 的連結子欄位（例如 `650$0`）
- 同時要有 API 對應、前端要能串接

本輪把「主題詞（subjects）」先落地成一個可治理、可演進的 authority linking pipeline（其他 controlled vocab 如語言/地理等，後續可用相同模式擴充）。

---

## 1) 資料模型：`bibliographic_subject_terms`（junction table）

核心新增：`db/schema.sql` 加上 `bibliographic_subject_terms`，用來把：
- `bibliographic_records`（書目）
- `authority_terms(kind='subject')`（主題詞權威款目）

以 **term_id** 綁定在一起，並保留 `position`（順序）。

`db/schema.sql`
```sql
CREATE TABLE IF NOT EXISTS bibliographic_subject_terms (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES authority_terms(id) ON DELETE RESTRICT,
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, bibliographic_id, term_id),
  UNIQUE (organization_id, bibliographic_id, position)
);
```

設計要點：
- **仍保留 `bibliographic_records.subjects (text[])`**：相容既有 UI/匯入資料、也方便顯示。
- **查詢/治理以 term_id 為準**：搜尋、擴充、MARC linking 走 `bibliographic_subject_terms`。

Seed 同步補齊：
- `db/seed-demo.sql`：demo 資料會自動 backfill 正規化 subjects 並重建 linking
- `scripts/seed-scale.py`：大量資料集也會產生 linking（讓 term_id-driven 搜尋可測）

---

## 2) API：subjects 正規化 + term_id-driven 搜尋

### 2.1 `GET /bibs` 新增 `subject_term_ids_any`

`apps/api/src/bibs/bibs.schemas.ts`
```ts
subject_term_ids_any: z
  .preprocess((value) => String(value ?? '').trim().split(',').map((x) => x.trim()).filter(Boolean), z.array(uuidSchema).min(1).max(500))
  .optional(),
```

`apps/api/src/bibs/bibs.service.ts`（list）
```ts
AND (
  $4::uuid[] IS NULL
  OR EXISTS (
    SELECT 1
    FROM bibliographic_subject_terms bst
    WHERE bst.organization_id = b.organization_id
      AND bst.bibliographic_id = b.id
      AND bst.term_id = ANY($4::uuid[])
  )
)
```

取捨：
- `subjects_any`（labels overlap）保留作為過渡相容
- 新功能主推 `subject_term_ids_any`（term_id-driven）

### 2.2 `POST/PATCH /bibs` 新增 `subject_term_ids`

`apps/api/src/bibs/bibs.schemas.ts`
```ts
subject_term_ids: z.array(uuidSchema).max(50).optional(), // create
subject_term_ids: z.array(uuidSchema).max(50).nullable().optional(), // update
```

並強制「二擇一」避免不一致：
```ts
if (value.subjects !== undefined && value.subject_term_ids !== undefined) {
  ctx.addIssue({ message: 'Provide either subjects or subject_term_ids, not both', path: ['subject_term_ids'], code: z.ZodIssueCode.custom });
}
```

### 2.3 寫入流程（正規化 + auto-upsert + replace links）

`apps/api/src/bibs/bibs.service.ts`
- `resolveSubjectTermsForWrite()`：把 `subjects` 或 `subject_term_ids` 轉成
  - `subjects`（preferred_label）
  - `subject_term_ids`（term_id）
- `replaceBibSubjectTerms()`：用「先刪後插」重建 links（確保一致）

這個流程被用在：
- `create/update`（單筆 CRUD）
- `import-marc`（create/update）
- `catalog csv import`（建立新書目）

---

## 3) Thesaurus expand：回傳 `term_ids`（給前端 term_id-driven）

`apps/api/src/authority/authority.service.ts`
```ts
const termIds = uniqLabels([
  ...(include.includes('self') || include.includes('variants') ? [term.id] : []),
  ...broaderTerms.map((t) => t.id),
  ...narrowerTerms.map((t) => t.id),
  ...relatedTerms.map((t) => t.id),
]);
```

回傳 shape 新增：
- `term_ids: string[]`

---

## 4) MARC 匯出：650 補 `$0`（authority term id）+ `$2`（vocabulary_code）

### 4.1 `buildMarcRecordFromBibliographic` 支援 `subjectAuthorityIdByLabel`

`apps/api/src/common/marc.ts`
```ts
export type BuildMarcRecordOptions = {
  subjectVocabularyByLabel?: Record<string, string>;
  subjectAuthorityIdByLabel?: Record<string, string>; // UUID
};
```

### 4.2 生成 core 650 時補 `$0`

```ts
const subjectAuthorityId = getSubjectAuthorityId(subjectAuthorityIdByLabel, s);
if (subjectAuthorityId) subfields.push({ code: '0', value: `urn:uuid:${subjectAuthorityId}` });
```

### 4.3 `getMarcRecord` 優先走 term links

`apps/api/src/bibs/bibs.service.ts`
- 若 `bibliographic_subject_terms` 有資料：
  - 用它的 `preferred_label` 作為匯出 `650$a`
  - 同時建立 `$2/$0` 對應 map 注入 `buildMarcRecordFromBibliographic`
- 若沒有（舊資料）：
  - 回退到 `preferred_label` 字串推導（僅在不模糊時補）

---

## 5) MARC 驗證：指標 7 與 `$2` 的硬規則 + `$0` urn:uuid 檢查

前後端共用同一套「字典 + 驗證」邏輯（各自一份檔案）：
- `apps/api/src/common/marc21.ts`
- `apps/web/app/lib/marc21.ts`

新增通用規則：
- 指標=7 → 必須有 `$2`
- 有 `$2` → 指標必須為 7
- `$0` 若是 `urn:uuid:` 前綴 → 後面必須是 UUID

---

## 6) Web：Bibs 搜尋串接 term_id-driven thesaurus expand

`apps/web/app/orgs/[orgId]/bibs/page.tsx`
- 搜尋區新增「subject term（thesaurus）」選擇器
- 若勾選 expand → 先呼叫 `GET /authority-terms/:termId/expand` 拿 `term_ids`
- 再用 `GET /bibs?subject_term_ids_any=...` 查詢書目

API client 型別同步：
- `apps/web/app/lib/api.ts`：`ThesaurusExpandResult.term_ids`、`listBibs.filters.subject_term_ids_any`

---

## 7) 如何驗證（建議路徑）

1. 重建 demo DB（確保新表與 seed 生效）：
   - `npm run docker:reset`（或至少 `npm run docker:seed`）
2. Web 後台：
   - 進 `/orgs/:orgId/bibs`，用「subject term（thesaurus）」選一個詞，勾 expand 後搜尋
3. MARC：
   - 下載某筆書目的 MARC JSON（`/bibs/:bibId/marc?format=json`）
   - 檢查 `650$0` 是否出現 `urn:uuid:...`
4. 本 repo QA：
   - `npm run qa:marc`
   - `npm run build -w @library-system/api`
   - `npm run build -w @library-system/web`

