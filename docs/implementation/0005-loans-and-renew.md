# 實作說明 0005：借閱查詢（Loans）＋ 續借（Renew）

本文件說明我在第五輪實作完成的兩個關鍵功能：
1) **借閱查詢（Loans list）**：讓館員/管理者能快速查到「誰借了哪一冊、何時到期、是否逾期」。  
2) **續借（Renew）**：讓借閱紀錄（loan）能延長到期日，並且依政策限制續借次數，且會寫入稽核（audit）。

> 延續你的學習需求：本輪新增/修改的 TypeScript 程式檔同樣維持高密度註解，並在此文件以程式片段逐段解釋「為什麼」與「怎麼做」。

---

## 1) 這一輪完成了什麼（對照需求）

對照 `API-DRAFT.md`：
- 新增借閱查詢：`GET /api/v1/orgs/:orgId/loans`
- 落地續借：`POST /api/v1/orgs/:orgId/circulation/renew`

對照 `USER-STORIES.md`（以「現場可用」為優先）：
- 補齊 circulation 的日常工作流：借出/歸還後，要能「查與續借」

---

## 2) Loans list：為什麼需要獨立端點

你現在已經能借出/歸還，但現場最常見的問題是：
- 「這位同學現在借了哪些？什麼時候到期？」
- 「這本（條碼）現在在誰手上？」
- 「哪些借閱逾期？」

如果沒有 loans 查詢：
- 前端很難做「讀者借閱清單」
- 續借也沒有合理入口（因為 renew 需要知道 loan）

因此新增一個資源端點：
- `GET /api/v1/orgs/:orgId/loans`

對應程式：
- `apps/api/src/loans/loans.controller.ts`
- `apps/api/src/loans/loans.service.ts`
- `apps/api/src/loans/loans.schemas.ts`

---

## 3) Loans list：回傳什麼資料、為什麼要 join

loan 本體（loans table）只有：
- item_id / user_id / due_at / returned_at / renewed_count ...

但 UI 要顯示「可理解」資訊，通常還需要：
- 借閱者：`users.external_id`、`users.name`
- 冊：`item_copies.barcode`、`item_copies.call_number`
- 書名：`bibliographic_records.title`

因此 loans list 的 SQL 直接 join 出「loan + borrower + item + bib title」，前端就能直接畫表格/清單，而不必為每筆 loan 再打 N 次 API。

`apps/api/src/loans/loans.service.ts`
```ts
SELECT
  l.id, l.due_at, l.returned_at, l.renewed_count,
  (l.returned_at IS NULL AND l.due_at < now()) AS is_overdue,
  u.external_id AS user_external_id,
  i.barcode AS item_barcode,
  b.title AS bibliographic_title
FROM loans l
JOIN users u ...
JOIN item_copies i ...
JOIN bibliographic_records b ...
WHERE l.organization_id = $1
ORDER BY l.checked_out_at DESC
LIMIT $N
```

重點說明：
- `is_overdue` **用推導**（不存狀態），避免靠排程更新造成資料腐敗。
- 預設 `status=open`（未歸還）符合館員最常用情境。

---

## 4) Renew：續借的核心概念

續借不是改 item 的狀態，而是改 loan 的到期日：
- `loans.due_at` 延後
- `loans.renewed_count` +1
- 寫入 `audit_events` 追溯誰做的

因此 renew 是 circulation 的動作端點：
- `POST /api/v1/orgs/:orgId/circulation/renew`

對應程式：
- `apps/api/src/circulation/circulation.controller.ts`
- `apps/api/src/circulation/circulation.schemas.ts`
- `apps/api/src/circulation/circulation.service.ts`

---

## 5) Renew：交易（transaction）與鎖順序（避免死結）

renew 需要交易，因為它是「多步驟一致性操作」：
1) 讀 loan / item / policy（判斷可否續借）
2) 更新 loan（due_at/renewed_count）
3) 寫 audit

而且 renew 會跟 checkin/checkout 同時操作 loans/items，因此要注意鎖順序。

本專案既有鎖順序：
- checkout/checkin：先鎖 item（`FOR UPDATE`）再鎖 loan（`FOR UPDATE`）

因此 renew 也維持同一順序（重要！）：
- 先用 loan_id 找到 item 並鎖 item（`FOR UPDATE OF item_copies`）
- 再鎖 loan row（`FOR UPDATE`）

對應程式：
- `apps/api/src/circulation/circulation.service.ts`：`requireLoanRenewContextAndLockItem` + `requireLoanByIdForUpdate`

---

## 6) Renew：延長 due_at 的策略（為什麼用 GREATEST）

續借常見策略有兩種：
1) 從「現在」開始加借期（可能讓提早續借的人吃虧）
2) 從「原 due_at」開始加借期（較符合直覺）

本專案採用折衷且常見的做法：
- 以 `GREATEST(due_at, now())` 作為起點，再加上 `loan_days`

這能避免：
- 使用者提早續借，反而把期限縮短（不合理）

`apps/api/src/circulation/circulation.service.ts`
```ts
UPDATE loans
SET
  due_at = GREATEST(due_at, now()) + ($1::int * interval '1 day'),
  renewed_count = renewed_count + 1
WHERE organization_id = $2
  AND id = $3
  AND returned_at IS NULL
RETURNING due_at, renewed_count
```

---

## 7) Renew：續借限制（policy + holds）

MVP 先落地兩個最重要的限制：
1) **max_renewals**：`renewed_count >= policy.max_renewals` 就拒絕
2) **queued holds**：同書目有人排隊（`holds.status='queued'`）就拒絕（公平性）

對應程式：
- `apps/api/src/circulation/circulation.service.ts`：`max_renewals` 檢查、`hasQueuedHold`

> 註：各館政策可能不同（例如允許排隊時仍可續借一次），這裡先用最保守且好理解的規則做 MVP。

---

## 8) Web Console：Loans 頁如何串接

新增 Web Console 頁面：
- `/orgs/:orgId/loans`

它做三件事：
1) 查詢 loans（預設 open）
2) 顯示 borrower/item/title/due_at/逾期
3) 對 open loan 顯示「續借」按鈕（呼叫 renew）

對應程式：
- `apps/web/app/orgs/[orgId]/loans/page.tsx`
- `apps/web/app/lib/api.ts`：`listLoans()`、`renewLoan()`

---

## 9) 如何手動驗證（建議路徑）

前置：
1. `docker compose up -d postgres redis`
2. 匯入 `db/schema.sql`
3. `npm run dev`（web+api）

驗證：
1) 在 `/orgs/:orgId/users` 建立一個 `librarian`（作為 actor）與一個 `student`（borrower）  
2) 在 `/orgs/:orgId/circulation-policies` 建立 student policy（max_renewals >= 1）  
3) 建書目與冊（/bibs → bib detail 新增 item）  
4) 借出（/circulation checkout）  
5) 到 `/orgs/:orgId/loans` 查到 open loan → 點「續借」 → due_at/renewed_count 應更新  

---

## 10) 本輪新增/修改的主要檔案

API：
- `apps/api/src/loans/*`：loans list 模組
- `apps/api/src/circulation/circulation.controller.ts`：新增 `POST renew`
- `apps/api/src/circulation/circulation.schemas.ts`：新增 renew schema
- `apps/api/src/circulation/circulation.service.ts`：新增 renew transaction + 鎖順序 + policy/hold 限制

Web：
- `apps/web/app/orgs/[orgId]/loans/page.tsx`：Loans UI + renew 操作
- `apps/web/app/lib/api.ts`：新增 `listLoans`/`renewLoan` 與型別

Docs：
- `API-DRAFT.md`：補上 loans/renew 契約（含 actor_user_id）

