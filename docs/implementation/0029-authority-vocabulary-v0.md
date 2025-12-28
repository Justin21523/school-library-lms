# 0029：Authority / Vocabulary v0（姓名/主題詞權威控制 + 內建詞彙庫）

本文件記錄「進階編目」第一個主檔落地：**Authority / Vocabulary（權威控制檔 / 詞彙庫）**。

> 更新備註（v1）：本 repo 已往前推進到「term_id-driven 的 authority linking」：
> - subjects：見 `docs/implementation/0033-subject-normalization-and-authority-linking.md`
> - names + 651/655/041 對映：見 `docs/implementation/0034-name-linking-and-controlled-vocab-mappings.md`
>
> 本文件保留 v0 的設計脈絡（先做主檔 + autocomplete），但部分敘述（例如「尚未做 id linking」）已不再是現況。

目標（對齊你的需求）：
- 支援 **姓名（name）** 與 **主題詞（subject）** 的權威控制
- 支援「內建詞彙庫」：以 `vocabulary_code` + `source` 表達來源與分類
- 先把 CRUD + 搜尋/建議（autocomplete）做起來，讓前端能引導一致用詞

> 這輪刻意不把 `bibliographic_records.creators/subjects` 改成 authority id 綁定；先用「主檔 + autocomplete」達到 80% 一致性。下一輪（或再下一輪）再做真正的 authority linking（junction table 或欄位型別演進）。

---

## 1) 資料模型：`authority_terms`

新增資料表：`authority_terms`（見 `db/schema.sql`）

關鍵欄位：
- `kind`：`name|subject`（以 enum `authority_term_kind` 約束）
- `preferred_label`：權威標目（推薦用詞）
- `variant_labels`：別名/同義詞（簡化 UF/alt labels）
- `vocabulary_code`：詞彙庫代碼（例如 `local` / `builtin-zh`；可擴充多套）
- `source`：來源標記（`local`/`seed-demo`/`seed-scale`…，便於追溯）
- `status`：`active/inactive`（停用不刪除；沿用 `user_status`）

索引：
- `(organization_id, kind, status, created_at DESC)`：管理頁列表/翻頁
- trigram index：`preferred_label + variant_labels` 的模糊搜尋（autocomplete/查找）

---

## 2) API：Authority Terms CRUD + Suggest

新增端點（皆為 StaffAuthGuard）：

1) `GET /api/v1/orgs/:orgId/authority-terms`
- 用途：管理頁列表/搜尋（支援 cursor pagination）
- Query：
  - `kind=name|subject`（必填）
  - `query`（選填；模糊搜尋）
  - `vocabulary_code`（選填）
  - `status=active|inactive|all`（選填；預設 `active`）
  - `limit`、`cursor`

2) `GET /api/v1/orgs/:orgId/authority-terms/suggest`
- 用途：autocomplete 建議（不包 cursor；回 array）
- Query：
  - `kind=name|subject`（必填）
  - `q`（必填）
  - `vocabulary_code`（選填）
  - `limit`（選填；預設 20）

3) `POST /api/v1/orgs/:orgId/authority-terms`
- 用途：建立款目
- Body（摘要）：
  ```json
  {
    "kind": "subject",
    "preferred_label": "魔法",
    "variant_labels": ["巫術","魔術"],
    "vocabulary_code": "local"
  }
  ```

4) `PATCH /api/v1/orgs/:orgId/authority-terms/:termId`
- 用途：更新/停用款目（`status=inactive`）

---

## 3) Web：Authority 管理頁

新增頁面：`apps/web/app/orgs/[orgId]/authority-terms/page.tsx`

提供：
- kind/status/vocabulary_code/query filters
- cursor pagination「載入更多」
- 建立新款目（預設 `source=local`）
- 編輯/停用（status toggle）

並在 org sidebar 增加入口：`apps/web/app/orgs/[orgId]/layout.tsx`

### 3.1 編目表單：先用 autocomplete 引導一致用詞（v0 的實用點）
目前在兩個書目頁面加上「Authority helper」：
- 建立書目：`apps/web/app/orgs/[orgId]/bibs/page.tsx`
- 更新書目：`apps/web/app/orgs/[orgId]/bibs/[bibId]/page.tsx`

行為：
- 輸入關鍵字 → 呼叫 `GET /authority-terms/suggest` → 點選 `+ <preferred_label>` 直接加入 creators/subjects textarea（避免重複）

> 這樣做可以在不改資料模型的前提下，先把輸入拉向一致（同義詞/別名不會散落成多種拼法）。

---

## 4) Demo/Scale seed：內建詞彙庫示例

### 4.1 demo seed
`db/seed-demo.sql` 會為 demo org 插入一小組示例：
- subject：`builtin-zh`（例如：魔法/小說/寓言/成長…）
- name：`local`（對齊 demo 書目作者）

### 4.2 scale seed
`scripts/seed-scale.py` 會從生成的書目資料收斂出：
- subject：`builtin-zh`（rules provider 的 subject list）
- name：書目 creators（大量、可用來壓力測試管理頁/搜尋）

---

## 5) 如何驗證（手動）

1) demo：
```bash
npm run docker:demo
```

2) 進入後台並登入 staff（demo 帳號）後：
- 打開 `http://localhost:3000/orgs/<orgId>/authority-terms`
- 切換 `kind=subject`，用 `query=魔法` 等關鍵字測試搜尋
- 建立新款目，並測試停用/啟用

3) 大量資料（scale）：
```bash
npm run docker:scale
```
再進入同頁面，測試大量款目下的 list + cursor pagination。

---

## 6) 下一步（對齊你的排序）

- 再補 **MARC 匯入**（.mrc/MARCXML/JSON → 表單欄位 + marc_extras），並在匯入時：
  - 盡可能把 1XX/7XX/6XX 對應到 authority_terms（找不到就建立 local term 或存到 variant）
  - 未對映欄位落到 `marc_extras`，確保不丟資料
- 進一步產品化 authority control（較大改動，建議分兩段）：
  - A) creators/subjects UI 從 textarea 升級成「chips + autocomplete」（仍存 text[]，但 UX 更好）
  - B) 進階：做真正的 authority linking（以 id 綁定），再導入 thesaurus 關係（BT/NT/RT/USE/UF）
