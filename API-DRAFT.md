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

### 驗證/授權（MVP 目前實作）
- Staff（館員後台 / Web Console）：
  - 以 `Authorization: Bearer <access_token>` 驗證（token 由 `POST /orgs/{orgId}/auth/login` 取得）
  - token 是 org scoped：token 內的 `org` 必須等於路徑 `orgId`（多租戶隔離）
  - 仍保留 `actor_user_id`（寫 audit/一致性），但後端會要求它必須等於登入者（避免冒用）
- Patron（OPAC）：
  - MVP 仍保留部分「不需登入」的端點（例如書目/館別查詢、部分 holds 操作）
  - 注意：這是 MVP 的最小可用假設；正式上線建議導入讀者身分驗證或另設 OPAC 權杖

> 環境變數：`AUTH_TOKEN_SECRET`（token 簽章 secret）、`AUTH_BOOTSTRAP_SECRET`（第一次設定密碼用；未設定即禁用）

## 1) Organizations
- `POST /orgs`：建立 organization（Admin）
- `GET /orgs/{orgId}`：取得 organization（Admin/Librarian）

## 2) Locations
- `GET /orgs/{orgId}/locations`：列出位置
- `POST /orgs/{orgId}/locations`：新增位置（Librarian）
- `PATCH /orgs/{orgId}/locations/{locationId}`：更新/停用位置（Librarian）

## 3) Users（Patrons/Staff）
- `GET /orgs/{orgId}/users?query=...&role=...&status=...&limit=...`：搜尋使用者（Librarian）
  - `query`：模糊搜尋（external_id/name/org_unit）
  - `role/status`：精準篩選
- `POST /orgs/{orgId}/users`：新增使用者（Librarian）
- `PATCH /orgs/{orgId}/users/{userId}`：更新/停用（US-011；Librarian）
  - MVP 權限：需帶 `actor_user_id`（admin/librarian），後端驗證 role/status，並寫入 `audit_events`（action=`user.update`）
  - Request（JSON；至少帶一個要更新的欄位）：
    ```json
    {
      "actor_user_id": "u_admin_or_librarian",
      "name": "王小明",
      "org_unit": "501",
      "role": "student",
      "status": "active",
      "note": "optional"
    }
    ```
- `POST /orgs/{orgId}/users/import`：CSV 匯入（US-010；Librarian）
  - 目的：批次新增/更新名冊（以 `external_id` 為唯一鍵），並可批次停用畢業/離校使用者
  - MVP 權限：需帶 `actor_user_id`（admin/librarian），後端驗證 role/status（避免名冊裸奔）
  - Request（JSON）：
    ```json
    {
      "actor_user_id": "u_admin_or_librarian",
      "mode": "preview|apply",
      "csv_text": "external_id,name,role,org_unit,status\\n...",
      "default_role": "student|teacher",
      "deactivate_missing": true,
      "deactivate_missing_roles": ["student", "teacher"],
      "source_filename": "roster.csv",
      "source_note": "113-1 學期名冊"
    }
    ```
  - Response（preview）：回傳 `summary + errors + rows`（不寫 DB）
  - Response（apply）：回傳 `summary + audit_event_id`，並寫入 `audit_events`（action=`user.import_csv`）

## 4) Bibliographic Records（書目）
- `GET /orgs/{orgId}/bibs?query=...&isbn=...&classification=...`：查詢書目（含可借/總冊數；query 會比對 title/creators/subjects 等）
- `POST /orgs/{orgId}/bibs`：新增書目（Librarian）
- `GET /orgs/{orgId}/bibs/{bibId}`：取得書目（含可借冊數）
- `PATCH /orgs/{orgId}/bibs/{bibId}`：更新書目（Librarian）

## 5) Item Copies（冊）
- `GET /orgs/{orgId}/items?barcode=...&status=...&location_id=...&bibliographic_id=...`：查詢冊（Librarian）
- `POST /orgs/{orgId}/bibs/{bibId}/items`：在書目下新增冊（Librarian）
- `GET /orgs/{orgId}/items/{itemId}`：取得冊（含當前借閱/預約狀態）
- `PATCH /orgs/{orgId}/items/{itemId}`：更新冊（位置/索書號/備註等）（Librarian）
  - 說明：冊的 `status` 屬於重要業務狀態，MVP 建議改走「動作端點」並寫入 `audit_events`，避免無追溯的狀態異動
- 冊異常狀態（US-045，寫入 audit）：
  - `POST /orgs/{orgId}/items/{itemId}/mark-lost`
  - `POST /orgs/{orgId}/items/{itemId}/mark-repair`
  - `POST /orgs/{orgId}/items/{itemId}/mark-withdrawn`
  - Request（共通）：
    ```json
    { "actor_user_id": "u_admin_or_librarian", "note": "optional" }
    ```

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

- `POST /orgs/{orgId}/loans/purge-history`：借閱歷史保存期限清理（US-061；Admin）
  - 目的：依保存天數（retention_days）刪除「已歸還且過久」的借閱紀錄（降低個資長期保存風險與 DB 量）
  - 權限（MVP 最小控管）：
    - `actor_user_id` 必填，且必須是 `admin`（active）
  - 設計：`mode=preview|apply`（先預覽再套用，降低誤刪風險）
  - Request（JSON）：
    ```json
    {
      "actor_user_id": "u_admin",
      "mode": "preview|apply",
      "retention_days": 365,
      "as_of": "2025-12-24T00:00:00Z",
      "limit": 500,
      "include_audit_events": false,
      "note": "optional"
    }
    ```
  - Response（preview）：回傳候選 loans 清單（含 borrower/item/title）與 `candidates_total/cutoff`
  - Response（apply）：回傳刪除摘要（deleted_loans/deleted_audit_events）與 `audit_event_id`（action=`loan.purge_history`）

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

Holds 同時服務兩條流程：
- **Web Console（館員）**：
  - 重要 staff 動作端點（例如 fulfill、expire-ready maintenance）需要 Bearer token（StaffAuthGuard）
  - 仍會帶 `actor_user_id`（寫 audit/一致性），且後端會要求它必須等於登入者
- **OPAC 自助（讀者）**：
  - MVP 仍允許部分操作不需登入（例如 place/cancel），`actor_user_id` 可不帶（後端視為 borrower 本人操作）
  - 注意：正式上線建議導入讀者登入或 OPAC 專用權杖，避免「本人」假設被濫用

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

### 7.5 到書未取到期處理（Expire ready holds / Maintenance）
> ready hold 超過取書期限（`ready_until`）後，必須由館員定期處理；否則冊會長期卡在 `on_hold`，降低可借率。

- `POST /orgs/{orgId}/holds/expire-ready`
- 權限（MVP 最小控管）：
  - `actor_user_id` 必填，且必須是 `admin/librarian`（active）
- Request（JSON）：
  ```json
  {
    "actor_user_id": "u_admin_or_librarian",
    "mode": "preview|apply",
    "as_of": "2025-12-24T00:00:00Z",
    "limit": 200,
    "note": "每日到期處理（選填）"
  }
  ```
- 行為（摘要）：
  - 找出 `status=ready AND ready_until < as_of` 的 holds
  - `mode=preview`：只回傳清單（不寫 DB）
  - `mode=apply`：逐筆把 hold 標記為 `expired`，並視情況「轉派」或「釋放」指派冊：
    - 若同書目仍有人 queued：把同冊指派給「隊首 queued」並轉成 ready（重新計算 `ready_until`）
    - 若無 queued：把冊釋放回 `available`
    - 若 item 狀態不合理（checked_out/lost/withdrawn/repair）或書目不符：只 expire hold、不動 item
  - 寫入 `audit_events`（action=`hold.expire`；每筆 hold 一個事件，便於用 `entity_id=holdId` 追溯）
- Response（preview）：
  ```json
  {
    "mode": "preview",
    "as_of": "2025-12-24T00:00:00Z",
    "limit": 200,
    "candidates_total": 12,
    "holds": []
  }
  ```
- Response（apply）：
  ```json
  {
    "mode": "apply",
    "as_of": "2025-12-24T00:00:00Z",
    "limit": 200,
    "summary": {
      "candidates_total": 12,
      "processed": 12,
      "transferred": 7,
      "released": 5,
      "skipped_item_action": 0
    },
    "results": []
  }
  ```

## 8) Policies
- `GET /orgs/{orgId}/circulation-policies`：列出政策
- `POST /orgs/{orgId}/circulation-policies`：建立政策（Librarian）
- `PATCH /orgs/{orgId}/circulation-policies/{policyId}`：更新政策（Librarian）

## 9) Reports（CSV/JSON）
> 報表通常包含較敏感資訊（例如逾期名單），因此本專案把 reports 視為 staff-only：
> - 需要 `Authorization: Bearer <token>`（StaffAuthGuard）
> - 仍要求 `actor_user_id`（查詢者；admin/librarian），且必須等於登入者（避免冒用）

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
- `GET /orgs/{orgId}/reports/top-circulation?actor_user_id=...&from=...&to=...&limit=...&format=json|csv`：熱門書（US-050；Librarian）
  - 目的：以期間內 `loans`（借出交易）統計「借出次數最高的書」（書目層級）
  - Query params：
    - `from/to`：必填，ISO 8601（timestamptz）
    - `limit`：選填，預設 50
    - `format`：選填 `json|csv`，預設 `json`
  - JSON Response（摘要）：
    ```json
    [
      {
        "bibliographic_id": "b_...",
        "bibliographic_title": "哈利波特：神秘的魔法石",
        "loan_count": 42,
        "unique_borrowers": 31
      }
    ]
    ```

- `GET /orgs/{orgId}/reports/circulation-summary?actor_user_id=...&from=...&to=...&group_by=day|week|month&format=json|csv`：借閱量彙總（US-050；Librarian）
  - 目的：以期間內 `loans.checked_out_at` 彙總借閱量（借出筆數）
  - Query params：
    - `from/to`：必填
    - `group_by`：必填 `day|week|month`
    - `format`：選填 `json|csv`，預設 `json`
  - JSON Response（摘要）：
    ```json
    [
      { "bucket_start": "2025-12-01T00:00:00.000Z", "loan_count": 5 },
      { "bucket_start": "2025-12-02T00:00:00.000Z", "loan_count": 0 }
    ]
    ```

### 9.3 Ready Holds（取書架清單 / 可取書清單）
> 這份清單用於「櫃台每日取書架作業」：列出 `status=ready` 的 holds，並可依取書地點（pickup_location）分開匯出/列印。

- `GET /orgs/{orgId}/reports/ready-holds?actor_user_id=...&as_of=...&pickup_location_id=...&limit=...&format=json|csv`
- 權限（MVP 最小控管）：
  - `actor_user_id` 必填，且必須是 `admin/librarian`（active）
- Query params：
  - `as_of`：可選（timestamptz；未提供時以「現在」為基準）
  - `pickup_location_id`：可選（UUID；未提供代表不過濾）
  - `limit`：可選（1..5000），預設 200
  - `format`：可選 `json|csv`，預設 `json`
- JSON Response（摘要）：
  ```json
  [
    {
      "hold_id": "h_...",
      "ready_until": "2025-12-26T23:59:59Z",
      "is_expired": false,
      "days_until_expire": 2,
      "user_external_id": "S1130123",
      "user_name": "王小明",
      "user_org_unit": "601",
      "bibliographic_title": "哈利波特：神秘的魔法石",
      "assigned_item_barcode": "LIB-00001234",
      "pickup_location_code": "MAIN",
      "pickup_location_name": "圖書館"
    }
  ]
  ```
- CSV Response：
  - `format=csv` 時回傳 `text/csv`（含 UTF-8 BOM），並以 `Content-Disposition: attachment` 觸發下載

### 9.4 Zero Circulation（US-051 零借閱清單 / 汰舊參考）
> 這份清單用於館藏調整：找出「在指定期間內沒有任何借出」的書目，作為汰舊/補書決策的參考。

- `GET /orgs/{orgId}/reports/zero-circulation?actor_user_id=...&from=...&to=...&limit=...&format=json|csv`
- 權限（MVP 最小控管）：
  - `actor_user_id` 必填，且必須是 `admin/librarian`（active）
- Query params：
  - `from/to`：必填（timestamptz）
  - `limit`：可選（1..5000），預設 200
  - `format`：可選 `json|csv`，預設 `json`
- JSON Response（摘要）：
  ```json
  [
    {
      "bibliographic_id": "b_...",
      "bibliographic_title": "哈利波特：神秘的魔法石",
      "classification": "823.914",
      "isbn": "9789573317248",
      "total_items": 3,
      "available_items": 3,
      "last_checked_out_at": "2023-05-10T08:00:00Z",
      "loan_count_in_range": 0
    }
  ]
  ```
- CSV Response：
  - `format=csv` 時回傳 `text/csv`（含 UTF-8 BOM），並以 `Content-Disposition: attachment` 觸發下載

## 10) Audit Events
> audit_events 用於「追溯誰在什麼時間做了什麼」，通常包含敏感資訊，因此本專案把它視為 staff-only：
> - 需要 `Authorization: Bearer <token>`（StaffAuthGuard）
> - 仍要求 `actor_user_id`（查詢者；admin/librarian），且必須等於登入者（避免冒用）

### 10.1 查詢稽核事件（List audit events）
- `GET /orgs/{orgId}/audit-events?actor_user_id=...&from=...&to=...&actor_query=...&action=...&entity_type=...&entity_id=...&limit=...`
- 權限（MVP 最小控管）：
  - 需 Bearer token（StaffAuthGuard）
  - `actor_user_id` 必填，且必須是 `admin/librarian`（active）
- Query params：
  - `from/to`：可選，ISO 8601（timestamptz），用於篩選 `audit_events.created_at`
  - `actor_query`：可選，用事件操作者的 `users.external_id` 或 `users.name` 模糊查詢（ILIKE）
  - `action`：可選，事件類型（例如 `loan.checkout`）
  - `entity_type/entity_id`：可選，影響資料類型與 ID
  - `limit`：可選（1..5000），預設 200
- Response：回傳 audit_event + actor 可顯示欄位（snake_case）

## 11) Auth（Staff）
> 提供 Web Console（館員後台）的最小可用登入機制（MVP 版本）。

### 11.1 Staff Login
- `POST /orgs/{orgId}/auth/login`
- Request：
  ```json
  { "external_id": "A0001", "password": "your-password" }
  ```
- Response（摘要）：
  ```json
  {
    "access_token": "base64url(payload).base64url(signature)",
    "expires_at": "2025-12-25T12:00:00Z",
    "user": { "id": "u_...", "external_id": "A0001", "name": "Admin", "role": "admin", "status": "active" }
  }
  ```
- 說明：
  - 目前只允許 staff role（`admin/librarian`）登入
  - 若密碼尚未設定，會回 409（`PASSWORD_NOT_SET`）

### 11.2 Set Staff Password（需要登入）
- `POST /orgs/{orgId}/auth/set-password`
- Header：
  - `Authorization: Bearer <access_token>`
- Request：
  ```json
  {
    "actor_user_id": "u_admin_or_librarian",
    "target_user_id": "u_target_staff",
    "new_password": "new-password",
    "note": "optional"
  }
  ```
- 說明：
  - 後端會寫入 `audit_events`（action=`auth.set_password`）
  - StaffAuthGuard 會要求 `actor_user_id` 必須等於登入者（避免冒用）

### 11.3 Bootstrap Set Password（第一次設定密碼）
> 用於第一次導入：當 `user_credentials` 全空時，還沒有人能登入。

- `POST /orgs/{orgId}/auth/bootstrap-set-password`
- Request：
  ```json
  {
    "bootstrap_secret": "AUTH_BOOTSTRAP_SECRET",
    "target_external_id": "A0001",
    "new_password": "new-password",
    "note": "optional"
  }
  ```
- 說明：
  - 需要設定環境變數 `AUTH_BOOTSTRAP_SECRET`；未設定時此端點會被禁用
  - 後端會寫入 `audit_events`（action=`auth.bootstrap_set_password`）
