# 0035 — Authority Control 主控入口 + shared MARC↔vocab 規則（v1）

本輪你要解決的痛點是：
- 前端「入口太分散」：館員不知道要從哪裡進入 authority control / thesaurus / backfill / MARC 編輯器。
- 規則「只寫在文件」不夠：MARC tag ↔ vocab(kind) ↔ 指標 ↔ `$0/$2` 若 Web/API 各寫各的，很快就會漂移。
- 固定欄位（006/008）若只靠硬背位置，容易填錯且難以驗證。

本文件對應：
- `docs/marc21-controlled-vocab-mapping.md`（規則文件：給人讀）
- `packages/shared/src/marc21-authority-linking.ts`（可執行規則：給程式跑）

---

## 1) 做了什麼（變更摘要）

### 1.1 Web：新增「Authority Control 主控入口」
- 新增：`apps/web/app/orgs/[orgId]/authority/page.tsx`
  - kind 切換（subject/geographic/genre/name…）
  - 集中入口：Terms / Thesaurus（Browser/Quality/Visual）/ Backfill / MARC tools
  - Quick Find：用 suggest 快速跳到 term detail（治理 merge/usage 的起點）
- 導覽加入口：
  - `apps/web/app/orgs/[orgId]/layout.tsx`、`apps/web/app/orgs/[orgId]/page.tsx`

### 1.2 Web：Thesaurus 支援 kind deep link
- `apps/web/app/orgs/[orgId]/authority-terms/thesaurus/page.tsx`
- `apps/web/app/orgs/[orgId]/authority-terms/thesaurus/quality/page.tsx`
- `apps/web/app/orgs/[orgId]/authority-terms/thesaurus/visual/page.tsx`
  - URL `?kind=subject|geographic|genre&vocabulary_code=...` 可直接定位

### 1.3 shared：把規則落地成可執行 mapping
- 新增：`packages/shared/src/marc21-authority-linking.ts`
  - tag ↔ kind（650/651/655/100/700…）
  - `$2` 有值時，指標自動變 `7`（650/651：ind2；655：ind1）
  - `$0` 統一格式：`urn:uuid:<uuid>`
- shared 轉為 CommonJS（讓 NestJS CommonJS 可直接 import）
  - `packages/shared/package.json`、`packages/shared/tsconfig.json`
- Root scripts 補上 shared build/watch
  - `package.json`：`npm run dev` 會先 build shared，再同時 watch shared/web/api

### 1.4 Web + API：開始共用 mapping（避免漂移）
- Web MARC 編輯器（authority helper）改用 shared 規則：
  - `apps/web/app/components/marc/marc-fields-editor.tsx`
- API MARC 匯出（650/651/655 指標與 `$0`）改用 shared 規則：
  - `apps/api/src/common/marc.ts`

### 1.5 Web：006/008 結構化 editor 增加即時提示
- `apps/web/app/components/marc/marc-fixed-field-editor.tsx`
  - 對 008 日期/語言欄位做「輕量但有感」的 warning（避免明顯填錯）

---

## 2) 為什麼這樣設計（核心原理）

### 2.1 「文件」與「程式」要同源
你要把檢索/擴充從字串長相改成 term_id-driven，因此 `$0/$2/指標` 規則必須一致：
- 只靠文件：人會照抄錯、程式會漂移。
- 只靠程式：缺乏對外可讀的規格。

解法：**文件定死 + shared mapping 可執行**。

### 2.2 `$0=urn:uuid:` 的用意
MARC `$0` 常見放外部 control number/URI（例如 `id.loc.gov/...`）。
本系統把 internal term id 放進 `$0` 時，必須避免與外部混淆，所以定死：
- `$0 = urn:uuid:<term_id>`

### 2.3 指標何時要是 `7`
`$2` 的語意是「來源代碼/詞彙表代碼」，MARC 的慣例是：
- 650/651：`ind2=7` 表示 `$2` 指定來源
- 655：`ind1=7` 表示 `$2` 指定來源

因此我們做成可執行函式：只要 `$2` 有值，就把對應指標設成 `7`；反之回到保守預設（650/651→4、655→0）。

---

## 3) 關鍵程式碼片段（最小可讀）

### 3.1 shared 規則總表（單一真相來源）
檔案：`packages/shared/src/marc21-authority-linking.ts`

```ts
export const MARC_AUTHORITY_LINKING_RULES = [
  { kind: 'subject', tags: ['650'], vocabulary_code_subfield_code: '2', source_specified_in_indicator: { position: 2, when_vocab_present: '7', when_vocab_missing: '4' } },
  { kind: 'geographic', tags: ['651'], vocabulary_code_subfield_code: '2', source_specified_in_indicator: { position: 2, when_vocab_present: '7', when_vocab_missing: '4' } },
  { kind: 'genre', tags: ['655'], vocabulary_code_subfield_code: '2', source_specified_in_indicator: { position: 1, when_vocab_present: '7', when_vocab_missing: '0' } },
];
```

### 3.2 Web：MARC 編輯器套用 authority term 時，同步指標與 `$0/$2`
檔案：`apps/web/app/components/marc/marc-fields-editor.tsx`

```ts
const vocab = String(term.vocabulary_code ?? '').trim();
const nextIndicators = applyMarcIndicatorsForVocabulary(tag, { ind1: field.ind1 ?? ' ', ind2: field.ind2 ?? ' ' }, vocab);
// $0：urn:uuid:<uuid>（外部 $0 保留）
const urn = formatAuthorityControlNumber(term.id);
```

### 3.3 API：MARC 匯出用同一套規則產生 650/651/655 指標
檔案：`apps/api/src/common/marc.ts`

```ts
const indicators = applyMarcIndicatorsForVocabulary('650', { ind1: ' ', ind2: ' ' }, vocab);
const f650: MarcDataField = { tag: '650', ind1: indicators.ind1, ind2: indicators.ind2, subfields };
```

---

## 4) 如何驗證
- Build：`npm run build`
- Web 手動：
  - `/orgs/:orgId/authority` 入口可找到 Terms / Thesaurus / Backfill / MARC tools
  - Thesaurus Browser：用 `?kind=genre&vocabulary_code=builtin-zh` 開啟能正確定位
  - MARC 編輯器：在 650/651/655 用 authority helper 套用 term 後，指標與 `$0/$2` 會自動一致

