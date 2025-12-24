# 實作說明 0021：US-022 書目/冊批次匯入（CSV：preview/apply + audit）

本文件說明我在第 21 輪把 `USER-STORIES.md` 的 **US-022 書目/冊批次匯入（CSV）** 落地成：
- API：`POST /api/v1/orgs/:orgId/bibs/import`（`mode=preview|apply`）
- Web Console：`/orgs/:orgId/bibs/import`（上傳/貼上 CSV、預覽、套用、錯誤列出、下載範本）
- audit：套用成功寫入 `audit_events`（action=`catalog.import_csv`，entity_id=csv_sha256）

> 這一題沿用 US-010 的匯入管線：同樣採 preview/apply 兩階段，降低「批次寫入」的誤操作成本。

---

## 1) US-022 的核心價值（為什麼效益高）

導入新學校時，最大痛點是「初始化建檔成本」：
- 既有書目可能已在 Excel/舊系統
- 冊條碼與索書號通常早已貼好

因此 US-022 的 MVP 目標是：
- 用 CSV 一次把 **冊（barcode/call_number/location/status）** 與必要的 **書目資訊（title/isbn...）** 匯進來
- 並且能在匯入前先預覽（preview），確認不會把既有資料弄亂

---

## 2) API 設計：preview / apply（降低風險）

端點：
- `POST /api/v1/orgs/:orgId/bibs/import`（StaffAuthGuard）

Request body（摘要）：
```json
{
  "actor_user_id": "u_admin_or_librarian",
  "mode": "preview|apply",
  "csv_text": "barcode,call_number,title,...\\n...",
  "default_location_id": "optional",
  "update_existing_items": true,
  "allow_relink_bibliographic": false,
  "source_filename": "optional",
  "source_note": "optional"
}
```

設計取捨（關鍵）：
- `update_existing_items`（預設 true）：
  - 允許同 barcode 更新 call_number/location/status/notes（常見：匯入後再校正）
- `allow_relink_bibliographic`（預設 false）：
  - 是否允許「同 barcode 指到不同書目」  
  - 這很危險（可能把冊整批接錯書目），因此預設關閉

Schema（節錄）：
`apps/api/src/bibs/bibs.schemas.ts`
```ts
export const importCatalogCsvSchema = z.object({
  actor_user_id: uuidSchema,
  mode: z.enum(['preview', 'apply']),
  csv_text: z.string().min(1).max(5_000_000),
  default_location_id: uuidSchema.optional(),
  update_existing_items: z.boolean().optional(),
  allow_relink_bibliographic: z.boolean().optional(),
  source_filename: z.string().trim().min(1).max(200).optional(),
  source_note: z.string().trim().min(1).max(200).optional(),
});
```

---

## 3) CSV 欄位策略：header mapping（中英別名）

學校現場 CSV 很常出現：
- 欄位名稱不一致（barcode/bar_code/條碼）
- ISBN 有破折號
- subjects/creators 用分隔符

因此後端做「header mapping」：
- 容許中英別名
- 不敏感大小寫/空白/底線/破折號
- 映射到 canonical 欄位後再做驗證與寫入

這讓匯入更「現場友善」，也能避免前端硬寫死欄位名稱。

---

## 4) 匯入規則（MVP 版的防呆）

### 4.1 item（冊）側
- 必填：`barcode`、`call_number`
- location：可用 `location_id`、`location_code`，或用 `default_location_id` 補
- status：禁止匯入 `checked_out` / `on_hold`（這些狀態屬於流通/預約流程，不應由批次匯入直接寫）

### 4.2 bib（書目）側
可用多種方式對應/建立書目（依資料可得性）：
- 有 `bibliographic_id`：優先用既有 bib
- 沒有 bib id：可用 `isbn` 或 `title` 建立新 bib（MVP 先追求可用）

> 後續若要更嚴謹，可要求匯入必須提供 bibliographic_id 或 ISBN（避免 title 重複）。

---

## 5) apply 時的寫入策略（避免 N+1 + 可追溯）

`apps/api/src/bibs/bibs.service.ts`（摘要）
- 先批次查出「CSV 內所有 barcode」是否已存在（避免逐列查 DB 造成 N+1）
- apply：
  1) 先集中建立「需要新建的 bibs」
  2) 再對 items 做 upsert：
     - `ON CONFLICT (organization_id, barcode) DO UPDATE ...`
     - 若 `allow_relink_bibliographic=false`，則不更新 bibliographic_id

Audit（只寫一筆，避免爆量）：
```ts
INSERT INTO audit_events (...)
VALUES (..., 'catalog.import_csv', 'catalog_import', sha256, metadata)
```

entity_id 使用 `csv_sha256` 的原因：
- 不需要把原始 CSV 存在 audit（可能很大、也可能含敏感資訊）
- 但仍能追溯「這次匯入的內容是哪一份」（同內容 hash 相同）

---

## 6) Web Console：匯入頁（/orgs/:orgId/bibs/import）

`apps/web/app/orgs/[orgId]/bibs/import/page.tsx` 提供：
- CSV 上傳或貼上
- 預覽（preview）：顯示 summary/errors/rows/bibs_to_create_preview
- 套用（apply）：成功回傳 audit_event_id
- 下載範本（降低第一次導入摩擦）

Auth：
- 此頁屬於 staff 後台，需要先登入（`/orgs/:orgId/login`）

---

## 7) 如何手動驗證（建議路徑）

1) 準備：
   - 至少一個 location（active）
   - staff 帳號登入（admin/librarian）
2) 到 `/orgs/:orgId/bibs/import`：
   - 貼上或上傳 CSV → 按「預覽」
   - 確認 summary 與 errors（若有錯誤先修正）
3) 按「套用」
4) 到 `/orgs/:orgId/audit-events`：
   - 用 action=`catalog.import_csv` 查驗 audit metadata（含 csv_sha256/summary/options）
5) 到 `/orgs/:orgId/bibs` 與 `/orgs/:orgId/items`：
   - 確認書目/冊已建立或更新

---

## 8) 本輪新增/修改的主要檔案

API：
- `apps/api/src/bibs/bibs.controller.ts`
- `apps/api/src/bibs/bibs.schemas.ts`
- `apps/api/src/bibs/bibs.service.ts`

Web：
- `apps/web/app/orgs/[orgId]/bibs/import/page.tsx`
- `apps/web/app/orgs/[orgId]/bibs/page.tsx`
- `apps/web/app/lib/api.ts`

Docs：
- `docs/implementation/0021-us-022-catalog-csv-import.md`

