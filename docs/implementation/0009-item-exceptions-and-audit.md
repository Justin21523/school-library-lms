# 實作說明 0009：冊異常狀態（lost/repair/withdrawn）＋ 稽核（audit）

本文件說明我在第九輪實作完成的功能（US-045）：
- **冊異常狀態（Item Exceptions）**：館員可把冊標記為 `lost/repair/withdrawn`
- **寫入稽核（audit_events）**：每次狀態標記都會留下可追溯的事件（可在 `/audit-events` 查詢）

> 延續你的學習需求：本輪新增/修改的程式檔依舊維持高密度註解；本文件會用程式片段逐段解釋「為什麼 status 不能用 PATCH 亂改」、「如何設計狀態轉換規則」以及「如何寫 audit」。

---

## 1) 這一輪完成了什麼（對照需求）

對照 `USER-STORIES.md`：
- US-045 遺失/修復/報廢（Item Exceptions）
  - 驗收：可將冊狀態改為 `lost/repair/withdrawn`
  - 驗收：此動作寫入稽核紀錄

對照 `API-DRAFT.md`：
- 補齊 item status actions（mark-lost/mark-repair/mark-withdrawn）

對應程式：
- API：
  - `apps/api/src/items/items.controller.ts`
  - `apps/api/src/items/items.service.ts`
  - `apps/api/src/items/items.schemas.ts`
- Web：
  - `apps/web/app/orgs/[orgId]/items/[itemId]/page.tsx`
  - `apps/web/app/lib/api.ts`
- 稽核查詢（前一輪已完成，這輪新增 action 提示）：
  - `apps/web/app/orgs/[orgId]/audit-events/page.tsx`

---

## 2) 為什麼「冊狀態」不能用 PATCH 直接改

`item_copies.status` 會影響：
- 借出（checkout）是否允許（必須是 `available`）
- 續借（renew）是否允許（必須是 `checked_out`）
- holds 指派/保留（`on_hold`）
- 報表（例如逾期清單）與現場判斷

如果允許前端用 `PATCH /items/:itemId` 直接改 `status`：
- 很容易出現「沒有 actor、沒有 audit」的狀態異動 → 事後無法追溯
- 很容易出現不合理轉換（例如 `on_hold → withdrawn`）→ 破壞 hold/流通流程

因此本輪把 `status` 從一般 PATCH schema 移除，改用「動作端點」：
- 有明確語意（mark-lost/mark-repair/mark-withdrawn）
- 強制要求 `actor_user_id`（館員/管理者）
- 集中做狀態轉換防呆與 audit 寫入

`apps/api/src/items/items.schemas.ts`
```ts
export const updateItemSchema = z.object({
  barcode: z.string().optional(),
  call_number: z.string().optional(),
  location_id: z.string().uuid().optional(),
  // status 被移除：避免無追溯的狀態異動
  notes: z.string().nullable().optional(),
});
```

---

## 3) API：三個 action endpoints（含 actor_user_id）

新增端點：
- `POST /api/v1/orgs/:orgId/items/:itemId/mark-lost`
- `POST /api/v1/orgs/:orgId/items/:itemId/mark-repair`
- `POST /api/v1/orgs/:orgId/items/:itemId/mark-withdrawn`

Request（共通）：
- `actor_user_id`：必填（admin/librarian）
- `note`：選填（寫入 audit metadata）

`apps/api/src/items/items.controller.ts`
```ts
@Post('items/:itemId/mark-lost')
async markLost(..., @Body(new ZodValidationPipe(markItemLostSchema)) body: any) {
  return await this.items.markLost(orgId, itemId, body);
}
```

---

## 4) 不合理狀態轉換：MVP 先落地的規則

本輪規則（先保守，避免破壞核心流程）：
- `mark-repair`：只允許 `available → repair`
- `mark-withdrawn`：只允許 `available/repair/lost → withdrawn`，且**不得有 open loan**
- `mark-lost`：只允許 `available/checked_out → lost`，且 `on_hold` 會被拒絕（避免破壞 ready hold）

`apps/api/src/items/items.service.ts`
```ts
if (oldStatus === 'on_hold') {
  throw new ConflictException({ error: { code: 'ITEM_ASSIGNED_TO_HOLD', ... } });
}

if (oldStatus !== 'available' && oldStatus !== 'checked_out') {
  throw new ConflictException({ error: { code: 'ITEM_STATUS_TRANSITION_NOT_ALLOWED', ... } });
}
```

這些規則的目的不是「一次做完所有館藏例外處理」，而是：
- 先保證資料不會被不合理的狀態轉換破壞
- 讓後續要擴充（例如遺失賠償、遺失後關閉 loan、on_hold 遺失時的自動轉讓）有清楚切入點

---

## 5) 寫入 audit_events：如何讓 `/audit-events` 立即可追溯

每個 action 會寫入一筆 audit event：
- action：`item.mark_lost` / `item.mark_repair` / `item.mark_withdrawn`
- entity_type：`item`
- entity_id：item.id
- metadata：至少包含 `from_status/to_status`、barcode、bibId；lost 時加上 open loan 資訊（若有）

`apps/api/src/items/items.service.ts`
```ts
await client.query(
  `INSERT INTO audit_events (...) VALUES (...)`,
  [orgId, actor.id, 'item.mark_lost', 'item', item.id, JSON.stringify({ from_status, to_status, ... })],
);
```

完成後，你可以在 Web Console：
- `/orgs/:orgId/audit-events`
用 `action=item.mark_lost` 快速查到誰在什麼時間把哪一冊標記遺失。

---

## 6) Web Console：Item Detail 的快捷按鈕

在冊詳情頁新增區塊：
- 選 `actor_user_id`（admin/librarian）
- 選填 `note`
- 三個快捷按鈕：lost / repair / withdrawn

`apps/web/app/orgs/[orgId]/items/[itemId]/page.tsx`
```tsx
<button onClick={() => markItemLost(orgId, itemId, { actor_user_id, note })}>
  標記遺失（lost）
</button>
```

前端也會做基本防呆（例如 repair 只在 available 時可按），但真正的規則仍以後端為準（避免被繞過）。

---

## 7) 如何手動驗證（建議路徑）

前置：
1. `docker compose up -d postgres redis`
2. 匯入 `db/schema.sql`
3. `npm run dev`

驗證：
1) 到 `/orgs/:orgId/items/:itemId`  
2) 選 `actor_user_id`（admin/librarian）  
3) 按「標記修復（repair）」→ item.status 應變 repair  
4) 到 `/orgs/:orgId/audit-events`，用 `action=item.mark_repair` 查到事件  
5) 依序測 lost/withdrawn（注意 withdrawn 會有確認視窗）

---

## 8) 本輪新增/修改的主要檔案

API：
- `apps/api/src/items/items.schemas.ts`
- `apps/api/src/items/items.controller.ts`
- `apps/api/src/items/items.service.ts`

Web：
- `apps/web/app/lib/api.ts`
- `apps/web/app/orgs/[orgId]/items/[itemId]/page.tsx`
- `apps/web/app/orgs/[orgId]/audit-events/page.tsx`
