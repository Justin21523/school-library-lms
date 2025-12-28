# 0028：進階編目基礎（MARC 21 匯出 + `marc_extras`）

本文件記錄「從 MVP 書目表單 → MARC 21 交換格式」的第一步落地：
- **表單欄位仍是主資料**（可治理、可驗證、可報表）
- **MARC 21 用於交換/匯出**（由表單欄位推導產生）
- **未覆蓋的 MARC 欄位要能保留**（匯入/編輯器先落地到 `marc_extras`，匯出時再 append）

> 這輪除了「能匯出 + 能保留未覆蓋欄位」之外，也補上了「部分對映欄位的 merge 規則」，避免匯入後保留 `$c/$x/$e/$q/$2...` 造成匯出重複或資訊丟失。

---

## 1) 資料模型：`bibliographic_records.marc_extras`（JSONB）

在 `db/schema.sql` 的 `bibliographic_records` 新增欄位：
- `marc_extras jsonb NOT NULL DEFAULT '[]'::jsonb`
- 並用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 確保既有 volume 可就地升級（不用 reset）

設計理由：
- 直接存 `.mrc` 二進位不利於 diff/版本演進
- JSONB 便於後續做「欄位 UI 編輯器」與「匯入器保留未對映欄位」

對照：`DATA-DICTIONARY.md` 已補上 `marc_extras` 欄位說明。

---

## 2) API：MARC 匯出 + `marc_extras` 讀寫端點

新增三個端點（皆以 StaffAuthGuard 保護）：

1) `GET /api/v1/orgs/:orgId/bibs/:bibId/marc?format=json|xml|mrc`
- `format=json`：回傳 `MarcRecord`（JSON-friendly 結構）
- `format=xml`：回傳 MARCXML（MARC21 slim）
- `format=mrc`：回傳 ISO2709 `.mrc`

2) `GET /api/v1/orgs/:orgId/bibs/:bibId/marc-extras`
- 回傳 sanitize 後的 `MarcField[]`

3) `PUT /api/v1/orgs/:orgId/bibs/:bibId/marc-extras`
- Request：
  ```json
  { "marc_extras": [{ "tag": "500", "ind1": " ", "ind2": " ", "subfields": [{ "code": "a", "value": "..." }] }] }
  ```
- 回傳 sanitize 後的 `MarcField[]`

> 規則：`001`/`005` 由系統產生；後端也會拒絕把 `001/005` 存進 `marc_extras`（避免使用者誤以為能覆蓋控制號/時間戳）。

---

## 3) API 實作重點（Controller/Service/Common）

### 3.1 Common：用表單欄位產生 MARC core fields + merge/append extras
核心邏輯在 `apps/api/src/common/marc.ts`：
```ts
// 245：題名（v1：嘗試拆成 $a/$b，避免匯入保留 245$b 時匯出重複）
const titleSubfields = splitTitleTo245Subfields(bib.title);
fields.push({ tag: '245', ind1: titleInd1, ind2: '0', subfields: titleSubfields });

// extras：sanitize 後 merge（245/264/650/700/100）再 append 其餘欄位
// - 245：保留 $c/$6... 且保留 ind2（non-filing）
// - 650：保留 $x/$y/$z/$0... 並可補 `$2`（authority_terms → vocabulary_code）
// - 020/041/082/084：核心 `$a` 以表單為準，但保留 extras 的其他子欄位（例如 020$q、041$b、082$2、084$2）
return { leader, fields: [...mergedCoreFields, ...remainingExtras] };
```

### 3.2 Controller：用 `format` 切換 JSON/XML/MRC
`apps/api/src/bibs/bibs.controller.ts`：
```ts
const record = await this.bibs.getMarcRecord(orgId, bibId);
if (format === 'xml') return serializeMarcXml(record);
if (format === 'mrc') return serializeIso2709(record);
return record;
```

### 3.3 Service：`marc_extras` 以 JSONB 落地（避免 pg 把 JS array 當作 Postgres array）
`apps/api/src/bibs/bibs.service.ts`：
```ts
await this.db.query(
  `UPDATE bibliographic_records SET marc_extras = $3::jsonb, updated_at = now() ...`,
  [orgId, bibId, JSON.stringify(marcExtras)],
);
```

---

## 4) Web：Bib Detail 加入 MARC 下載/編輯區塊

位置：`apps/web/app/orgs/[orgId]/bibs/[bibId]/page.tsx`

提供：
- 產生/下載 `MARC(JSON)`
- 下載 `MARCXML`
- 下載 `.mrc`
- 讀取/更新 `marc_extras`（可視化編輯器 + JSON 檢視）

低階支援：
- `apps/web/app/lib/api.ts` 新增 `requestBytes()`，用於下載 `.mrc` 的 ArrayBuffer，再用 Blob 下載。

---

## 5) 如何驗證（手動）

1) 啟動 demo：
```bash
npm run docker:demo
```

2) 登入 staff 後進入任一書目：
- `http://localhost:3000/orgs/<orgId>/bibs/<bibId>`

3) 在 **MARC 21（匯出/保留欄位）** 區塊：
- 按「產生 MARC(JSON)」確認會出現 `245/100/650/...` 等欄位
- 按「下載 MARCXML / .mrc」確認瀏覽器開始下載
- 用「載入 marc_extras」→ 編輯 JSON →「儲存」→ 再匯出確認 extras 有被 append

---

## 6) 已知限制（刻意留待後續）

- 欄位映射仍是 MVP 的最小集合（尚未覆蓋完整 RDA/MARC）
- `DDC/CCL` 目前用 `language` 做 heuristics（英文 → `082`；其他 → `084` + `$2 ccl`）
- MARC-8（leader[9] 非 `a`）目前不在本系統內轉碼；匯入時會提示先轉為 UTF-8 再處理
- MARC 編輯器仍未完成（目前 `marc_extras` 先用 JSON textarea/匯入器落地；後續會補 UI editor）
