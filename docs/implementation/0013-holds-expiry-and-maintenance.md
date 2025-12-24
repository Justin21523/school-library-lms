# 實作說明 0013：Holds 到書未取到期處理（ready_until → expired）＋ Maintenance 後台頁

本文件說明我在第 13 輪新增的「館員每日例行作業」能力：**把超過取書期限的 ready holds 標記為 expired**，並視情況把冊「釋放回 available」或「轉派給下一位 queued」；同時 **寫入 audit_events（action=`hold.expire`）**，讓你可以在 `/audit-events` 追溯「誰在什麼時間處理了哪些到期」。

> 這個功能其實是 `docs/implementation/0006-holds-and-opac.md` 內 holds 狀態機的補完：我們之前已經把 `expired` 狀態保留在 DB enum 中，但尚未提供「到書未取」的每日批次處理。學校現場若沒有這一步，冊會長期卡在 `on_hold`，導致可借率下降、館員也難以回收被保留的冊。

---

## 1) 這一輪完成了什麼（對照需求）

對照 `USER-STORIES.md`（MVP 相關）：
- **US-043 預約（Hold）**：`ready_until` 的存在代表「可取書期限」，到期後必須能進入 `expired`（本輪補上處理端點與後台頁）
- **US-060 稽核事件（Audit Events）**：每次到期處理都要可追溯（本輪新增 action=`hold.expire`）

對照 `API-DRAFT.md`：
- 新增：`POST /api/v1/orgs/:orgId/holds/expire-ready`（`mode=preview|apply`）

對照 Web Console：
- 新增：`/orgs/:orgId/holds/maintenance`（Holds Maintenance）
- 並在 `/orgs/:orgId/holds` 加上入口連結（提醒到期處理位置）

---

## 2) 問題定義：為什麼需要「到期處理」

Holds 的核心流程（回顧）：
- `queued`：排隊中（尚未指派冊）
- `ready`：可取書（已指派冊，該冊通常會被標為 `on_hold`）
- `fulfilled`：已完成取書借出（已建立 loan）
- `cancelled`：已取消
- `expired`：到書未取逾期（本輪正式落地）

「到書未取」如果不處理會造成兩個現場痛點：
1) **冊被卡在 `on_hold`**：一般 checkout 不應借走 `on_hold` 的冊，但如果 hold 沒有人來取，又不釋放，就等於把冊鎖死。  
2) **隊列無法前進**：同書目仍有 queued 的人時，過期的 ready hold 不應永遠霸佔那一冊；應該把冊轉派給下一位 queued（維持公平排隊）。

因此本輪把它做成「館員動作端點 + 後台頁」：
- MVP 沒有排程器/背景 worker，先用手動觸發達成「可用」
- 後續若要自動化，只要用 cron 呼叫同一個 API（或把核心 SQL 抽到 job）即可

---

## 3) API 設計：為什麼要 `preview|apply`

端點：`POST /api/v1/orgs/:orgId/holds/expire-ready`

設計重點：
- **必須帶 `actor_user_id`**（且必須是 `admin/librarian`、active）：因為這是批次維運動作，必須可追溯
- **`mode=preview`**：先列出「將被處理的清單」與 `candidates_total`（不寫 DB）
- **`mode=apply`**：實際更新（寫 DB + 寫 audit）

為什麼不能只有 apply？
- 學校現場常見「停課/校內活動/連假」導致取書延後；館員需要先確認清單再決定是否處理
- 這能大幅降低誤操作風險（尤其是第一次導入或政策調整時）

`apps/api/src/holds/holds.schemas.ts`
```ts
export const holdMaintenanceModeSchema = z.enum(['preview', 'apply']);

export const expireReadyHoldsSchema = z.object({
  actor_user_id: uuidSchema,
  mode: holdMaintenanceModeSchema,
  as_of: z.string().trim().min(1).max(64).optional(),
  limit: intFromStringSchema.optional(),
  note: z.string().trim().min(1).max(200).optional(),
});
```

幾個細節取捨：
- `as_of` 選填：留空時由後端使用 DB `now()`（避免 API server 與 DB 時鐘差）
- `limit` 預設 200：避免一次鎖太久；讓館員可以分批處理
- `note` 選填：會寫入 audit metadata（方便你事後理解「為什麼那天大量 expired」）

---

## 4) 併發與鎖（Locking）：為什麼用 `FOR UPDATE SKIP LOCKED`

到期處理會跟兩種「同樣會動到 hold/item」的動作競爭：
- 館員在 `/holds` 上做 fulfill（ready → fulfilled；item: on_hold → checked_out）
- 館員/讀者做 cancel（queued/ready → cancelled；必要時釋放/轉派 item）

如果到期處理「硬等鎖」：
- 可能卡住現場借還（等待正在 fulfill 的那筆 hold）
- 多館員同時按 apply 時，可能互相等待甚至造成死鎖風險

因此 apply 端用「跳過已被鎖住的列」：

`apps/api/src/holds/holds.service.ts`
```ts
SELECT id, user_id, bibliographic_id, assigned_item_id, ready_until
FROM holds
WHERE organization_id = $1
  AND status = 'ready'
  AND ready_until IS NOT NULL
  AND ready_until < $2::timestamptz
ORDER BY ready_until ASC
LIMIT $3
FOR UPDATE SKIP LOCKED
```

這代表：
- 若某筆 ready hold 正在被 fulfill/cancel 鎖住，這次 expire-ready 會先跳過它
- 館員可以稍後再按一次 apply（或下次例行作業再處理）
- 讓「批次維運」不會拖垮「即時櫃台操作」

同時我們也保持 **鎖順序一致（hold → item）**：
- 先鎖住要過期的 hold（上面的 query）
- 需要動到 item 時，再鎖 item（沿用 cancel/fulfill 的順序）
- 避免不同路徑鎖順序相反造成死鎖

---

## 5) apply 的業務規則：過期、轉派、釋放、跳過

apply 的核心流程（逐筆）：
1) 把 hold `ready → expired`（保留 `assigned_item_id` 作為歷史）
2) 若沒有 `assigned_item_id`：只記錄 skipped（資料不一致，但仍要讓 hold 脫離 ready）
3) 若有 item：
   - 只有在 **item.status 是 `on_hold|available` 且 bibliographic_id 匹配** 時才允許動 item
   - 若同書目仍有 queued：把 item 指派給下一位 queued hold（queued → ready，重新計算 ready_until）
   - 若沒有 queued：釋放 item → `available`
   - 若 item 是 `checked_out/lost/withdrawn/repair`：只 expire hold、不動 item（避免維運端點做出「意外更改實體狀態」）
4) 每筆處理都寫一筆 `audit_events`（action=`hold.expire`；entity_type=`hold`；entity_id=`hold.id`）

`apps/api/src/holds/holds.service.ts`
```ts
await client.query(
  `
  UPDATE holds
  SET status = 'expired'
  WHERE organization_id = $1
    AND id = $2
  `,
  [orgId, hold.id],
);
```

轉派下一位 queued 時，必須重新計算 ready_until；但 `holds` 表沒有 `hold_pickup_days`，它在政策表 `circulation_policies`：

`apps/api/src/holds/holds.service.ts`
```ts
LEFT JOIN LATERAL (
  SELECT cp.hold_pickup_days
  FROM circulation_policies cp
  WHERE cp.organization_id = h.organization_id
    AND cp.audience_role = u.role
  ORDER BY cp.created_at DESC
  LIMIT 1
) p ON true
```

為什麼用 LATERAL？
- `circulation_policies` 允許同一個 audience_role 有多筆（例如政策調整時新增一筆）
- 若直接 JOIN，會把同一筆 hold 乘上多筆 policy，讓「隊首」結果不穩定
- 用 `ORDER BY created_at DESC LIMIT 1` 明確取「最新政策」

最後寫入 audit（每筆 hold 一個事件，便於用 entity_id 查完整軌跡）：

`apps/api/src/holds/holds.service.ts`
```ts
INSERT INTO audit_events (
  organization_id, actor_user_id, action, entity_type, entity_id, metadata
)
VALUES ($1, $2, $3, $4, $5, $6::jsonb)
RETURNING id
```

metadata 會包含：
- `as_of`（本次判定基準時間）、`note`
- `ready_until`
- `assigned_item_barcode`
- `item_status_before/after`
- `transferred_to_hold_id`（若有轉派）

---

## 6) Web Console：Maintenance 頁怎麼用（以及為什麼要 confirm）

新增頁面：`/orgs/:orgId/holds/maintenance`

操作流程：
1) 選 `actor_user_id`（admin/librarian）
2) （可選）設定 `as_of`、`limit`、`note`
3) 先按「預覽（Preview）」確認清單
4) 再按「套用（Apply）」執行到期處理
5) 到 `/audit-events` 用 action=`hold.expire` 查追溯

UI 的「套用前 confirm」是刻意的：
- 這是批次寫入 DB 的操作，避免誤觸（尤其是 mobile/觸控環境）
- 若前一步已 preview，我們把 preview 的筆數帶進 confirm，讓館員有心理預期

`apps/web/app/orgs/[orgId]/holds/maintenance/page.tsx`
```tsx
const ok = window.confirm(
  `確認要執行到期處理嗎？\n\n` +
    (count !== null ? `已過期（preview）：${count} 筆\n` : '') +
    `limit：${input.limit ?? '200'}\n` +
    `as_of：${input.as_of ?? 'DB now()'}\n\n` +
    `此動作會：\n` +
    `- 把過期 ready hold → expired\n` +
    `- 釋放冊回 available 或轉派給下一位 queued\n` +
    `- 寫入 audit_events（hold.expire）`,
);
```

---

## 7) 如何手動驗證（建議路徑）

前置：
1. `docker compose up -d postgres redis`
2. 匯入 `db/schema.sql`
3. `npm run dev`

建議驗證流程（最短路徑）：
1) 建立 org / locations / users（至少要有 librarian + student/teacher）
2) 建立 circulation policies（設定 `hold_pickup_days`）
3) 建立 bib + item
4) 建立 hold，並讓它進入 ready（例如：先把 item 設為 available，建立 hold 後會自動 ready）
5) 想快速測到期：把該 hold 的 `ready_until` 改成過去時間（用 SQL update 測試）
6) 到 `/orgs/:orgId/holds/maintenance`：
   - Preview 應列出該筆 hold
   - Apply 後該 hold 應變成 `expired`
7) 檢查 item：
   - 若同書目沒有 queued：item 應回到 `available`
   - 若同書目仍有人 queued：下一位 queued 應變成 ready，item 仍為 `on_hold`
8) 到 `/orgs/:orgId/audit-events`，用 action=`hold.expire` 查到對應事件

---

## 8) 本輪新增/修改的主要檔案

API：
- `apps/api/src/holds/holds.schemas.ts`：新增 `expireReadyHoldsSchema`（preview/apply、as_of/limit/note）
- `apps/api/src/holds/holds.controller.ts`：新增 `POST /holds/expire-ready`
- `apps/api/src/holds/holds.service.ts`：新增 `expireReady()`（批次到期處理、轉派/釋放、寫 audit）

Web：
- `apps/web/app/lib/api.ts`：新增 `previewExpireReadyHolds()` / `applyExpireReadyHolds()` 與回傳型別
- `apps/web/app/orgs/[orgId]/holds/maintenance/page.tsx`：新增 Maintenance UI
- `apps/web/app/orgs/[orgId]/holds/page.tsx`：加入口連結與操作提示

Docs：
- `API-DRAFT.md`：補上 `POST /holds/expire-ready`
- `README.md`、`docs/README.md`：補上本文件連結

