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

### Loans（借閱查詢）
- `GET /orgs/{orgId}/loans?status=open|closed|all&user_external_id=...&item_barcode=...&limit=...`
  - 說明：
    - `status` 未提供時預設 `open`（未歸還）
    - `is_overdue` 由 `returned_at IS NULL AND due_at < now()` 推導（不存狀態）
  - Response（摘要）：回傳 loan + borrower + item + bib title（便於 UI 顯示）
    ```json
    [
      {
        "id": "l_...",
        "item_barcode": "LIB-00001234",
        "bibliographic_title": "哈利波特：神秘的魔法石",
        "user_external_id": "S1130123",
        "due_at": "2025-12-15T23:59:59Z",
        "renewed_count": 0,
        "is_overdue": false
      }
    ]
    ```

- `POST /orgs/{orgId}/circulation/checkout`：借出（Librarian）
  - Request：
    ```json
    {
      "user_external_id": "S1130123",
      "item_barcode": "LIB-00001234",
      "actor_user_id": "u_admin..."
    }
    ```
  - Response（摘要）：
    ```json
    { "loan_id": "l_...", "item_id": "i_...", "user_id": "u_...", "due_at": "2025-12-15T23:59:59Z" }
    ```

- `POST /orgs/{orgId}/circulation/checkin`：歸還（Librarian）
  - Request：
    ```json
    { "item_barcode": "LIB-00001234", "actor_user_id": "u_admin..." }
    ```
  - Response：回傳冊的新狀態（`available` 或 `on_hold`）與保留資訊
    ```json
    {
      "loan_id": "l_...",
      "item_id": "i_...",
      "item_status": "available",
      "hold_id": null,
      "ready_until": null
    }
    ```

- `POST /orgs/{orgId}/circulation/renew`：續借（Librarian/Teacher/Student）
  - Request：
    ```json
    { "loan_id": "l_...", "actor_user_id": "u_admin..." }
    ```
  - Response（摘要）：
    ```json
    { "loan_id": "l_...", "due_at": "2026-01-15T23:59:59Z", "renewed_count": 1 }
    ```
  - 驗證：續借次數（max_renewals）、是否有人排隊（queued holds）

## 7) Holds（預約/保留）
> Holds 的核心概念是「以書目（bibliographic_id）排隊」，並在某一冊可供取書時，指派該冊並進入 ready。

目前 MVP 尚未做登入（auth），因此本專案採用「actor_user_id（可選）」的方式做最小稽核：
- **Web Console（館員）**：會傳 `actor_user_id`（admin/librarian）
- **OPAC 自助**：不傳 `actor_user_id`（後端視為 borrower 本人操作）

### 7.1 建立預約（Place hold）
- `POST /orgs/{orgId}/holds`
- Request：
  ```json
  {
    "bibliographic_id": "b_...",
    "user_external_id": "S1130123",
    "pickup_location_id": "loc_...",
    "actor_user_id": "u_admin_or_librarian_optional"
  }
  ```
- 行為（摘要）：
  - 建立 hold（預設 `status=queued`）
  - 若同書目存在可借冊（`item_copies.status=available`），系統會把該冊指派給「隊首 queued hold」並轉成 `ready`
  - 被指派的冊會變成 `on_hold`（避免被一般 checkout 借走）
- Response：回傳「hold + borrower + bib title + pickup location + assigned item」的組合資料（snake_case）

### 7.2 查詢預約（List holds）
- `GET /orgs/{orgId}/holds?status=...&user_external_id=...&item_barcode=...&bibliographic_id=...&pickup_location_id=...&limit=...`
- 說明：
  - `status` 可為 `queued|ready|cancelled|fulfilled|expired|all`；未提供時等同 `all`
  - `user_external_id`/`item_barcode`/`bibliographic_id`/`pickup_location_id` 為精確過濾
- Response：`HoldWithDetails[]`

### 7.3 取消預約（Cancel）
- `POST /orgs/{orgId}/holds/{holdId}/cancel`
- Request：
  ```json
  { "actor_user_id": "u_admin_or_librarian_optional" }
  ```
- 行為（摘要）：
  - 只允許取消 `queued/ready`
  - 若取消的是 `ready` 且已指派冊，會把冊「轉給下一位 queued」或「釋放回 available」
- Response：回傳更新後的 `HoldWithDetails`

### 7.4 完成取書借出（Fulfill）
- `POST /orgs/{orgId}/holds/{holdId}/fulfill`
- Request：
  ```json
  { "actor_user_id": "u_admin_or_librarian" }
  ```
- 行為（摘要）：
  - 只允許 `ready` 的 hold
  - 會建立 loan、把 item 從 `on_hold → checked_out`、把 hold 從 `ready → fulfilled`，並寫入 `audit_events`
- Response（摘要）：
  ```json
  {
    "hold_id": "h_...",
    "loan_id": "l_...",
    "item_id": "i_...",
    "item_barcode": "LIB-00001234",
    "user_id": "u_...",
    "due_at": "2025-12-15T23:59:59Z"
  }
  ```

## 8) Policies
- `GET /orgs/{orgId}/circulation-policies`：列出政策
- `POST /orgs/{orgId}/circulation-policies`：建立政策（Librarian）
- `PATCH /orgs/{orgId}/circulation-policies/{policyId}`：更新政策（Librarian）

## 9) Reports（CSV/JSON）
> 報表通常包含較敏感資訊（例如逾期名單），因此即使 MVP 尚未做登入，也建議在報表端點要求 `actor_user_id`。

### 9.1 Overdue List（逾期清單）
- `GET /orgs/{orgId}/reports/overdue?actor_user_id=...&as_of=...&org_unit=...&limit=...&format=json|csv`
- 權限（MVP 最小控管）：
  - `actor_user_id` 必填，且必須是 `admin/librarian`（active）
- Query params：
  - `as_of`：可選，ISO 8601（timestamptz）；未提供時以「現在」為基準
  - `org_unit`：可選，班級/單位（對應 `users.org_unit`，MVP 先做精確比對）
  - `limit`：可選（1..5000），預設 500
  - `format`：可選 `json|csv`，預設 `json`
- JSON Response：回傳逾期 loans 的可顯示欄位（loan + borrower + item + bib + location）
  ```json
  [
    {
      "loan_id": "l_...",
      "due_at": "2025-12-15T23:59:59Z",
      "days_overdue": 9,
      "user_external_id": "S1130123",
      "user_name": "王小明",
      "user_org_unit": "601",
      "item_barcode": "LIB-00001234",
      "bibliographic_title": "哈利波特：神秘的魔法石"
    }
  ]
  ```
- CSV Response：
  - `format=csv` 時回傳 `text/csv`，並以 `Content-Disposition: attachment` 觸發下載

### 9.2（預留）Top Circulation / Summary
- `GET /orgs/{orgId}/reports/top-circulation?from=...&to=...&limit=...`：熱門書（Librarian）
- `GET /orgs/{orgId}/reports/circulation-summary?from=...&to=...&group_by=day|week|month`：借閱量彙總（Librarian）

## 10) Audit Events
- `GET /orgs/{orgId}/audit-events?from=...&to=...&actor_user_id=...&action=...`：查詢稽核事件（Admin）
