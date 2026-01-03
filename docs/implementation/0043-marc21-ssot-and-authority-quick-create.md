# 0043：MARC21 字典 SSOT + 權威詞彙「即時新增」讓編目不中斷

本文件記錄本輪對「書目資料處理（Bibliographic）」中最容易卡住的兩個點做的升級：
- **MARC21 欄位字典改成單一真相來源（SSOT）**：避免 Web/UI 與 API 驗證規則漂移（drift）。
- **權威控制詞彙（authority_terms）補上「即時新增」輸入機制**：避免新系統一開始沒有詞彙庫就無法編目。

---

## 1) 問題（為什麼要做）

### 1.1 MARC21 字典雙份維護會漂移
原本有兩份「常用 MARC21（BIB）欄位字典」：
- Web：`apps/web/app/lib/marc21.ts`
- API：`apps/api/src/common/marc21.ts`

這會導致長期必然出現：
- Web 顯示可用的 tag/subfield，但 API 端驗證拒絕（或反過來）
- `marc_extras` 編輯器提示與實際匯出/儲存行為不一致 → 使用者困惑

### 1.2 權威詞彙為空時，編目 UI 會卡住
本系統的治理方向是：
- 650/651/655（主題/地名/體裁）應由 `authority_terms` 控制（term-based）
- creators/contributors（100/700）也逐步導向 term-based

但現場會遇到「冷啟動」問題：
- 新學校/新資料庫 → authority_terms 幾乎是空的
- 使用者在編目時找不到任何 term → 只能跳去 Authority 管理頁先建主檔 → 流程斷掉

---

## 2) 本輪改動（做了什麼）

### 2.1 MARC21 字典 SSOT
- 新增 SSOT：`packages/shared/src/marc21-bib-field-dictionary.ts`
  - 包含 `MARC21_BIB_FIELDS` 與 `getMarc21FieldSpec/listMarc21FieldSpecs/createEmptyFieldFromSpec/validateMarcFieldWithDictionary`
- Web wrapper：`apps/web/app/lib/marc21.ts`
  - 保留既有 import 路徑，實際 re-export shared（避免大改）
- API wrapper：`apps/api/src/common/marc21.ts`
  - 同樣保留既有 import 路徑，實際 re-export shared

### 2.2 `managed_by_form` 提示（降低「我改了但沒生效」）
`marc_extras` 的定位是「表單未覆蓋欄位」的保留/補充；但像 245$a、650$a 這些通常由表單欄位治理並在匯出 merge 時優先。

因此在字典驗證層新增 warning：
- 若子欄位 spec 標記 `managed_by_form: true` 且使用者在 `marc_extras` 填了值
  - 會提示「匯出/merge 時可能被覆蓋，建議改在書目表單/term-based 欄位編輯」

### 2.3 TermMultiPicker：即時新增 authority term（避免冷啟動卡住）
- `apps/web/app/components/authority/term-multi-picker.tsx`
  - 在 autocomplete 區塊新增「新增款目」按鈕
  - 預設把新增的 term 放進 `vocabulary_code=local`（避免混入 builtin 詞彙庫）
  - 新增成功後自動加入 chips（不必跳頁）
  - 若遇到 409 CONFLICT（同名已存在）會自動重新 suggest，讓使用者改用「加入」

### 2.4 MarcFieldsEditor：authority helper 也能即時新增並套用
- `apps/web/app/components/marc/marc-fields-editor.tsx`
  - 在 650/651/655/100/700… 的 authority helper 中新增「新增款目並套用」
  - 預設 `vocabulary_code=local`（可在輸入框指定）
  - 新增成功後立刻寫回：
    - `$0=urn:uuid:<term_id>`（本系統格式）
    - `$2=<vocabulary_code>` + 指標同步（依 tag 規則）

---

## 3) 如何驗證（你可以怎麼測）

### 3.1 Build 檢查
- `npm run build`

### 3.2 UI：TermMultiPicker 即時新增
1) 進入 `/orgs/:orgId/bibs`
2) 在 subjects / creators / genres 等 TermMultiPicker 輸入關鍵字
3) 按「新增款目」→ 應該會立刻出現 chips，且可點「主檔」進入 `/authority-terms/:termId`

### 3.3 UI：MARC 編輯器 authority helper 即時新增
1) 進入 `/orgs/:orgId/bibs/marc-editor` 選一筆 bib
2) 新增欄位 650 或 655
3) 打開 authority helper → 輸入關鍵字 → 按「新增款目並套用」
4) 應該會看到該欄位自動寫入 `$0=urn:uuid:...`（以及 `$2`/指標同步）

---

## 4) 後續建議（下一步）

- 若你希望「完整 MARC21 全表」，建議先確認策略：
  - A) 全表字典（非常大、維護成本高）
  - B) 常用欄位完整 + 可擴充（建議先走 B，並逐步擴充到你校務常用的 tag）
- `vocabulary_code` 若要更好用，可再補：
  - 由 API 提供「kind → 可用 vocabulary_code 清單」的 endpoint
  - Web 端改成下拉選單（避免手打拼錯）

