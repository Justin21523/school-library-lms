# 0031：Thesaurus v1（BT/NT/RT + expand；主題詞字典控制）

本文件承接 `docs/implementation/0029-authority-vocabulary-v0.md`，把 **Authority / Vocabulary** 往「thesaurus（詞彙關係網）」推進，讓主題詞不只是「一串字」，而是可治理、可瀏覽、可用於檢索擴充的結構。

這一輪的定位（刻意做小，但要能用）：
- **BT/NT/RT**（上下位/相關詞）可以在後台 UI 維護
- 提供 **expand API**：把同義（UF）、上下位、相關詞「展開成 labels[]」，讓後續搜尋/推薦可以直接用

> 重要取捨（當時）：v1 仍不把 `bibliographic_records.subjects/creators` 改成 authority id 綁定（仍是 `text[]`）。本輪先把「詞彙治理與擴充入口」建好。  
> 後續演進：已在 `docs/implementation/0033-subject-normalization-and-authority-linking.md` 新增 **subjects 的 authority linking（term_id-driven）**，並把 thesaurus expand 從 `labels[]` 逐步推進到 `term_ids[]` 驅動查詢。

---

## 1) 資料模型：`authority_term_relations`

新增：
- enum：`authority_relation_type = ('broader','related')`
- table：`authority_term_relations`

### 1.1 為何只落地 `broader/related`（而不是直接存 narrower）

Thesaurus 的 BT/NT 是同一件事的兩個視角：
- A 是 B 的 **NT** ⇔ B 是 A 的 **BT**

因此 v1 採用「固定方向」存一種關係即可：
- `relation_type='broader'`：**narrower → broader** 方向存
  - 例：A（魔法史）BT B（魔法）→ 存成 `from=A, to=B, type=broader`
  - 反向查詢（`to=本 term`）即可得到 NT

這樣的好處：
- 資料表更簡單（避免同時存 BT 與 NT 兩套造成不一致）
- cycle 檢查也更直覺（沿著 broader chain 看祖先）

### 1.2 `related`（RT）只存一筆 canonical pair

RT 是對稱關係（A RT B ⇔ B RT A）。

v1 的策略：
- DB **只存一筆**，由服務層以 UUID 字串排序決定 `from/to`
- 避免 A↔B 存兩筆，造成去重、刪除、顯示都變複雜

### 1.3 v1 的資料品質規則（在 service 層強制）

新增/刪除關係時會驗證：
- 只能在同一個 `organization_id` 內建立（多租戶隔離）
- 兩端 term 必須同 `kind` 且同 `vocabulary_code`（避免跨詞彙庫亂連）
- `broader` 不可形成 cycle（用 recursive CTE 檢查）
- v1 先限制：**只有 `subject` 支援 BT/NT**（`name` 款目通常不做上下位）

對應實作：`apps/api/src/authority/authority.service.ts`

---

## 2) API：Term detail / Relations / Expand

端點皆在 StaffAuthGuard 下（後台主檔）。

### 2.1 Term detail（含 BT/NT/RT）

`GET /api/v1/orgs/:orgId/authority-terms/:termId`
- 用途：thesaurus 管理頁的「款目詳情」
- Response（摘要）：
  - `term`：authority_terms 款目本體
  - `relations.broader|narrower|related`：每筆包含：
    - `relation_id`（方便刪除）
    - `term`（對端 term 的 summary）

### 2.2 新增關係（BT/NT/RT）

`POST /api/v1/orgs/:orgId/authority-terms/:termId/relations`

Request body（以「目前 term 視角」表達）：
```json
{ "kind": "broader|narrower|related", "target_term_id": "uuid" }
```

行為：
- `broader`：新增 BT（DB 存 `from=current, to=target, type=broader`）
- `narrower`：新增 NT（DB 存 `from=target, to=current, type=broader`）
- `related`：新增 RT（DB 存 canonical pair，只會有一筆）

常見錯誤碼（摘要）：
- `TERM_KIND_MISMATCH`：兩端 term 的 `kind` 不同
- `VOCABULARY_CODE_MISMATCH`：兩端 term 的 `vocabulary_code` 不同
- `RELATION_NOT_SUPPORTED`：v1 不支援（例如 name 做 BT/NT）
- `THESAURUS_CYCLE`：broader 會形成 cycle

### 2.3 刪除關係

`DELETE /api/v1/orgs/:orgId/authority-terms/:termId/relations/:relationId`
- `termId` 用於防呆（確保你刪的是此 term 的關係）
- 成功後回傳最新的 term detail（方便 UI refresh）

### 2.4 Expand（檢索擴充用）

`GET /api/v1/orgs/:orgId/authority-terms/:termId/expand?include=...&depth=1`

目的：
- 給搜尋/推薦/自動補詞用：把「同義 + 上下位 + 相關」展開成 `labels[]`

Query：
- `include`：`self,variants,broader,narrower,related`（預設全開）
- `depth`：上下位展開深度（v1 會 clamp 到 `0..5`；`related` 僅 1 階）

Response（摘要）：
- `labels: string[]`：可直接拿去做查詢（OR/IN/全文檢索等）
- `broader_terms / narrower_terms / related_terms / variant_labels`：保留結構化資訊，方便 UI 顯示或除錯

---

## 3) Web：Thesaurus 管理頁（term detail）

新增頁面：
- `apps/web/app/orgs/[orgId]/authority-terms/[termId]/page.tsx`

提供：
- 顯示款目基本資訊（含 UF/variant_labels）
- 顯示 BT/NT/RT 清單（含刪除）
- 新增關係（透過 suggest 搜尋 target term，並限制同 `vocabulary_code`）
- expand 預覽（直接顯示 JSON；方便你確認「檢索擴充會拿到哪些詞」）

入口：
- `apps/web/app/orgs/[orgId]/authority-terms/page.tsx`：每筆 term 增加 `BT/NT/RT` 連結

---

## 4) Demo seed：示例關係

`db/seed-demo.sql` 追加少量 `authority_term_relations`，讓你一進 UI 就看得到效果：
- `報廢` BT `汰舊`
- `盤點` RT `汰舊`（canonical pair，只存一筆）

---

## 5) 如何驗證（手動）

1) 準備 demo：
```bash
npm run docker:demo
```

2) staff 登入後：
- 進入 `http://localhost:3000/orgs/<orgId>/authority-terms`
- 點任一筆 term 的 `BT/NT/RT` 進入詳情
- 測試：
  - 新增/刪除 `related`
  - subject term 新增 `broader/narrower`
  - 嘗試做出 cycle（應收到 `THESAURUS_CYCLE`）
  - `expand` depth=0/1/5 的差異

### 5.1 自動 smoke（建議）

若你想要把 thesaurus 檢查納入「一鍵驗證」流程，可直接跑：
```bash
npm run docker:test
```

說明：
- `docker:test` 會 reset demo DB，並在 docker network 內執行 `scripts/demo-smoke.mjs`
- smoke 內含 thesaurus API 檢查，並會建立一組 `vocabulary_code=qa` 的 QA 款目（便於辨識/後續清理）

---

## 6) 下一步（建議）

若要把 thesaurus 從「治理工具」變成「使用者可感知的提升」，建議順序：
1) **搜尋擴充落地**：OPAC/後台搜尋支援「用 authority 展開 subject」的可選模式（例如 `expand_subjects=true`）。
2) **真正的 authority linking**：把 `subjects/creators` 從 `text[]` 演進成 id 綁定（junction table），再把 thesaurus/同義詞真正套用到資料關聯。
3) **non-preferred term（USE/UF）表格化**：variant_labels 雖能用，但要支援更多欄位（scope note、來源、歷史用語）時，建議獨立成表。
