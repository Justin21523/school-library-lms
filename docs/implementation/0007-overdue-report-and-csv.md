# 實作說明 0007：逾期清單（Overdue List）＋ CSV 匯出

本文件說明我在第七輪實作完成的功能：
1) **逾期清單（Overdue List）**：館員可依「基準時間 as_of」與「班級/單位 org_unit」查詢逾期借閱。  
2) **CSV 匯出**：同一份報表可下載為 CSV（方便通知、對帳、留存）。

> 延續你的學習需求：本輪新增/修改的 TypeScript 程式檔同樣維持高密度註解；本文件會用程式片段逐段說明「推導式狀態」、「查詢設計」與「CSV 輸出細節」。

---

## 1) 這一輪完成了什麼（對照需求）

對照 `USER-STORIES.md`：
- US-044 逾期清單（Overdue List）
  - 驗收：可依日期/班級篩選
  - 驗收：可匯出 CSV

對照 `API-DRAFT.md`：
- 新增：`GET /api/v1/orgs/:orgId/reports/overdue`（支援 JSON + CSV）

對應程式：
- API：
  - `apps/api/src/reports/reports.controller.ts`
  - `apps/api/src/reports/reports.service.ts`
  - `apps/api/src/reports/reports.schemas.ts`
  - `apps/api/src/reports/reports.module.ts`
- Web：
  - `apps/web/app/orgs/[orgId]/reports/overdue/page.tsx`
  - `apps/web/app/lib/api.ts`

---

## 2) 逾期的定義：為什麼不用「逾期狀態欄位」

逾期（overdue）在資料庫層最穩定的做法是 **推導**：
- `returned_at IS NULL`（尚未歸還）
- `due_at < as_of`（到期日早於基準時間）

為什麼不用 `loans.status = 'overdue'`？
- 逾期會隨時間變化；若存狀態，就必須靠排程（cron/job）更新，容易漏跑或資料腐敗。
- 推導只要 DB 有 `due_at` 與 `returned_at`，永遠可以得到正確答案。

---

## 3) API：為什麼 reports 需要 actor_user_id（MVP 的最小控管）

報表（尤其逾期名單）包含個資與敏感資訊；但 MVP 尚未導入登入（auth）。

因此我在 reports 端點採用「最小可用控管」：
- `actor_user_id` 必填
- 只允許 `admin/librarian` 且 `status=active`

`apps/api/src/reports/reports.schemas.ts`
```ts
export const overdueReportQuerySchema = z.object({
  actor_user_id: uuidSchema,
  as_of: z.string().trim().min(1).max(64).optional(),
  org_unit: nonEmptyStringSchema.optional(),
  limit: intFromStringSchema.optional(),
  format: reportFormatSchema.optional(),
});
```

> 取捨：這不是完整權限系統（仍可能被冒用），但能避免「完全不帶身份」就能下載逾期名單。

---

## 4) SQL：為什麼要 join 出「可顯示資訊」

逾期報表如果只回 `loan_id/item_id/user_id`，前端就必須再打 N 次 API 才能顯示：
- 讀者姓名/班級（users）
- 書名（bibliographic_records）
- 條碼/索書號/館藏位置（item_copies + locations）

因此 reports 的 SQL 直接 join 成可顯示 row：

`apps/api/src/reports/reports.service.ts`
```ts
SELECT
  l.id AS loan_id,
  l.checked_out_at,
  l.due_at,
  FLOOR(EXTRACT(EPOCH FROM ($2::timestamptz - l.due_at)) / 86400)::int AS days_overdue,
  u.external_id AS user_external_id,
  u.name AS user_name,
  u.org_unit AS user_org_unit,
  i.barcode AS item_barcode,
  i.call_number AS item_call_number,
  loc.code AS item_location_code,
  b.title AS bibliographic_title
FROM loans l
JOIN users u ...
JOIN item_copies i ...
JOIN locations loc ...
JOIN bibliographic_records b ...
WHERE l.returned_at IS NULL
  AND l.due_at < $2::timestamptz
ORDER BY l.due_at ASC
LIMIT $N
```

重點：
- `days_overdue` 也是推導欄位：`as_of - due_at`（整天數）
- `ORDER BY due_at ASC` 讓最早逾期者排前面（現場追繳最需要）

---

## 5) CSV：為什麼要加 UTF-8 BOM、以及如何 escape

學校現場常用 Excel 開 CSV；在中文 Windows 環境中，沒有 BOM 時容易出現亂碼。

因此我在 CSV 最前面加上 UTF-8 BOM：
- `\ufeff`

`apps/api/src/reports/reports.service.ts`
```ts
return `\ufeff${[headerLine, ...dataLines].join('\r\n')}\r\n`;
```

另外 CSV 的欄位值需要 escape：
- 若包含 `"`、`,`、`\n`、`\r`，就必須用雙引號包起來
- 內部的 `"` 要變成 `""`

`apps/api/src/reports/reports.service.ts`
```ts
function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  const mustQuote = text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r');
  if (!mustQuote) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
```

---

## 6) Web Console：如何查詢與下載 CSV

新增頁面：
- `/orgs/:orgId/reports/overdue`

UI 行為：
1) 選 `actor_user_id`（館員/管理者）  
2) 選 `as_of`（datetime-local，本地時間顯示）  
3) 選填 `org_unit`（班級/單位）  
4) 查詢（JSON 顯示）或下載 CSV

對應程式：
- `apps/web/app/orgs/[orgId]/reports/overdue/page.tsx`
- `apps/web/app/lib/api.ts`：
  - `listOverdueReport()`（JSON）
  - `downloadOverdueReportCsv()`（CSV）

下載策略：
- 前端用 fetch 把 CSV 文字抓回來 → Blob → 觸發瀏覽器下載

---

## 7) 如何手動驗證（建議路徑）

前置：
1. `docker compose up -d postgres redis`
2. 匯入 `db/schema.sql`
3. `npm run dev`

驗證步驟：
1) 建立 org / users / policies / bib / item  
2) 借出（checkout）讓 loan 產生  
3) 手動把該 loan 的 `due_at` 改成過去（或等時間）  
4) 到 `/orgs/:orgId/reports/overdue`：
   - 查詢應看到該筆逾期
   - 下載 CSV，用 Excel 開啟不應亂碼

---

## 8) 本輪新增/修改的主要檔案

API：
- `apps/api/src/reports/reports.schemas.ts`
- `apps/api/src/reports/reports.service.ts`
- `apps/api/src/reports/reports.controller.ts`
- `apps/api/src/reports/reports.module.ts`
- `apps/api/src/app.module.ts`（掛入 ReportsModule）

Web：
- `apps/web/app/orgs/[orgId]/reports/overdue/page.tsx`
- `apps/web/app/lib/api.ts`（新增 requestText + report API client）
