# 實作說明 0020：逾期停權/借閱限制（Policy enforcement）

本文件說明我在第 20 輪把 `MVP-SPEC.md` 的「逾期達 X 天停權新增借閱」規則落地到 API 與 Web Console 的過程。這是學校現場最常被問的規則之一：**「為什麼我不能借？」**

本輪新增/調整：
- DB：`circulation_policies` 新增 `overdue_block_days int NOT NULL DEFAULT 0`
- API：新增共用 helper `assertBorrowingAllowedByOverdue()`，並套用到：
  - checkout（借出）
  - renew（續借）
  - hold create（新增預約）
  - hold fulfill（取書借出）
- Web Console：
  - 政策頁新增 `overdue_block_days` 欄位
  - 針對錯誤碼 `BORROWING_BLOCKED_DUE_TO_OVERDUE` 顯示可讀原因（門檻/逾期天數/筆數）

---

## 1) 需求：為什麼要「停權新增借閱」

中小學現場多半不收罰款，而是用「停權」或「提醒」達到管理目的。  
因此 `MVP-SPEC.md` 直接把預設政策定為：
- 學生：逾期達 7 天停權新增借閱
- 教師：逾期達 14 天停權新增借閱

本專案把「新增借閱」定義為四種動作：
- checkout：建立 loan
- renew：延長 loan（等同延長借閱）
- hold create：新增預約（避免堆積）
- hold fulfill：取書借出（建立 loan）

---

## 2) DB：把規則放在 circulation_policies（避免寫死）

`db/schema.sql`
```sql
ALTER TABLE circulation_policies
  ADD COLUMN overdue_block_days int NOT NULL DEFAULT 0;
```

設計取捨：
- `0` 代表「不啟用停權」：允許某些學校先不上這條規則（MVP 容錯）
- 以 policy 控管，而不是在 users 表加 `suspended`：
  - 避免「誰來解除」與「解除後是否一致」的資料不一致問題
  - 直接由 loans 推導，規則永遠跟資料一致

---

## 3) API：共用 helper（避免規則分散在各 service）

`apps/api/src/common/borrowing-block.ts`
```ts
export async function assertBorrowingAllowedByOverdue(client, orgId, borrowerId, overdueBlockDays) {
  if (overdueBlockDays <= 0) return;

  // max_days_overdue：用整天數（floor）推導，與 /reports/overdue 一致
  // FLOOR((now - due_at) / 86400)
  ...

  throw new ConflictException({
    error: {
      code: 'BORROWING_BLOCKED_DUE_TO_OVERDUE',
      message: 'Borrower is blocked due to overdue loans',
      details: { overdue_block_days, overdue_loan_count, max_days_overdue, example_overdue_loan_ids },
    },
  });
}
```

關鍵設計：
- 使用 `409 Conflict` 表示「目前狀態不允許進行動作」
- 用 `details` 回傳現場需要的資訊（門檻/天數/筆數），讓 UI 能直接回答

---

## 4) 套用點：checkout / renew / hold / fulfill

### 4.1 checkout（借出）
`apps/api/src/circulation/circulation.service.ts`
```ts
const policy = await this.getPolicyForRole(...);
await assertBorrowingAllowedByOverdue(client, orgId, borrower.id, policy.overdue_block_days);
```

### 4.2 renew（續借）
續借本質是「延長借閱」，因此同樣禁止。

### 4.3 hold create / fulfill
如果只擋 checkout/renew，讀者仍能靠大量預約堆積，或在取書時才被擋造成櫃台困擾。  
因此本輪把規則套到 hold create 與 fulfill（取書借出）：
- create：避免堆積與繞過
- fulfill：避免在櫃台才出現不可借的狀況（但仍保留可還書/取消）

---

## 5) Web Console：政策設定 + 錯誤顯示

### 5.1 政策頁新增 overdue_block_days
`/orgs/:orgId/circulation-policies`
- 新增/列表都顯示 `overdue_block_days`

### 5.2 錯誤訊息：顯示「為什麼被擋」
`apps/web/app/lib/error.ts` 針對 `BORROWING_BLOCKED_DUE_TO_OVERDUE` 做特例格式化：
- 顯示 `max_days_overdue >= overdue_block_days`
- 顯示 `overdue_loan_count`

---

## 6) 如何手動驗證（建議路徑）

1) 設定 policy：
   - student 的 `overdue_block_days=1`（方便快速測）
2) 準備一筆 open loan，並讓它逾期：
   - 最快方式：在 DB 把 `loans.due_at` 改成昨天
3) 用同一位 borrower 嘗試：
   - checkout（應回 409 + `BORROWING_BLOCKED_DUE_TO_OVERDUE`）
   - renew（應回 409）
   - place hold（應回 409）
4) Web Console 應顯示可讀原因（門檻/逾期天數/筆數）

---

## 7) 本輪新增/修改的主要檔案

DB：
- `db/schema.sql`

API：
- `apps/api/src/common/borrowing-block.ts`
- `apps/api/src/circulation/circulation.service.ts`
- `apps/api/src/holds/holds.service.ts`
- `apps/api/src/policies/policies.schemas.ts`
- `apps/api/src/policies/policies.service.ts`

Web：
- `apps/web/app/orgs/[orgId]/circulation-policies/page.tsx`
- `apps/web/app/lib/api.ts`
- `apps/web/app/lib/error.ts`

