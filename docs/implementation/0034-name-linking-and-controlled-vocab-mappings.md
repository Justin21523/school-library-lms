# 0034：Name linking（creators/contributors term-based）+ 其他 controlled vocab 對映（651/655/041）

本文件把你在「1→5」排序中 **第 4、5 步** 的落地規則寫死（同時補上可操作的 UI 與後端驗證），讓之後擴充更多 MARC 欄位時有一致的模式可依循。

---

## 1) v1 核心原則（你要求的方向）

你已明確要求：
- 欄位值先正規化再落庫（避免同名/同義造成不一致）
- 檢索/擴充逐步改成 **term_id 驅動**
- MARC 與 controlled vocab 的對應規則要定死
- 把「authority term id」放進 MARC 的 linking subfield（我們採 `$0=urn:uuid:<term_id>`）

本輪的落地策略：
- **主檔**：維持單一 `authority_terms`（用 `kind` 區分不同 vocab），避免每種 vocab 都長一套 CRUD/搜尋/權限/稽核。
- **連結表（junction tables）**：針對「需要 term_id-driven 查詢/治理」的領域，各自建立 junction table（subjects / names / 651 / 655 已完成）。
- **治理（usage/merge）**：針對已落地 junction table 的 kinds（`subject/name/geographic/genre`）提供 usage + merge/redirect（preview/apply）。
- **MARC extras**：對「尚未做成表單」的欄位，先用 `marc_extras` 落地；再用 UI helper + API validation 把 linking 變成可用、可控。

---

## 2) 資料模型

### 2.1 `bibliographic_name_terms`（人名 linking v1）

`db/schema.sql`：新增 `bibliographic_name_terms`（role=creator|contributor + position），用 term_id 做真相來源。

```sql
CREATE TABLE IF NOT EXISTS bibliographic_name_terms (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE CASCADE,
  role bibliographic_name_role NOT NULL,
  term_id uuid NOT NULL REFERENCES authority_terms(id) ON DELETE RESTRICT,
  position int NOT NULL,
  PRIMARY KEY (organization_id, bibliographic_id, role, term_id),
  UNIQUE (organization_id, bibliographic_id, role, position)
);
```

對應 UI：
- creators → `creator_term_ids[]`
- contributors → `contributor_term_ids[]`

### 2.2 `authority_term_kind` 擴充（其他 controlled vocab）

`db/schema.sql`：把 enum `authority_term_kind` 擴充為：
- `name`（1XX/7XX）
- `subject`（650）
- `geographic`（651）
- `genre`（655）
- `language`（041）
- `relator`（700$e/$4；本輪先預留）

### 2.3 `bibliographic_geographic_terms` / `bibliographic_genre_terms`（651/655 term-based v1.3）

`db/schema.sql`：新增兩張 junction table（比照 subjects v1），讓 651/655 也能：
- 編目 UI 只送 term ids（`geographic_term_ids[]` / `genre_term_ids[]`）
- term_id-driven search（filter）與 governance（usage/merge）以 junction table 為準
- 後端回寫/正規化 `geographics(text[])` / `genres(text[])` 作為顯示/相容用

---

## 3) 固定對映規則（MARC ↔ vocab ↔ linking subfields）

### 3.1 `$0` 的格式（本系統的 term_id）

規則：
- 若使用本系統 term_id，統一使用：`$0=urn:uuid:<uuid>`
- `$0` 若不是 `urn:uuid:`（例如外部 URI），視為「外部 authority control」：本系統不強制存在性/對映驗證（避免擋掉匯入資料）

### 3.2 主要欄位對映表（v1 先定死這幾個）

| MARC tag | controlled vocab kind | 主要子欄位 | linking subfields | 指標規則 |
|---|---|---|---|---|
| `100/700/710/711/720` | `name` | `$a` | `$0=urn:uuid:<term_id>` | 本輪不使用 `$2`（name 欄位通常不靠 `$2` 表達 thesaurus） |
| `650` | `subject` | `$a` | `$0` + `$2=vocabulary_code` | 若有 `$2` → `ind2=7`；系統可推導 vocab 時會補 `$2` |
| `651` | `geographic` | `$a` | `$0` + `$2=vocabulary_code` | 若有 `$2` → `ind2=7`；無 `$2` 時（不明來源）→ `ind2=4` |
| `655` | `genre` | `$a` | `$0` + `$2=vocabulary_code` | 若有 `$2` → `ind1=7` 且 `ind2=␠`；無 `$2` 時（basic）→ `ind1=0` |
| `041` | `language` | `$a`（code） | （可選）`$2` / （可選）`$0=urn:uuid` | 若有 `$2` → `ind2=7`；不提供 `$2` 時視為 MARC language code |

> 這份表是「先鎖住最常用且對映明確」的版本；你後續要擴充 600/610/611/630/648/653/656/657/658… 時，建議先把「tag→kind→子欄位」規則寫進同一張表，再落地 UI/驗證。

---

## 4) API：驗證與寫入重點

### 4.1 Bib create/update：term_id-driven 的人名與主題詞

`apps/api/src/bibs/bibs.schemas.ts`
- `creator_term_ids` / `contributor_term_ids`
- `subject_term_ids`
- 並強制「同一欄位不可同時送字串與 term_ids」避免不一致

### 4.2 Maintenance：既有 creators/contributors 回填（name backfill）

你在 UI 端已改成「term-based chips」作為真相來源，但現場一定會遇到：
- 舊資料只有 `creators/contributors(text[])`（還沒連到 term）
- 因此 term-based UI 會顯示為空（避免拿不可信的字串去猜 term）

這輪新增一個「按 org 批次」的回填工具（preview/apply + 報表 + audit），行為比照 subjects/651/655 backfill：
- API：`POST /api/v1/orgs/:orgId/bibs/maintenance/backfill-name-terms`
  - `mode=preview`：transaction 內實跑寫入再 ROLLBACK（可重現報表）
  - `mode=apply`：COMMIT + 寫入 `audit_events (catalog.backfill_name_terms)`
- Web：`/orgs/:orgId/bibs/maintenance/backfill-name-terms`

回填策略（保守但可治理）：
- match `preferred_label / variant_labels`
- missing/ambiguous → 建 `local` name term（讓 links 填滿；之後用 merge/redirect 收斂）
- 回寫/正規化 `bibliographic_records.creators/contributors`（改成 preferred_label）

### 4.3 MARC extras：$0=urn:uuid 的 referential validation（含 import）

你要的「規則定死」不能只靠字典（字典無法查 DB），因此我們在 service 層加上必要的 referential validation：
- `apps/api/src/bibs/bibs.service.ts`：
  - `updateMarcExtras()`：儲存前檢查 `$0=urn:uuid` 的 term 是否存在、tag-kind 是否匹配、（若有）`$2` 是否等於 term.vocabulary_code
  - `importMarcBatch()`：preview/apply 同樣檢查，並以逐筆 errors 回報（不直接 fail-fast）

---

## 5) Web：可操作的編目 UI（MARC editor + term-based）

### 5.1 書目表單（term-based）
- subjects：chips + 可排序 → 只送 `subject_term_ids`
- creators/contributors：chips + 可排序 → 只送 `creator_term_ids` / `contributor_term_ids`

### 5.2 `marc_extras` 編輯器：authority linking helper

`apps/web/app/components/marc/marc-fields-editor.tsx`
- 對 `650/651/655` 提供「搜尋/連結 authority term」：
  - 用 suggest API 查 term（kind 依 tag 對映）
  - 一鍵填入 `$a/$0(urn:uuid)/$2` 並設定指標：
    - `650/651`：`ind2=7`
    - `655`：`ind1=7`
- 對 `100/700/710/711/720` 提供「搜尋/連結 name term」：
  - 一鍵填入 `$a/$0(urn:uuid)`（不自動填 `$2`）
- 對 `041`/`040$b` 提供常用 language code 的 datalist（下拉提示）

---

## 6) 如何驗證（建議路徑）

1) Authority terms 管理頁：
- `/orgs/:orgId/authority-terms` 建立：
  - `kind=geographic`（給 651 用）
  - `kind=genre`（給 655 用）

1.5) Name backfill（讓 creators/contributors 變成 term-based）
- `/orgs/:orgId/bibs/maintenance/backfill-name-terms`
  - 先按 preview 看報表（auto_created / ambiguous_auto_created / unmatched）
  - 確認後再 apply（會寫 audit，並可用 next_cursor 分批）

2) 書目頁 → `marc_extras`：
- 新增 `651` 或 `655`，打開「搜尋/連結」：
  - 選一個 term → 應自動補 `$0=urn:uuid:...`、`$2=<vocabulary_code>`，並：
    - `651`：`ind2=7`
    - `655`：`ind1=7`

3) 儲存 `marc_extras`：
- 若手動亂填 `$0=urn:uuid:...`（不存在或 kind 不符），API 應回 `MARC_AUTHORITY_LINK_INVALID`

4) 匯入 MARC（import-marc）：
- preview 若包含不合法 `$0=urn:uuid`，應在 `errors[]` 看到 `MARC_EXTRAS_*` 的錯誤碼
