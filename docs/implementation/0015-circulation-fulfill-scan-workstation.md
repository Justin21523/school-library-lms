# 實作說明 0015：櫃台取書借出掃碼工作台（Circulation：掃冊條碼 → fulfill）

本文件說明我在第 15 輪為 Web Console 新增的櫃台功能：在 `/orgs/:orgId/circulation` 增加一個最貼近現場的區塊 —— **取書借出（Fulfill / 掃冊條碼）**。

> 核心概念：現場「取書借出」是以冊條碼操作，但後端 fulfill 端點需要 `hold_id`；因此我們在前端把它串起來：掃冊條碼 → 查 `ready hold` → 呼叫 fulfill → 回顯 due_at。

---

## 1) 需求場景（為什麼要做在 Circulation 頁）

學校現場的「預約到書」通常是這樣跑：
1) 讀者預約（hold）排隊
2) 有冊可供取書時，hold 進入 `ready`（冊被指派並標記為 `on_hold`）
3) 館員把冊放到「取書架」（可能依班級/姓名分格）
4) 讀者到館取書：館員拿到那一本冊，**直接掃條碼**完成借出

原本我們已經有：
- Holds 工作台：可以點按 `fulfill`（但你需要先找到那一筆 hold）

這次補的 UI 讓櫃台流程更直覺：
- 讀者來了 → 掃冊條碼 → 系統自動找出對應的 ready hold → 立刻完成借出

---

## 2) API 串接策略（為什麼要先 listHolds）

後端 fulfill 端點是以 hold 為主鍵的動作端點：
- `POST /api/v1/orgs/:orgId/holds/:holdId/fulfill`

但櫃台輸入是冊條碼（item_barcode），所以我們需要「條碼 → hold_id」的查詢：
- `GET /api/v1/orgs/:orgId/holds?status=ready&item_barcode=...`

因此前端流程是：
1) 用條碼查詢 ready holds（理論上應回 1 筆）
2) 若剛好回 1 筆：直接拿到 `hold.id` 呼叫 fulfill
3) 若回 0 筆：提示館員可能原因（已取消/已過期/條碼不是取書架冊）
4) 若回多筆：顯示候選清單讓館員手動選（屬於資料不一致的保險路徑）

---

## 3) 前端實作重點（程式碼片段 + 解釋）

### 3.1 新增 UI 區塊：取書借出（Fulfill / 掃冊條碼）

`apps/web/app/orgs/[orgId]/circulation/page.tsx`
```tsx
<form onSubmit={onFulfillByBarcode}>
  <label>
    item_barcode（取書冊條碼）
    <input value={fulfillBarcode} onChange={(e) => setFulfillBarcode(e.target.value)} />
  </label>
  <button type="submit">取書借出</button>
</form>
```

設計理由：
- 保持與 checkout/checkin 一樣的「掃碼表單」操作感
- 讓館員不用切換頁面或先去 holds 工作台找人

### 3.2 掃碼 submit：先找 hold，再 fulfill

`apps/web/app/orgs/[orgId]/circulation/page.tsx`
```ts
const candidates = await listHolds(params.orgId, {
  status: 'ready',
  item_barcode: trimmedBarcode,
  limit: 5,
});

if (candidates.length === 1) {
  const hold = candidates[0]!;
  const result = await fulfillHold(params.orgId, hold.id, { actor_user_id: actorUserId });
  setFulfillResult(result);
}
```

幾個關鍵點：
- `status=ready`：避免掃到 `queued/expired/fulfilled` 的歷史資料
- `limit=5`：保險（理論上不會超過 1 筆，但避免資料不一致時拉爆）
- fulfill 成功後回傳 `due_at`：可以直接告知讀者「哪一天到期」

---

## 4) 如何驗證（建議路徑）

1) 先準備一筆 ready hold（例如：書目有 available item 時建立 hold 會自動 ready）
2) 確認 item 變成 `on_hold` 且 hold 有 `assigned_item_barcode`
3) 到 `/orgs/:orgId/circulation`
4) 在「取書借出（Fulfill / 掃冊條碼）」輸入該冊 `item_barcode`
5) 成功後應看到：
   - `loan_id`
   - `due_at`
6) 回到 `/orgs/:orgId/holds` 查詢該 hold 應為 `fulfilled`

---

## 5) 本輪新增/修改的主要檔案

Web：
- `apps/web/app/orgs/[orgId]/circulation/page.tsx`

Docs：
- `docs/implementation/0015-circulation-fulfill-scan-workstation.md`

