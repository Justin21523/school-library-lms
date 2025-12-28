# MARC21 ↔ Controlled Vocabulary 對應規則（v1）

本文件把「MARC21 交換欄位」與「本系統 controlled vocabulary / authority control」的對應規則**定死**，讓：
- 編目 UI（term-based）知道要送什麼（只送 `*_term_ids`）
- 後端知道要如何回寫正規化後的文字欄位（避免同名/同義造成不一致）
- MARC 匯出/匯入（含 `marc_extras`）有一致的驗證與 linking 方式

> 核心原則：**DB 內的真相來源是 term_id（UUID）**；`subjects/geographics/genres/creators/...` 這些文字陣列是「由 term_id 反查 `preferred_label` 後回寫」的衍生結果（方便顯示/legacy/交換）。

---

## 1) 名詞與資料結構（你要先對齊的三件事）

### 1.1 Authority term（權威詞主檔）
資料來源：`authority_terms`
- `id`：UUID（本系統的 **term_id**）
- `kind`：詞彙類型（本文件用到：`subject` / `geographic` / `genre` / `name`）
- `vocabulary_code`：詞彙庫代碼（例如 `builtin-zh` / `local` / `lcsh` / `lcgft`…）
- `preferred_label`：正規化後的顯示標目（本系統回寫與 MARC `$a` 的來源）
- `variant_labels`：同義/別名（供 suggest/backfill/expand）

### 1.2 Bibliographic ↔ term 的 junction tables（term_id-driven 的真相）
資料來源：
- `bibliographic_subject_terms`（650）
- `bibliographic_geographic_terms`（651）
- `bibliographic_genre_terms`（655）
- `bibliographic_name_terms`（100/700；含 role=creator/contributor + position）

這些表的共同語意：
- `term_id` 是真相來源
- `position` 決定輸出順序（MARC 欄位順序與 UI chips 順序一致）

### 1.3 MARC linking 子欄位規則（固定）

#### `$0`（Authority record control number）
本系統把 `authority_terms.id` 放進 `$0` 時，採用固定格式：
- `$0 = urn:uuid:<term_id>`

原因：
- MARC21 `$0` 常會出現外部系統的 control number / URI（例如 `id.loc.gov/...`）
- 用 `urn:uuid:` 前綴可明確區分「這是本系統 term_id」避免混淆

#### `$2`（Source of heading or term / Source of code）
本系統用 `$2` 表達來源時，固定放：
- `$2 = authority_terms.vocabulary_code`

> 指標是否必須配合 `$2`，見下一節的 per-tag 規則。

---

## 2) 對應總表（MARC tag ↔ kind ↔ 指標 ↔ linking subfields）

> 註：本表描述「本系統的固定做法」（不是完整 MARC21 規格）；匯入外部資料時，`marc_extras` 仍允許保留更多子欄位，但匯出時會以此規則產生/合併核心欄位。

| MARC tag | 系統 vocab(kind) | 系統真相欄位（API / DB） | 指標規則（固定） | linking subfields（固定） |
|---|---|---|---|---|
| 650 | `subject` | `subject_term_ids` / `bibliographic_subject_terms` | `ind2=7` **當且僅當**有 `$2`；否則 `ind2=4` | `$0=urn:uuid:<term_id>`；若有來源則 `$2=vocabulary_code` |
| 651 | `geographic` | `geographic_term_ids` / `bibliographic_geographic_terms` | `ind2=7` **當且僅當**有 `$2`；否則 `ind2=4` | `$0=urn:uuid:<term_id>`；若有來源則 `$2=vocabulary_code` |
| 655 | `genre` | `genre_term_ids` / `bibliographic_genre_terms` | `ind1=7` **當且僅當**有 `$2`；否則 `ind1=0`；`ind2` 固定空白 | `$0=urn:uuid:<term_id>`；若有來源則 `$2=vocabulary_code` |
| 100 | `name` | `creator_term_ids` / `bibliographic_name_terms(role=creator)` | v1：`ind1=1`、`ind2=␠`（最小可用） | `$0=urn:uuid:<term_id>`（不強制 `$2`） |
| 700 | `name` | `creator_term_ids`（第 2 位起）+ `contributor_term_ids` / `bibliographic_name_terms` | v1：`ind1=1`、`ind2=␠`（最小可用） | `$0=urn:uuid:<term_id>`（不強制 `$2`） |
| 041 |（代碼表）| `bibliographic_records.language`（v1 為單值） | v1：`ind2=7` **當且僅當**有 `$2`；否則空白 | 主要用 `$a`（語言代碼）；`$2` 代表 code source（通常留空表示 MARC language code） |

---

## 3) 逐欄位細則（你實作/驗證時要看的）

### 3.1 650（Subject Added Entry—Topical Term）
**系統寫入（真相來源）**
- UI 只送 `subject_term_ids: UUID[]`
- 後端回寫：
  - `bibliographic_subject_terms`（term_id + position）
  - `bibliographic_records.subjects = preferred_label[]`（依 position 排序）

**MARC 匯出（核心欄位）**
- 對每個 subject term 輸出一個 `650`
- `$a = preferred_label`
- `$0 = urn:uuid:<term_id>`
- 若 `vocabulary_code` 非空：
  - `ind2=7`
  - `$2 = vocabulary_code`
- 否則（極少）：`ind2=4` 且不輸出 `$2`

### 3.2 651（Subject Added Entry—Geographic Name）
同 650，但 kind/表不同：
- UI 只送 `geographic_term_ids`
- 回寫：
  - `bibliographic_geographic_terms`
  - `bibliographic_records.geographics = preferred_label[]`
- 匯出：
  - `651$a` / `651$0` / `651$2`
  - 指標：同 650（`ind2=7` ↔ `$2`）

### 3.3 655（Index Term—Genre/Form）
同 650，但指標不同：
- UI 只送 `genre_term_ids`
- 回寫：
  - `bibliographic_genre_terms`
  - `bibliographic_records.genres = preferred_label[]`
- 匯出：
  - `655$a` / `655$0` / `655$2`
  - 指標：
    - 有 `$2` → `ind1=7`
    - 無 `$2` → `ind1=0`
    - `ind2` 固定空白（Undefined）

### 3.4 100 / 700（Name heading + $0）
**系統寫入（真相來源）**
- UI 分兩組送：
  - `creator_term_ids`（有順序）
  - `contributor_term_ids`（有順序）
- 後端回寫：
  - `bibliographic_name_terms(role, position, term_id)`
  - `bibliographic_records.creators/contributors = preferred_label[]`

**MARC 匯出（v1 最小可用映射）**
- `100`：只放第一位 creator（若存在）
- `700`：其餘 creators + 所有 contributors 都用 `700$a`
- `$0`：
  - 若有 term link → `$0=urn:uuid:<term_id>`
  - 若為舊資料且未 backfill（或無法不模糊推導）→ 可能沒有 `$0`（transition 行為）

> v1 不在這裡「自動決定 relator」（$e/$4），因為它需要更完整的角色資料模型；但 `marc_extras` 允許保留匯入的 $e/$4，匯出時會合併回同一筆 700。

### 3.5 041（Language Code）
**系統寫入（v1）**
- `bibliographic_records.language`：建議放 MARC language code（例如 `chi`/`eng`），目前仍採寬鬆驗證（可逐步收斂）。

**MARC 匯出**
- 若 `language` 有值 → 輸出一筆 `041$a=<language>`
- `$2`：
  - 若你使用非 MARC 的代碼系統，才需要 `ind2=7` + `$2=<source>`
  - v1 預設 `ind2=␠` 且不輸出 `$2`

---

## 4) `marc_extras` 的 authority link 驗證（為什麼不會亂連）

本系統允許你在 MARC 編輯器編輯 `marc_extras`，但會對 `$0=urn:uuid:` 做一致性檢查：
1) `$0` 指到的 `term_id` 必須存在於同 org 的 `authority_terms`
2) 若 tag 在「固定對映表」內（例如 650/651/655/100/700），則 `term.kind` 必須符合
3) 若該欄位有 `$2`，則 `$2` 必須等於 `term.vocabulary_code`（避免把 LCSH term 誤標成 local）

這讓你可以「保留匯入資料的進階子欄位」同時不破壞 term-based 的治理一致性。

