# 0036 — Bibs 檢索：term_id filters（chips + 多選 + thesaurus expand）

你要把檢索從「靠字串長相」逐步改成 term_id-driven，因此 Bibs 搜尋頁要做到：
- filter 可以選多個 authority terms（chips）
- 可選擇是否做 thesaurus 展開（同義/上下位/相關）
- URL deep link（`?subject_term_ids=...` 等）能反推回 UI（至少能看到已套用的 chips）

---

## 1) 變更摘要

### 1.1 搜尋 UI：單選 → 多選 chips
檔案：`apps/web/app/orgs/[orgId]/bibs/page.tsx`
- subject/geographic/genre filters 改用 `TermMultiPicker`（chips + 搜尋 + 瀏覽）
- 支援多選與排序（排序主要是 UX；API filter 本身是 ANY 命中）

### 1.2 Expand：subject/geographic/genre 都可選擇展開
檔案：`apps/web/app/orgs/[orgId]/bibs/page.tsx`
- 新增三個 expand 開關（650/651/655 各自一個）
- depth 共用一個輸入（0..5；前後端都會 clamp）

### 1.3 Deep link：URL term_ids → chips
檔案：`apps/web/app/orgs/[orgId]/bibs/page.tsx`
- 單一 UUID：會 resolve label（`GET /authority-terms/:id`）
- 多個 UUID：通常代表 expand 後結果
  - 避免 UI 再 expand 一次 → 自動把 expand 關掉
  - chips 先用 placeholder（前 20 個）顯示（避免大量 network calls）

### 1.4 chips 連回主檔
檔案：`apps/web/app/components/authority/term-multi-picker.tsx`
- 每個 chip 增加「主檔」連結 → `/orgs/:orgId/authority-terms/:termId`

---

## 2) 關鍵程式碼片段

### 2.1 將多個 base terms 轉成 query param（term_id-driven）
檔案：`apps/web/app/orgs/[orgId]/bibs/page.tsx`

```ts
const expanded = await Promise.all(
  terms.map((t) =>
    expandAuthorityTerm(orgId, t.id, { include: 'self,variants,broader,narrower,related', depth }),
  ),
);
return uniqStrings(expanded.flatMap((x) => x.term_ids)).join(',');
```

### 2.2 deep link 的安全策略（多個 term_ids 不再自動 expand）
檔案：`apps/web/app/orgs/[orgId]/bibs/page.tsx`

```ts
if (subjectIds.length > 1) {
  setExpandSubjectFilter(false);
  setSubjectFilterTerms(subjectIds.slice(0, 20).map(litePlaceholderFromId));
}
```

---

## 3) 如何驗證
- Build：`npm run build -w @library-system/web`
- 手動：
  - `/orgs/:orgId/bibs` → filters 可多選 chips
  - 勾選 expand + 設 depth → 搜尋結果應擴充（ANY 命中）
  - 點 chip「主檔」→ 進 term detail，再點「在 Bibs 以此 term 過濾」能回到 `/bibs?subject_term_ids=...`

