# 0010 — US-010 使用者 CSV 匯入（preview/apply + 批次停用 + audit）

本篇說明我們如何把 `USER-STORIES.md` 的 **US-010 匯入使用者名冊（CSV）** 落地成：
- NestJS API：`POST /api/v1/orgs/:orgId/users/import`（`mode=preview|apply`）
- Web Console：`/orgs/:orgId/users/import`（檔案上傳、預覽、套用）
- 稽核（audit）：套用成功後寫入 `audit_events`（action=`user.import_csv`）

> 重點導向：學校現場每學期最常做的事，就是把「在籍學生/教師名冊」匯入，並停用畢業/轉出的使用者。

---

## 1) 對照 user story（驗收條件）

`USER-STORIES.md` → **US-010 匯入使用者名冊（CSV）** 的三個驗收：
1. **新增與更新**（以 `external_id` 作為唯一鍵）
2. **匯入前預覽 + 錯誤列出**（列號/欄位/原因）
3. **批次停用離校/畢業使用者**

本輪實作對應如下：
- 新增/更新：用 PostgreSQL `UNIQUE (organization_id, external_id)` + `ON CONFLICT DO UPDATE`
- 預覽：`mode=preview` 回傳 `summary + errors + rows`
- 批次停用：`deactivate_missing=true` 時，對指定角色（student/teacher）把「不在 CSV」且目前 `active` 的使用者設為 `inactive`

---

## 2) API 設計：為什麼要拆 preview / apply？

名冊匯入是「高風險批次寫入」：
- 資料量大（幾百～幾千列）
- 含大量個資（姓名/學號）
- 一旦寫錯，後續借還/預約/報表都會受影響

因此 API 採 **兩階段模式**：
- `mode=preview`：不寫 DB，只回傳「會發生什麼」與錯誤，讓館員先確認
- `mode=apply`：只有在 **無錯誤** 時才允許套用；並把結果寫入 `audit_events` 方便追溯

---

## 3) API 契約（Request / Response）

### 3.1 Endpoint
- `POST /api/v1/orgs/:orgId/users/import`

### 3.2 Request body（JSON）
```json
{
  "actor_user_id": "UUID（admin/librarian）",
  "mode": "preview | apply",
  "csv_text": "CSV 文字內容（UTF-8）",
  "default_role": "student | teacher（選填）",
  "deactivate_missing": true,
  "deactivate_missing_roles": ["student", "teacher"],
  "source_filename": "xxx.csv（選填）",
  "source_note": "113-1 學期名冊（選填）"
}
```

重要規則（MVP）：
- `actor_user_id` 必填：專案尚未做 auth，因此用它做「最小 RBAC」避免名冊裸奔
- `external_id` 與 `name` 必須出現在 CSV header（可英文/中文別名）
- 若 CSV 沒有 `role` 欄位，必須提供 `default_role`
- `org_unit` 只有在 CSV 有該欄位時才會更新（避免沒給欄位就把既有值清空）
- `status` 只有在 **CSV 有 status 欄** 或 `deactivate_missing=true`（roster sync）時才會更新

### 3.3 Response（preview）
回傳重點：
- `summary`：新增/更新/不變/將停用的數量
- `errors`：列號/欄位/原因（可以直接拿去修 CSV）
- `rows`：前 N 筆列的匯入計畫（create/update/unchanged/invalid）
```json
{
  "mode": "preview",
  "summary": { "to_create": 10, "to_update": 3, "unchanged": 200, "to_deactivate": 15 },
  "errors": [{ "row_number": 8, "field": "role", "code": "INVALID_ROLE", "message": "..." }],
  "rows": [
    { "row_number": 2, "external_id": "S1130123", "name": "王小明", "role": "student", "action": "update", "changes": ["org_unit"] }
  ]
}
```

### 3.4 Response（apply）
回傳重點：
- `summary`：實際寫入結果（inserted/updated/unchanged/deactivated）
- `audit_event_id`：可直接去 `/audit-events` 追溯
```json
{
  "mode": "apply",
  "summary": { "to_create": 10, "to_update": 3, "unchanged": 200, "to_deactivate": 15 },
  "audit_event_id": "UUID"
}
```

---

## 4) CSV 規格（學校現場友善）

### 4.1 支援的 header（英文/中文別名）
後端會把 header 做 mapping（大小寫/空白/底線/破折號不敏感），常見支援：

| canonical 欄位 | 英文常見 | 中文常見 |
| --- | --- | --- |
| `external_id` | `external_id`, `externalId` | `學號`, `員編`, `教職員編號` |
| `name` | `name` | `姓名` |
| `role` | `role` | `角色`, `身分`, `身份` |
| `org_unit` | `org_unit`, `orgUnit` | `班級`, `年班`, `單位` |
| `status` | `status` | `狀態` |

### 4.2 role 值（名冊只接受 student/teacher）
支援值：
- `student` / `學生`
- `teacher` / `教師`

> staff（admin/librarian）不走名冊匯入，避免誤設權限；請用 `/users` 手動建立。

### 4.3 status 值（可選）
支援值：
- `active` / `啟用` / `在學`
- `inactive` / `停用` / `離校` / `畢業`

空白視為 `active`（方便 Excel 欄位留空）。

---

## 5) 後端實作導讀（NestJS）

### 5.1 Schema（Zod）— 驗證匯入 request
檔案：`apps/api/src/users/users.schemas.ts`
- `importUsersCsvSchema`：驗證 `actor_user_id/mode/csv_text/...`
- `csv_text` 限制 5MB：避免誤傳巨大檔

### 5.2 Controller — 新增路由
檔案：`apps/api/src/users/users.controller.ts`
```ts
@Post('import')
async importCsv(
  @Param('orgId', new ParseUUIDPipe()) orgId: string,
  @Body(new ZodValidationPipe(importUsersCsvSchema)) body: any,
) {
  return await this.users.importCsv(orgId, body);
}
```
關鍵點：
- 仍沿用既有模式：Controller 只負責「路由 + validation」，商業規則放 Service。

### 5.3 Service — preview/apply 的核心流程
檔案：`apps/api/src/users/users.service.ts`

流程分成 11 個步驟（程式內有逐段落註解），核心概念：
1. `requireImportActor()`：驗證 `actor_user_id` 必須是 active 的 admin/librarian
2. `parseCsv()`：純語法層 CSV 解析（無外部套件），在 `apps/api/src/common/csv.ts`
3. `resolveUserImportColumns()`：把 header 映射到 canonical 欄位
4. 逐列 normalize + 驗證（長度、role/status、欄位數一致性、external_id 重複）
5. 用 `external_id = ANY($2)` 批次查 DB（避免 N+1）
6. 建立每列的 plan：create/update/unchanged/invalid（並列出 `changes`）
7. 若 `deactivate_missing=true`：計算將停用名單 + 防呆（要停用的 role 必須出現在 CSV）
8. `mode=preview`：回傳 summary/errors/rows（不寫入）
9. `mode=apply`：若仍有 errors → 400 擋掉
10. `ON CONFLICT DO UPDATE ... WHERE ... IS DISTINCT FROM ...`：避免不必要的 update
11. 寫入 `audit_events`：action=`user.import_csv`，metadata 存策略與結果（含 `csv_sha256`）

---

## 6) 前端實作導讀（Next.js Web Console）

### 6.1 新增頁面：Users CSV Import
檔案：`apps/web/app/orgs/[orgId]/users/import/page.tsx`
重點 UI：
- 先用 `listUsers()` 抓 actor 候選人（active admin/librarian）
- 支援「上傳檔案」或「貼上 CSV」
- 兩顆按鈕：**預覽** / **套用**
- 預覽結果顯示：
  - summary（新增/更新/不變/將停用）
  - errors（列號/欄位/原因）
  - rows（前 N 筆）
  - deactivate_missing 時顯示「將停用」的前 N 筆使用者

### 6.2 API Client 擴充
檔案：`apps/web/app/lib/api.ts`
- 新增 `previewUsersCsvImport()` / `applyUsersCsvImport()`
- 新增型別 `UsersCsvImportPreviewResult` / `UsersCsvImportApplyResult`

---

## 7) 如何手動驗證（不靠自動測試）

1) 啟動 DB + 匯入 schema：
- `docker compose up -d postgres`
- `db/schema.sql` 匯入（見 `README.md`）

2) 啟動 API / Web：
- `npm run dev:api`
- `npm run dev:web`

3) Web Console 操作：
- 建立 org、建立至少一個 admin/librarian user（作為 actor）
- 到：`/orgs/:orgId/users/import`
- 上傳 CSV → 按「預覽」確認 summary/errors → 再按「套用」
- 到：`/orgs/:orgId/audit-events`，用 action=`user.import_csv` 查驗 audit

---

## 8) 後續可擴充（但 MVP 先不做）
- 支援背景任務（大檔匯入不阻塞 request）
- 更完整的 CSV 欄位（email、學年、座號…）或外部系統同步（SIS/LDAP）
- 角色/權限更細（導入 auth 後，actor 不再由 body 傳入）
- 匯入「缺席即停用」以外的策略（例如：缺席即刪除、或保留到期日）

