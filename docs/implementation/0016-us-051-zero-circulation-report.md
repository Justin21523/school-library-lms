# 實作說明 0016：US-051 零借閱清單（Zero Circulation）＋ CSV

本文件說明我在第 16 輪新增的報表功能：**零借閱清單（Zero Circulation）**。它會在你指定的期間內，找出「沒有任何借出」的書目，並提供：
- Web Console 查詢頁：`/orgs/:orgId/reports/zero-circulation`
- API（JSON/CSV）：`GET /api/v1/orgs/:orgId/reports/zero-circulation`

> 這一題的落地策略與既有 `/reports/*` 完全一致：同端點支援 `format=json|csv`（CSV 含 UTF-8 BOM，Excel 友善），並沿用 `actor_user_id` 做 MVP 最小 RBAC。

---

## 1) 需求與使用情境（US-051）

US-051 的核心需求是「館藏調整」：
- 汰舊（weeding）：找出長期無人借閱的書
- 補書/閱讀推廣：看哪些書根本沒被借，可能需要重新陳列或汰換

本輪 MVP 版本的定義是：
- **期間內零借閱**：在 `from..to` 期間內，該書目底下所有冊沒有任何借出（loans）

---

## 2) MVP 限制：排除類型（參考書/典藏）為什麼先不做

USER_STORIES.md 提到「排除類型（參考書/典藏）」；但目前資料模型（`db/schema.sql`）尚未有：
- `material_type`
- `collection_type`
- 或可用來標記「參考書/典藏」的 tag/flag 欄位

因此本輪先把「最有價值且低風險」的核心做出來：期間內零借閱。  
後續若要補「排除類型」，建議的擴充方向：
- 在 `bibliographic_records` 或 `item_copies` 增加 `collection_type` enum（例如 `circulating/reference/archive`）
- 或增加 `tags text[]`，用 tag 來排除

---

## 3) API 設計（Reports 模式：JSON/CSV）

端點：
- `GET /api/v1/orgs/:orgId/reports/zero-circulation?actor_user_id=...&from=...&to=...&limit=...&format=json|csv`

query params：
- `actor_user_id`：必填（admin/librarian；active）
- `from/to`：必填（timestamptz）
- `limit`：選填（預設 200；上限 5000）
- `format`：選填 `json|csv`（預設 `json`）

對應 schema：
`apps/api/src/reports/reports.schemas.ts`
```ts
export const zeroCirculationReportQuerySchema = z.object({
  actor_user_id: uuidSchema,
  from: z.string().trim().min(1).max(64),
  to: z.string().trim().min(1).max(64),
  limit: intFromStringSchema.optional(),
  format: reportFormatSchema.optional(),
});
```

---

## 4) SQL 設計：為什麼以「書目」為統計單位

我們以書目（bibliographic_records）為統計單位，原因是：
- 汰舊/館藏調整的決策多半是「這本書要不要留」，不是「某一本複本」
- 同書目多冊時，只要其中一冊有人借，就代表「這本書有人借」，不應列入零借閱

因此 SQL 需要三件事：
1) 每本書有幾冊（total_items / available_items）
2) 期間內借出次數（loan_count_in_range）
3) 這本書最後一次借出時間（last_checked_out_at，全期間）

`apps/api/src/reports/reports.service.ts`
```sql
WITH item_counts AS (...),
range_loans AS (...),
last_loans AS (...)
SELECT ...
WHERE COALESCE(rl.loan_count_in_range, 0) = 0
ORDER BY ll.last_checked_out_at ASC NULLS FIRST
LIMIT $4
```

排序策略（很重要）：
- `NULLS FIRST`：從未借過的書排最前面（通常最需要優先處理）
- 再依 `title` 排序，方便在清單中查找

---

## 5) CSV 匯出：欄位順序與 BOM

CSV 欄位順序（建議）：
- title / classification / isbn / total_items / last_checked_out_at
- loan_count_in_range（理論上為 0；保留做驗證）
- bibliographic_id（方便對帳/跳轉）

CSV 會加上 UTF-8 BOM（`\ufeff`）：
- Excel 在中文環境更容易正確顯示 UTF-8

---

## 6) Web Console：查詢與下載

新增頁面：
- `/orgs/:orgId/reports/zero-circulation`

提供：
- actor_user_id（館員）
- from/to（本地時間輸入 → 轉 ISO 傳後端）
- limit
- 查詢 / 下載 CSV

---

## 7) 如何驗證（建議路徑）

1) 準備兩本書：
   - A：在期間內至少借出一次
   - B：在期間內完全沒有借出
2) 設定 from/to 覆蓋該期間
3) 打開 `/reports/zero-circulation`
4) 查詢結果應只出現 B
5) 下載 CSV：確認能正常開啟且中文不亂碼

---

## 8) 本輪新增/修改的主要檔案

API：
- `apps/api/src/reports/reports.schemas.ts`
- `apps/api/src/reports/reports.controller.ts`
- `apps/api/src/reports/reports.service.ts`

Web：
- `apps/web/app/lib/api.ts`
- `apps/web/app/orgs/[orgId]/layout.tsx`
- `apps/web/app/orgs/[orgId]/reports/zero-circulation/page.tsx`

Docs：
- `API-DRAFT.md`
- `docs/implementation/0016-us-051-zero-circulation-report.md`

