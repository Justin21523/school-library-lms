# 0032：MARC21 欄位字典（下拉選單 + 指標/子欄位 + 前後端驗證）

本文件記錄「常用 MARC21（BIB）欄位字典」的落地方式：用同一套字典同時驅動 **Web 編輯器的下拉選單** 與 **API 儲存時的欄位級驗證**，讓操作原理可理解、規則可擴充、行為可預期。

---

## 1) 目標與範圍

目標：
- 讓 `marc_extras` 的編輯從「純 JSON」升級成「可操作」：tag/指標/子欄位可選擇、可排序、可重複。
- 在不引入重型 cataloging UI/外部套件的前提下，提供**最小但關鍵**的欄位級驗證，避免髒資料進 DB。
- 前後端規則一致：Web 顯示的 error 會在 API 端被拒絕（warning 則不阻擋）。

範圍（目前）：
- 字典先覆蓋「常用欄位」（例如 `006/007/008/010/020/041/082/084/1XX/245/264/300/5XX/6XX/7XX/830/856/880`）。
- 未列入字典的 tag：仍允許存入 `marc_extras`，但驗證會降級為「通用 shape 檢查」（避免擋住地方欄位/進階用法）。

目前已納入字典的 tag（共 95 個；會持續擴充）：
- 00X：`003/006/007/008`
- 01X-09X（numbers/codes）：`010/015/016/017/020/022/024/028/035/037/040/041/042/043/044/050/080/082/084/090`
- 1XX（main entry）：`100/110/111/130`
- 2XX（titles/editions）：`210/222/240/242/245/246/247/250/260/264`
- 3XX（physical/etc.）：`300/306/310/321/336/337/338/340/344/345/346/347/348`
- 4XX（series statement）：`490`
- 5XX（notes）：`500/502/504/505/506/508/511/520/521/530/538/546/586/588`
- 6XX（subjects）：`600/610/611/630/648/650/651/653/655/656/657/658/690`
- 7XX（added entries / linking）：`700/710/711/720/730/740/752/775/776`
- 8XX/84X-88X（series/electronic/alternate script）：`800/810/811/830/856/880/887`

---

## 2) 字典是什麼：同一份規格，驅動 UI + 驗證

字典欄位規格（Field Spec）主要包含：
- `kind`: `control`（00X 類）或 `data`（有 indicators/subfields）。
- `repeatable`: 欄位本身是否可重複（例如 `245` 不可重複、`650` 可重複）。
- `indicators`: `ind1/ind2` 的允許值清單（可設定 `allow_other` 以避免字典不完整時誤擋）。
- `subfields`: 子欄位 code 清單（含 `required/repeatable/value_kind/max_length/pattern` 等最小規則）。
- `subfields_allow_other`：是否允許「未列在字典內」的 code（預設 `true` → 允許但會在 Web 顯示 warning）。

這個設計的核心取捨：
- MARC21 完整規格非常大；我們採用 **「字典驅動 + 可逐步補齊」**，先把常用欄位做得可用、可驗證、可擴充。

---

## 3) Web：下拉選單 + error/warning 驗證

### 3.1 字典檔
- **SSOT（單一真相來源）**：`packages/shared/src/marc21-bib-field-dictionary.ts`
  - 定義常用欄位字典 `MARC21_BIB_FIELDS` 與輔助函式（建立欄位模板、驗證、正規化指標…）。
- Web wrapper：`apps/web/app/lib/marc21.ts`
  - 只做 re-export（保留既有 import 路徑，避免大規模改動）。

### 3.2 編輯器元件（字典驅動 UI）
- `apps/web/app/components/marc/marc-fields-editor.tsx`
  - tag：使用 `<datalist>` 提供常用欄位下拉（仍允許手動輸入其他 tag）。
  - indicators：
    - 若 `allow_other=false` → `<select>`（嚴格限制）
    - 否則 → `<input list=...>`（datalist 提示 + 可輸入其他值）
  - subfield code：
    - 若 `subfields_allow_other=false` → `<select>`
    - 否則 → `<input list=...>`（datalist 提示 + 可輸入其他 code）
  - 驗證呈現：
    - `error`：會阻擋儲存（API 會拒絕）
    - `warning`：不阻擋儲存，但提示「不在字典」或可能影響互通

---

## 4) API：儲存時的欄位級驗證（Zod）

### 4.1 字典檔（API 端一份）
- SSOT（shared）：`packages/shared/src/marc21-bib-field-dictionary.ts`
- API wrapper：`apps/api/src/common/marc21.ts`
  - 只做 re-export（保留既有 import 路徑）。

### 4.2 套用在 `marc_extras` schema
- `apps/api/src/bibs/bibs.schemas.ts`
  - `marcFieldSchema.superRefine(...)`：逐欄位套用字典級規則（只把 `level='error'` 的問題轉成 Zod issue）。
  - `marcExtrasSchema.superRefine(...)`：套用 `repeatable=false` 的「同 tag 不可重複」檢查（array-level）。

---

## 5) 擴充方式（新增/補齊欄位）

新增或補齊一個常用 tag 的建議流程：
1) 直接在 SSOT 加入/補齊 spec：`packages/shared/src/marc21-bib-field-dictionary.ts`
3) 若你已完整列出 subfields 且希望嚴格限制：將 `subfields_allow_other` 設為 `false`
4) 若指標允許值已完整且希望嚴格限制：將 indicators 的 `allow_other` 設為 `false`

原則：
- 字典不完整時，先偏向 `allow_other=true`（避免誤擋既有資料/地方實務）。
- 等 UI/資料來源穩定後，再逐步把常用欄位收斂到 strict（提高資料品質）。

---

## 6) 已知限制與後續

- 字典目前是「常用欄位」集合，不是完整 MARC21 BIB 全表。
- 本專案匯入端目前 **不支援 MARC-8**（僅接受 UTF-8；匯入時會拒絕 MARC-8 以避免亂碼）。
- 字典已集中到 shared（SSOT），後續只要在 `packages/shared/src/marc21-bib-field-dictionary.ts` 擴充即可同步影響 Web/UI 與 API 驗證。
