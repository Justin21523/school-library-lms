# API 草案（REST / v1）

本文件提供 MVP 可開發的 API 端點清單與資料契約雛形；目標是讓前端、後端、資料庫能同步拆工。資料欄位定義以 `DATA-DICTIONARY.md` 為準。

## 0) 共通規則
- Base path：`/api/v1`
- 多租戶：以路徑帶入 `organization_id`：`/orgs/{orgId}/...`
- Content-Type：`application/json; charset=utf-8`
- 分頁：`?limit=50&cursor=...`（回傳 `next_cursor`）
- 時間：ISO 8601（UTC），例如 `2025-12-15T23:59:59Z`

### 錯誤格式（建議）
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "title is required", "details": { "field": "title" } } }
```

### 驗證/授權（MVP 建議）
- 公開（Guest）：OPAC 查詢（可選）
- 需登入：館員/管理者操作（匯入、借還、改狀態、匯出、稽核）

## 1) Organizations
- `POST /orgs`：建立 organization（Admin）
- `GET /orgs/{orgId}`：取得 organization（Admin/Librarian）

## 2) Locations
- `GET /orgs/{orgId}/locations`：列出位置
- `POST /orgs/{orgId}/locations`：新增位置（Librarian）
- `PATCH /orgs/{orgId}/locations/{locationId}`：更新/停用位置（Librarian）

## 3) Users（Patrons/Staff）
- `GET /orgs/{orgId}/users?query=...&role=...&status=...`：搜尋使用者（Librarian）
- `POST /orgs/{orgId}/users`：新增使用者（Librarian）
- `PATCH /orgs/{orgId}/users/{userId}`：更新/停用（Librarian）
- `POST /orgs/{orgId}/users/import`：CSV 匯入（Librarian）
  - 回傳：匯入預覽/錯誤清單（可先同步回傳；後續可改背景任務）

## 4) Bibliographic Records（書目）
- `GET /orgs/{orgId}/bibs?query=...&isbn=...&classification=...`：查詢書目（含可借/總冊數；query 會比對 title/creators/subjects 等）
- `POST /orgs/{orgId}/bibs`：新增書目（Librarian）
- `GET /orgs/{orgId}/bibs/{bibId}`：取得書目（含可借冊數）
- `PATCH /orgs/{orgId}/bibs/{bibId}`：更新書目（Librarian）

## 5) Item Copies（冊）
- `GET /orgs/{orgId}/items?barcode=...&status=...&location_id=...&bibliographic_id=...`：查詢冊（Librarian）
- `POST /orgs/{orgId}/bibs/{bibId}/items`：在書目下新增冊（Librarian）
- `GET /orgs/{orgId}/items/{itemId}`：取得冊（含當前借閱/預約狀態）
- `PATCH /orgs/{orgId}/items/{itemId}`：更新冊（位置/索書號/狀態/備註）（Librarian）

## 6) Circulation（借還/續借）
> 借還建議用「動作端點」，避免前端直接改資料狀態造成不一致。

- `POST /orgs/{orgId}/circulation/checkout`：借出（Librarian）
  - Request：
    ```json
    { "user_external_id": "S1130123", "item_barcode": "LIB-00001234" }
    ```
  - Response（摘要）：
    ```json
    { "loan_id": "l_...", "item_id": "i_...", "user_id": "u_...", "due_at": "2025-12-15T23:59:59Z" }
    ```

- `POST /orgs/{orgId}/circulation/checkin`：歸還（Librarian）
  - Request：
    ```json
    { "item_barcode": "LIB-00001234" }
    ```
  - Response：回傳冊的新狀態（`available` 或 `on_hold`）與是否觸發保留

- `POST /orgs/{orgId}/circulation/renew`：續借（Librarian/Teacher/Student）
  - Request：`{ "loan_id": "l_..." }`
  - 驗證：續借次數、是否有人預約

## 7) Holds（預約/保留）
- `POST /orgs/{orgId}/holds`：建立預約（Teacher/Student）
  - Request：`{ "bibliographic_id": "b_...", "user_id": "u_...", "pickup_location_id": "loc_main" }`
- `GET /orgs/{orgId}/holds?user_id=...&status=...`：查詢預約（Librarian / 自己的預約）
- `POST /orgs/{orgId}/holds/{holdId}/cancel`：取消預約（本人或 Librarian）
- `POST /orgs/{orgId}/holds/{holdId}/fulfill`：完成取書/借出（Librarian）

## 8) Policies
- `GET /orgs/{orgId}/circulation-policies`：列出政策
- `POST /orgs/{orgId}/circulation-policies`：建立政策（Librarian）
- `PATCH /orgs/{orgId}/circulation-policies/{policyId}`：更新政策（Librarian）

## 9) Reports（CSV/JSON）
- `GET /orgs/{orgId}/reports/overdue?as_of=...`：逾期清單（Librarian）
- `GET /orgs/{orgId}/reports/top-circulation?from=...&to=...&limit=...`：熱門書（Librarian）
- `GET /orgs/{orgId}/reports/circulation-summary?from=...&to=...&group_by=day|week|month`：借閱量彙總（Librarian）

## 10) Audit Events
- `GET /orgs/{orgId}/audit-events?from=...&to=...&actor_user_id=...&action=...`：查詢稽核事件（Admin）
