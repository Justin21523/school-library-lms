# 實作說明 0006：預約/保留（Holds）＋ OPAC 自助

本文件說明我在第六輪實作完成的兩個關鍵能力：
1) **Holds（預約/保留）**：以「書目」為單位排隊（queued），並在可取書時轉為 ready，最終由館員 fulfill（取書借出）。  
2) **OPAC 自助流程**：讀者可以在 Web 上搜尋書目並自助預約、查自己的預約、取消預約（第六輪時採「無登入」的 `user_external_id` 模式；後續已補上 OPAC Account，見 `docs/implementation/0022-opac-account.md`）。

> 延續你的學習需求：本輪新增/修改的 TypeScript/TSX 檔案同樣維持高密度註解；本文件會用「程式片段 + 解釋」把狀態機、鎖（lock）、一致性（consistency）的原因講清楚。

---

## 1) 這一輪完成了什麼（對照需求）

對照 `API-DRAFT.md`：
- 建立預約：`POST /api/v1/orgs/:orgId/holds`
- 查詢預約：`GET /api/v1/orgs/:orgId/holds`
- 取消預約：`POST /api/v1/orgs/:orgId/holds/:holdId/cancel`
- 完成取書借出：`POST /api/v1/orgs/:orgId/holds/:holdId/fulfill`

對照 `USER-STORIES.md`（MVP 優先）：
- 借不到時能排隊（預約）
- 有人歸還時能進入「可取書」並保留一段時間
- 館員能完成取書借出（從 hold 產生 loan）
- 讀者能自助查詢/取消自己的預約（OPAC）

---

## 2) Holds 的狀態機（為什麼要這樣拆）

本專案的 holds 狀態（DB enum：`hold_status`）：
- `queued`：排隊中（尚未有指派冊）
- `ready`：可取書（已指派某一冊 `assigned_item_id`，該冊被標記為 `on_hold`）
- `fulfilled`：已完成取書借出（已建立 loan）
- `cancelled`：已取消（可保留歷史紀錄）
- `expired`：取書逾期（MVP 先保留狀態位，之後再補批次/通知）

為什麼不只用「active/inactive」？
- 因為 ready/fulfilled/cancelled 的後續處理不同（例如 ready 取消要釋放冊）
- 因為我們要把「公平排隊」與「冊的鎖定/釋放」變成可追溯的資料狀態

---

## 3) 一致性與公平性：為什麼 create 不是「直接把冊給新建的 hold」

關鍵規則：**永遠把可借冊指派給「隊首 queued hold」**（`placed_at` 最早者）。

如果 create 時直接把 available item 指派給「剛建立的 hold」，會破壞公平：
- A 先排隊、B 後排隊；剛好有一冊 available
- 若 B 的 create 交易先跑到「指派」那步，B 就插隊了

因此我把指派邏輯抽成「只做一件事」的 helper：
- 找隊首 queued hold（鎖住它）
- 找一冊 available item（鎖住它，且 `SKIP LOCKED`）
- item → `on_hold`
- hold → `ready`（寫入 `ready_at/ready_until/assigned_item_id`）

`apps/api/src/holds/holds.service.ts`
```ts
// 建立 hold 後，不直接把冊給「新建者」，而是嘗試把冊給「隊首 queued」
await this.tryAssignAvailableItemToNextQueuedHold(client, orgId, input.bibliographic_id);
```

`apps/api/src/holds/holds.service.ts`
```ts
// item 用 FOR UPDATE SKIP LOCKED：避免兩個交易搶到同一冊
SELECT id, barcode
FROM item_copies
WHERE organization_id = $1
  AND bibliographic_id = $2
  AND status = 'available'
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

---

## 4) DB 約束：避免重複排隊（以及併發造成的重複資料）

除了在 Service 做「先查是否已有 active hold」的預檢，我也在 DB 加了 partial unique index：
- 同一 org + 同一 user + 同一 bibliographic_id  
  在 `status IN ('queued','ready')` 時只能有一筆

`db/schema.sql`
```sql
CREATE UNIQUE INDEX IF NOT EXISTS holds_one_active_per_user_bib
  ON holds (organization_id, bibliographic_id, user_id)
  WHERE status IN ('queued'::hold_status, 'ready'::hold_status);
```

這能防兩種問題：
1) UI 連點兩下造成重複排隊  
2) 併發下「兩個交易都先查不存在 → 同時 insert」造成重複資料（Service 預檢無法完全避免）

---

## 5) 取消 ready hold：為什麼要「轉讓」或「釋放」冊

取消 queued 很單純：只是把 hold 標記 cancelled。

但取消 ready 會影響 item：
- ready 代表「某一冊已被鎖在 on_hold」
- 若取消後不處理 item，那冊會永遠卡在 on_hold，無法借出

因此 cancel ready 的規則是：
- 若同書目仍有人 queued → 把同一冊轉給下一位 queued（下一位變 ready）
- 否則 → item 釋放回 `available`

`apps/api/src/holds/holds.service.ts`
```ts
if (hold.status === 'ready' && hold.assigned_item_id) {
  const item = await this.requireItemByIdForUpdate(client, orgId, hold.assigned_item_id);
  if (item.status === 'on_hold') {
    const next = await this.findNextQueuedHold(client, orgId, hold.bibliographic_id);
    if (next) {
      // 轉給下一位：更新下一筆 hold → ready（item 維持 on_hold）
    } else {
      // 沒人排隊：釋放 item → available
    }
  }
}
```

---

## 6) Fulfill：為什麼不是重用 checkout endpoint

表面上 fulfill 很像 checkout（借出），但它多了「保留語意」：
- 只能對 ready hold 操作
- item 必須是 `on_hold`
- 完成後要把 hold → fulfilled，並建立 loan

因此我新增獨立動作端點：
- `POST /api/v1/orgs/:orgId/holds/:holdId/fulfill`

`apps/api/src/holds/holds.service.ts`
```ts
// 1) 檢查 hold=ready 且有 assigned_item_id
// 2) 檢查 item.status=on_hold
// 3) 建立 loan
// 4) item: on_hold → checked_out
// 5) hold: ready → fulfilled
```

> 取捨：MVP 先讓「取書借出」走 fulfill；未來若要做更完整的館員 UI，也可以在 circulation checkout 增加「指定 hold_id」的變體，但要非常小心一致性與狀態轉移。

---

## 7) Web Console（館員）如何操作 holds

新增頁面：
- `/orgs/:orgId/holds`：提供查詢、建立、取消、fulfill

使用方式（概念）：
- 館員在頁面選擇 `actor_user_id`（admin/librarian）
- 查詢 holds：可用 status/user_external_id/bibId/item_barcode/pickup_location_id 過濾
- 建立 hold：輸入 borrower `user_external_id` + `bibliographic_id` + `pickup_location_id`
- fulfill：對 ready holds 點按鈕（會回傳 loan_id/due_at 供確認）

對應程式：
- `apps/web/app/lib/api.ts`：新增 holds 相關呼叫
- `apps/web/app/orgs/[orgId]/holds/page.tsx`：Holds 管理 UI

---

## 8) OPAC（讀者自助）如何操作 holds

新增 OPAC 路由（第六輪時為 MVP 無登入，因此靠 `user_external_id`）：
- `/opac`：入口
- `/opac/orgs`：選擇學校（org）
- `/opac/orgs/:orgId`：搜尋書目並「Place hold」
- `/opac/orgs/:orgId/holds`：輸入 `user_external_id` 查詢自己的 holds + 取消

重要安全註記（MVP 限制）：
- 因為沒有 auth，「任何人只要知道 external_id 就能查/取消」存在冒用風險
- 目前先以「holdId 是 UUID、不易猜」降低部分風險；真正解法是導入登入（例如校務 SSO）

後續更新（請以最新版為準）：
- 已新增 OPAC Account（讀者登入 + `/me/*`）：見 `docs/implementation/0022-opac-account.md`
- 在 Web 端：已登入會走 `/api/v1/orgs/:orgId/me/holds`；未登入仍保留 `user_external_id` 模式作為過渡

---

## 9) 如何手動驗證（建議路徑）

前置：
1. `docker compose up -d postgres redis`
2. 匯入 `db/schema.sql`
3. `npm run dev`（web+api）

驗證建議流程：
1) 建立 org / locations / users（含 librarian + student/teacher）  
2) 建立 circulation policies（student/teacher 的 max_holds、hold_pickup_days）  
3) 建立 bib + item（先讓 item 借出，才能測 queued）  
4) 用 OPAC 建立 hold（應為 queued）  
5) 歸還 item（checkin 後應觸發 hold → ready，item → on_hold）  
6) 在 Web Console `/holds` 看到 ready hold → fulfill（應建立 loan，item → checked_out，hold → fulfilled）  
7) 再測 cancel：取消 queued 與取消 ready（ready 取消應釋放或轉給下一位）

---

## 10) 本輪新增/修改的主要檔案

API：
- `apps/api/src/holds/*`：holds controller/service/schemas/module
- `apps/api/src/app.module.ts`：掛入 HoldsModule
- `apps/api/src/circulation/circulation.service.ts`：policy join 調整（取最新政策）

DB：
- `db/schema.sql`：新增 `holds_one_active_per_user_bib` partial unique index

Web：
- `apps/web/app/lib/api.ts`：新增 holds API client
- `apps/web/app/orgs/[orgId]/holds/page.tsx`：館員 holds 管理頁
- `apps/web/app/opac/**`：OPAC 自助頁面

Docs：
- `API-DRAFT.md`：補齊 holds 端點契約與 actor_user_id 規則
