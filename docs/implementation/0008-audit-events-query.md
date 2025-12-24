# 實作說明 0008：稽核事件查詢（Audit Events）

本文件說明我在第八輪實作完成的功能：
- **稽核事件查詢（Audit Events list）**：讓館員/管理者能依時間區間、操作者、事件類型等條件查詢 `audit_events`，用於追溯與除錯。

> 延續你的學習需求：本輪新增/修改的 TypeScript 檔案同樣維持高密度註解；本文件會用程式片段逐段解釋「為什麼需要 audit 查詢」、「MVP 權限策略」與「SQL 查詢設計」。

---

## 1) 這一輪完成了什麼（對照需求）

對照 `USER-STORIES.md`：
- US-060 稽核事件（Audit Events）
  - 驗收：借出、歸還、改狀態、匯入都會產生 audit event（已在前面模組逐步寫入）
  - 驗收：可依時間/操作者/事件類型查詢（本輪完成）

對照 `API-DRAFT.md`：
- 新增/落地：`GET /api/v1/orgs/:orgId/audit-events`

對應程式：
- API：
  - `apps/api/src/audit/audit.schemas.ts`
  - `apps/api/src/audit/audit.service.ts`
  - `apps/api/src/audit/audit.controller.ts`
  - `apps/api/src/audit/audit.module.ts`
  - `apps/api/src/app.module.ts`（掛入 AuditModule）
- Web：
  - `apps/web/app/orgs/[orgId]/audit-events/page.tsx`
  - `apps/web/app/lib/api.ts`

---

## 2) 為什麼需要 audit_events 的「查詢端點」

我們前面已經在 circulation/holds 等流程寫入 `audit_events`，但如果沒有查詢端點，這些資料只會「躺在 DB 裡」：
- 現場遇到爭議（誰把書借走/誰取消預約）無法快速查證
- 開發除錯時很難重建事件時間線

因此 audit 模組的第一個能力就是：**把 append-only 的 audit_events 變成可查、可用的資訊視圖**。

---

## 3) MVP 權限策略：為什麼要求 actor_user_id（查詢者）

稽核資料通常包含敏感資訊；但 MVP 目前沒有登入（auth）。

因此本專案採用「最小可用的權限控管」：
- query string 必須帶 `actor_user_id`（查詢者）
- 後端會驗證該 user 必須是 `admin/librarian` 且 `status=active`

`apps/api/src/audit/audit.schemas.ts`
```ts
export const listAuditEventsQuerySchema = z.object({
  actor_user_id: uuidSchema, // 查詢者（viewer / requestor）
  from: z.string().optional(),
  to: z.string().optional(),
  action: shortTextSchema.optional(),
  entity_type: shortTextSchema.optional(),
  entity_id: shortTextSchema.optional(),
  actor_query: shortTextSchema.optional(),
  limit: intFromStringSchema.optional(),
});
```

`apps/api/src/audit/audit.service.ts`
```ts
// 查詢前先驗證查詢者是 staff（admin/librarian）
await this.requireAuditViewer(client, orgId, query.actor_user_id);
```

> 取捨：這仍不是完整安全方案（actor_user_id 仍可能被冒用），但能避免「完全匿名」查到稽核資料。

---

## 4) SQL 設計：為什麼要 join users

`audit_events` 本體只有 `actor_user_id`，但 UI 要顯示「可理解」資訊：
- actor external_id（學號/員編）
- actor name
- actor role

因此 service 直接 join `users`，回傳「audit_event + actor 可顯示欄位」：

`apps/api/src/audit/audit.service.ts`
```ts
SELECT
  ae.id,
  ae.action,
  ae.entity_type,
  ae.entity_id,
  ae.metadata,
  ae.created_at,
  u.external_id AS actor_external_id,
  u.name AS actor_name,
  u.role AS actor_role
FROM audit_events ae
JOIN users u
  ON u.id = ae.actor_user_id
 AND u.organization_id = ae.organization_id
WHERE ae.organization_id = $1
ORDER BY ae.created_at DESC
LIMIT $N
```

這能避免前端為了顯示 actor 的名字而做 N+1 次 API 呼叫。

---

## 5) 篩選條件：時間 / 操作者 / 事件類型 / entity

本輪支援常用篩選：
- `from/to`：以 `audit_events.created_at` 篩選時間區間
- `actor_query`：用 actor 的 external_id/name 做模糊查詢（ILIKE）
- `action`：事件類型（例如 `loan.checkout`）
- `entity_type/entity_id`：定位某一筆資料（loan/hold/item...）的異動軌跡

`apps/api/src/audit/audit.service.ts`
```ts
if (query.from) whereClauses.push(`ae.created_at >= $N::timestamptz`);
if (query.to) whereClauses.push(`ae.created_at <= $N::timestamptz`);
if (query.action) whereClauses.push(`ae.action = $N`);
if (query.actor_query) whereClauses.push(`(u.external_id ILIKE $N OR u.name ILIKE $N)`);
```

---

## 6) Web Console：如何查詢與顯示 metadata

新增頁面：
- `/orgs/:orgId/audit-events`

UI 重點：
1) 選 `actor_user_id`（查詢者，admin/librarian）  
2) 設定 `from/to`（datetime-local，本地時間顯示）  
3) 選填 `actor_query`、`action`、`entity_type/entity_id`  
4) 顯示結果清單，並用 `<details>` 折疊 `metadata`（避免畫面被 JSON 撐爆）

對應程式：
- `apps/web/app/orgs/[orgId]/audit-events/page.tsx`
- `apps/web/app/lib/api.ts`：`listAuditEvents()`

---

## 7) 如何手動驗證（建議路徑）

前置：
1. `docker compose up -d postgres redis`
2. 匯入 `db/schema.sql`
3. `npm run dev`

驗證：
1) 用 Web Console 做一些操作（checkout/checkin/renew/holds cancel/fulfill）  
2) 到 `/orgs/:orgId/audit-events`  
3) 設定時間區間（例如最近 1 天）  
4) 用 action 提示（loan.checkout/hold.cancel）過濾，應看到對應事件  

---

## 8) 本輪新增/修改的主要檔案

API：
- `apps/api/src/audit/audit.schemas.ts`
- `apps/api/src/audit/audit.service.ts`
- `apps/api/src/audit/audit.controller.ts`
- `apps/api/src/audit/audit.module.ts`
- `apps/api/src/app.module.ts`

Web：
- `apps/web/app/orgs/[orgId]/audit-events/page.tsx`
- `apps/web/app/lib/api.ts`
