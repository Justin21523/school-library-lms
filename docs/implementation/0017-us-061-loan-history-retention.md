# 實作說明 0017：US-061 借閱歷史保存期限（Loans purge-history：preview/apply + audit）

本文件說明我在第 17 輪新增的「資料保存期限（Retention）」能力：讓系統管理者（admin）能用 Maintenance 端點分批清理過久的借閱歷史（已歸還的 loans），並寫入 audit 方便追溯。

本輪新增：
- API：`POST /api/v1/orgs/:orgId/loans/purge-history`（`mode=preview|apply`）
- Web Console：`/orgs/:orgId/loans/maintenance`
- Audit：apply 會寫入 `audit_events`（action=`loan.purge_history`）

---

## 1) 為什麼要做保存期限（Retention）

借閱歷史屬於「行為資料」，通常也包含個資（可回推某人借過什麼書）。  
若無限制地永久保存，會帶來兩個風險：
1) **隱私/合規風險**：保存時間越長，外洩或被濫用的風險越高  
2) **系統成本**：資料越大，備份/查詢/匯出成本越高

因此 US-061 的方向是：
- 到期後可刪除或彙總（MVP 先做「刪除」）

---

## 2) API 設計：preview/apply（不可逆操作必須可預覽）

端點：
- `POST /api/v1/orgs/:orgId/loans/purge-history`

Request（JSON）：
- `actor_user_id`：必填（且必須是 `admin`、active）
- `mode`：`preview|apply`
- `retention_days`：必填（保存天數；避免不小心刪光）
- `as_of`：選填（留空則由後端用 DB now()）
- `limit`：選填（分批；preview/apply 都會受限）
- `include_audit_events`：選填（預設 false；若 true 會連同被刪 loans 的 `audit_events(entity_type='loan')` 一起刪）
- `note`：選填（寫入 audit metadata）

為什麼要 `mode=preview|apply`？
- 刪除是不可逆的；預覽能讓管理者先看到候選清單與 cutoff，降低誤刪風險
- apply 用 limit 分批，可讓你逐次確認結果（也避免一次刪太久）

---

## 3) cutoff 的定義：`cutoff = as_of - retention_days`

我們以 `returned_at` 作為「借閱結束」的時間點：
- 只刪 `returned_at IS NOT NULL` 的 loans（不會動到 open loans）
- 刪除條件：`returned_at < cutoff`

`apps/api/src/loans/loans.service.ts`
```ts
SELECT ($1::timestamptz - ($2::int * interval '1 day'))::timestamptz::text AS cutoff
```

為什麼用 DB now()？
- 避免 API server 與 DB 時鐘差（與其他模組一致）

---

## 4) 併發與安全：為什麼 apply 用 `FOR UPDATE SKIP LOCKED`

雖然「已歸還的 loans」通常不會被櫃台流程修改，但：
- 多位 admin 同時按 apply 仍可能互相卡住
- 或你可能在自動化（cron）與手動同時執行

因此 apply 先用：
```sql
SELECT id
FROM loans
WHERE ...
ORDER BY returned_at ASC
LIMIT $3
FOR UPDATE SKIP LOCKED
```

效果：
- 兩個 purge 交易不會搶同一批 loans
- 不會因為某筆被鎖就整批卡住

---

## 5) Audit：apply 只寫一筆事件（而不是每筆 loan 一個）

與 holds expire 不同，loan retention 可能一次刪除數百/數千筆：
- 若每筆 loan 都寫 audit event，稽核表會被灌爆

因此本輪採「單一事件」策略：
- action=`loan.purge_history`
- entity_type=`maintenance`
- entity_id=`loan_history`
- metadata 內記錄：as_of、retention_days、cutoff、include_audit_events、deleted counts、deleted ids sample、note

---

## 6) Web Console：/loans/maintenance 怎麼用

1) 選擇 actor_user_id（必須是 admin）
2) 輸入 retention_days（例如 365）
3) 先按 Preview 看：
   - cutoff
   - candidates_total
   - 候選清單（returned_at/borrower/item/title）
4) 再按 Apply（會跳確認視窗）
5) 到 `/audit-events` 用 action=`loan.purge_history` 查追溯

建議：
- **先做 DB 備份**再 apply（尤其是第一次導入）
- 候選筆數很多時，分批多次 apply（limit 控制）

---

## 7) 本輪新增/修改的主要檔案

API：
- `apps/api/src/loans/loans.schemas.ts`
- `apps/api/src/loans/loans.controller.ts`
- `apps/api/src/loans/loans.service.ts`

Web：
- `apps/web/app/lib/api.ts`
- `apps/web/app/orgs/[orgId]/loans/maintenance/page.tsx`
- `apps/web/app/orgs/[orgId]/loans/page.tsx`
- `apps/web/app/orgs/[orgId]/layout.tsx`
- `apps/web/app/orgs/[orgId]/audit-events/page.tsx`

Docs：
- `API-DRAFT.md`
- `docs/implementation/0017-us-061-loan-history-retention.md`

