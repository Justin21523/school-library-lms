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
  - 已支援讀者登入：token 由 `POST /orgs/{orgId}/auth/patron-login` 取得（僅 student/teacher）
  - `/orgs/{orgId}/me/*` 端點需 `Authorization: Bearer <access_token>`（PatronAuthGuard），並由 token 推導 user_id（只回本人資料）
  - 仍保留部分「不需登入」的端點（例如書目/館別查詢、部分 holds 操作）作為過渡；正式上線建議全面收斂到 auth/SSO

> 環境變數：`AUTH_TOKEN_SECRET`（token 簽章 secret）、`AUTH_BOOTSTRAP_SECRET`（第一次設定密碼用；未設定即禁用）

## 1) Organizations
- `POST /orgs`：建立 organization（Admin）
- `GET /orgs/{orgId}`：取得 organization（Admin/Librarian）

## 2) Locations
- `GET /orgs/{orgId}/locations`：列出位置
- `POST /orgs/{orgId}/locations`：新增位置（Librarian）
- `PATCH /orgs/{orgId}/locations/{locationId}`：更新/停用位置（Librarian）

## 3) Users（Patrons/Staff）
- `GET /orgs/{orgId}/users?query=...&role=...&status=...&limit=...&cursor=...`：搜尋使用者（Librarian）
  - `query`：模糊搜尋（external_id/name/org_unit）
  - `role/status`：精準篩選
  - Response：`{ items: User[]; next_cursor: string|null }`
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

## 3.5) Authority / Vocabulary（權威控制檔）
- `GET /orgs/{orgId}/authority-terms?kind=name|subject|geographic|genre|language|relator&query=...&vocabulary_code=...&status=active|inactive|all&limit=...&cursor=...`：列出/搜尋權威款目（Staff）
  - Response：`{ items: AuthorityTerm[]; next_cursor: string|null }`
- `GET /orgs/{orgId}/authority-terms/suggest?kind=name|subject|geographic|genre|language|relator&q=...&vocabulary_code=...&limit=...`：autocomplete 建議（Staff）
  - Response：`AuthorityTerm[]`（不包 cursor；通常只取前 10~20 筆）
- `POST /orgs/{orgId}/authority-terms`：建立權威款目（Staff）
- `PATCH /orgs/{orgId}/authority-terms/{termId}`：更新/停用權威款目（Staff）
- `GET /orgs/{orgId}/authority-terms/{termId}`：款目詳情 + BT/NT/RT（Staff；thesaurus v1）
  - Response：`{ term: AuthorityTerm; relations: { broader/narrower/related } }`
- `POST /orgs/{orgId}/authority-terms/{termId}/relations`：新增 BT/NT/RT（Staff；thesaurus v1）
  - Request：`{ kind: "broader"|"narrower"|"related"; target_term_id: string(uuid) }`
  - Response：同 `GET /authority-terms/{termId}`（回最新的關係視圖，便於 UI 直接 refresh）
- `DELETE /orgs/{orgId}/authority-terms/{termId}/relations/{relationId}`：刪除 BT/NT/RT（Staff；thesaurus v1）
  - Response：同 `GET /authority-terms/{termId}`
- `GET /orgs/{orgId}/authority-terms/{termId}/expand?include=self,variants,broader,narrower,related&depth=1`：展開（檢索擴充用；Staff；thesaurus v1）
  - 說明：
    - `include` 預設全開；`depth` 預設 1，並會在服務層 clamp 到 `0..5`
    - v1 的 `related` 只展開一階（避免 graph 擴散爆炸）
  - Response：`{ term; include; depth; labels; term_ids; broader_terms; narrower_terms; related_terms; variant_labels }`

## 4) Bibliographic Records（書目）
- `GET /orgs/{orgId}/bibs?query=...&search_fields=...&must=...&should=...&must_not=...&published_year_from=...&published_year_to=...&language=...&available_only=...&subjects_any=...&subject_term_ids=...&geographics_any=...&geographic_term_ids=...&genres_any=...&genre_term_ids=...&isbn=...&classification=...&limit=...&cursor=...`：查詢書目（含可借/總冊數）
  - `query`：關鍵字（ILIKE；可搭配 `search_fields` 限制欄位集合）
  - `search_fields`：欄位集合（逗號分隔），例如：
    - `title`：書名
    - `author`：creators + contributors
    - `subject`：subjects（650）
    - `geographic`：geographics（651）
    - `genre`：genres（655）
    - `publisher` / `isbn` / `classification` / `language`
  - `must` / `should` / `must_not`：布林檢索（AND/OR/NOT；逗號或換行分隔 term）
    - `must`：每個 term 都必須命中任一 `search_fields` 欄位（AND）
    - `should`：至少一個 term 命中任一欄位（OR）
    - `must_not`：任何 term 命中即排除（NOT）
  - `published_year_from` / `published_year_to`：出版年區間（int）
  - `language`：語言代碼 prefix（例如 `zh` 命中 `zh-TW`）
  - `available_only`：只回傳「目前至少有 1 冊可借」的書目（v1 以 `item_copies.status='available'` 判斷）
  - `subjects_any`：主題詞擴充查詢（thesaurus expand 後的 labels；用逗號串起來，例如 `subjects_any=汰舊,報廢,除籍`；DB 用 `subjects && $labels::text[]`）
  - `subject_term_ids`：term_id-driven 主題詞過濾（任一命中；用逗號串起來，例如 `subject_term_ids=uuid1,uuid2,...`；DB 用 junction table `bibliographic_subject_terms`）
    - 相容 alias：`subject_term_ids_any`（行為相同；可逐步淘汰）
  - `geographics_any`：地理名稱（MARC 651）擴充查詢（labels；逗號串起來；DB 用 `geographics && $labels::text[]`）
  - `geographic_term_ids`：term_id-driven 地理名稱過濾（任一命中；逗號串起來；DB 用 junction table `bibliographic_geographic_terms`）
    - 相容 alias：`geographic_term_ids_any`（行為相同；可逐步淘汰）
  - `genres_any`：類型/體裁（MARC 655）擴充查詢（labels；逗號串起來；DB 用 `genres && $labels::text[]`）
  - `genre_term_ids`：term_id-driven 類型/體裁過濾（任一命中；逗號串起來；DB 用 junction table `bibliographic_genre_terms`）
    - 相容 alias：`genre_term_ids_any`（行為相同；可逐步淘汰）
  - Response：`{ items: BibliographicRecordWithCounts[]; next_cursor: string|null }`
- `POST /orgs/{orgId}/bibs`：新增書目（Librarian）
- `POST /orgs/{orgId}/bibs/import`：書目/冊 CSV 匯入（US-022；preview/apply；Librarian）
  - 權限：需 Bearer token（StaffAuthGuard）+ `actor_user_id`（admin/librarian，且必須等於登入者）
  - Request（摘要）：
    ```json
    {
      "actor_user_id": "u_admin_or_librarian",
      "mode": "preview|apply",
      "csv_text": "barcode,call_number,title,...\\n...",
      "default_location_id": "optional",
      "update_existing_items": true,
      "allow_relink_bibliographic": false
    }
    ```
  - audit：apply 成功後寫入 `audit_events`（action=`catalog.import_csv`；entity_id=csv_sha256）
- `POST /orgs/{orgId}/bibs/import-marc`：MARC 批次匯入（preview/apply；Staff；進階編目）
  - 目的：
    - 多筆 record preview/apply
    - 去重：ISBN（bibs.isbn）/ 035（bibliographic_identifiers scheme=`035`）
    - per record 選擇 create/update/skip
    - apply 成功後寫一筆 `audit_events`（action=`catalog.import_marc`）
  - Request（摘要）：
    ```json
    {
      "actor_user_id": "u_admin_or_librarian",
      "mode": "preview|apply",
      "records": [
        {
          "bib": { "title": "...", "creators": ["..."], "subjects": ["..."], "isbn": "..." },
          "marc_extras": [{ "tag": "245", "ind1": "1", "ind2": "4", "subfields": [{ "code": "c", "value": "..." }] }]
        }
      ],
      "options": {
        "save_marc_extras": true,
        "upsert_authority_terms": true,
        "authority_vocabulary_code": "local"
      },
      "decisions": [
        { "index": 0, "decision": "create|update|skip", "target_bib_id": "optional (for update)" }
      ],
      "source_filename": "optional",
      "source_note": "optional"
    }
    ```
  - Response（preview）：回傳 `summary + warnings + errors + records`
  - Response（apply）：回傳 `summary + audit_event_id + results`
- `GET /orgs/{orgId}/bibs/{bibId}`：取得書目（含可借冊數）
- `PATCH /orgs/{orgId}/bibs/{bibId}`：更新書目（Librarian）
- `GET /orgs/{orgId}/bibs/{bibId}/marc?format=json|xml|mrc`：MARC 21 匯出（Staff；進階編目基礎）
  - 目的：由「表單欄位」產生 MARC core fields，並把 `bibliographic_records.marc_extras` merge/append（保留未覆蓋欄位且避免重複）
  - `format=json`：回傳 `MarcRecord`（JSON-friendly 結構）
  - `format=xml`：回傳 MARCXML（MARC21 slim）
  - `format=mrc`：回傳 ISO2709 `.mrc`（傳統交換格式）
  - 規則：`001`/`005` 由系統產生；`marc_extras` 內同 tag 不會覆蓋（避免控制號/時間戳被污染）
- `GET /orgs/{orgId}/bibs/{bibId}/marc-extras`：讀取 `marc_extras`（Staff）
  - Response：`MarcField[]`（已 sanitize；不合法 element 會被丟掉）
- `PUT /orgs/{orgId}/bibs/{bibId}/marc-extras`：更新 `marc_extras`（Staff）
  - Request（JSON）：
    ```json
    {
      "marc_extras": [
        { "tag": "500", "ind1": " ", "ind2": " ", "subfields": [{ "code": "a", "value": "附錄：題解與索引" }] }
      ]
    }
    ```

## 5) Item Copies（冊）
- `GET /orgs/{orgId}/items?query=...&barcode=...&status=...&location_id=...&bibliographic_id=...&limit=...&cursor=...`：查詢冊（Librarian）
  - `query`：模糊搜尋（ILIKE；OR）
    - item：`barcode` / `call_number`
    - bib：`title` / `isbn` / `classification`
    - location：`code` / `name`
  - Response：`{ items: ItemCopy[]; next_cursor: string|null }`
    - list 會額外帶「可讀欄位」以降低 UI 只剩 UUID 的痛點：
      - `bibliographic_title` / `bibliographic_isbn` / `bibliographic_classification`
      - `location_code` / `location_name`
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
- `GET /orgs/{orgId}/loans?query=...&status=open|closed|all&user_external_id=...&item_barcode=...&limit=...&cursor=...`
  - 說明：
    - `query`：模糊搜尋（ILIKE；OR；用於「只記得姓名/書名/條碼一段」的情境）
    - `status` 未提供時預設 `open`（未歸還）
    - `is_overdue` 由 `returned_at IS NULL AND due_at < now()` 推導（不存狀態）
  - Response（摘要）：回傳 loan + borrower + item + bib title（便於 UI 顯示）
    ```json
    {
      "items": [
        {
          "id": "l_...",
          "item_barcode": "LIB-00001234",
          "bibliographic_title": "哈利波特：神秘的魔法石",
          "user_external_id": "S1130123",
          "due_at": "2025-12-15T23:59:59Z",
          "renewed_count": 0,
          "is_overdue": false
        }
      ],
      "next_cursor": null
    }
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
- `GET /orgs/{orgId}/holds?query=...&status=...&user_external_id=...&item_barcode=...&bibliographic_id=...&pickup_location_id=...&limit=...&cursor=...`
- 說明：
  - `query`：模糊搜尋（ILIKE；OR）
    - user：external_id / name
    - bib：title
    - pickup location：code / name
    - assigned item：barcode（若此 hold 已指派冊）
  - `status` 可為 `queued|ready|cancelled|fulfilled|expired|all`；未提供時等同 `all`
  - `user_external_id`/`item_barcode`/`bibliographic_id`/`pickup_location_id` 為精確過濾
- Response：`{ items: HoldWithDetails[]; next_cursor: string|null }`

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
- 權限（staff-only）：
  - 需要 `Authorization: Bearer <token>`（StaffAuthGuard）
  - `actor_user_id` 由 token 推導（後端會覆寫/驗證一致性，避免前端冒用）
- Request（JSON）：
  ```json
  {
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

### 7.6 背景 Job：到書未取到期處理（Expire ready holds / async）
> 目的：避免 maintenance 端點「跑很久導致 HTTP timeout」；改成 enqueue job 後由 worker 執行。

- `POST /orgs/{orgId}/jobs/holds-expire-ready`
- 權限：同 7.5（staff-only；actor 由 token 推導）
- Request（JSON）：
  ```json
  {
    "as_of": "2025-12-24T00:00:00Z",
    "limit": 200,
    "note": "每日到期處理（選填）"
  }
  ```
- Response（202 Accepted；摘要）：
  ```json
  { "id": "job_uuid", "kind": "holds.expire_ready", "status": "queued" }
  ```
- `GET /orgs/{orgId}/jobs/{jobId}`：查 job 狀態（running/succeeded/failed；result/error 會回傳在 job row）

## 8) Policies
- `GET /orgs/{orgId}/circulation-policies`：列出政策
- `POST /orgs/{orgId}/circulation-policies`：建立政策（Librarian）
- `PATCH /orgs/{orgId}/circulation-policies/{policyId}`：更新政策（Librarian）

政策欄位（摘要，詳見 `DATA-DICTIONARY.md`）：
- 借期：`loan_days`
- 上限：`max_loans` / `max_renewals` / `max_holds`
- 取書期限：`hold_pickup_days`
- 逾期停權：`overdue_block_days`（逾期達 X 天後，禁止新增借閱：checkout/renew/hold/fulfill；0 代表不啟用）

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

### 9.5 Inventory Diff（盤點差異清單）
> 這份清單用於盤點後的「異常處理」：missing（在架但未掃）與 unexpected（掃到但系統顯示非在架/位置不符）。

- `GET /orgs/{orgId}/reports/inventory-diff?actor_user_id=...&inventory_session_id=...&limit=...&format=json|csv`
- 權限（MVP 最小控管）：
  - `actor_user_id` 必填，且必須是 `admin/librarian`（active）
- Query params：
  - `inventory_session_id`：必填（UUID）
  - `limit`：可選（1..5000），預設 5000
  - `format`：可選 `json|csv`，預設 `json`
- JSON Response（摘要）：回傳 `{ session, summary, missing, unexpected }`（方便前端分區顯示）
- CSV Response：
  - missing/unexpected 會合併成一張表，並用 `diff_type` 欄位區分（CSV 含 UTF-8 BOM）

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

## 11) Auth（Staff / Patron）
> 提供 Web Console（館員後台）與 OPAC Account（讀者端）的最小可用登入機制（MVP 版本）。

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

### 11.2 Patron Login（OPAC Account）
- `POST /orgs/{orgId}/auth/patron-login`
- Request：
  ```json
  { "external_id": "S1130123", "password": "your-password" }
  ```
- Response：與 Staff Login 相同 shape（`access_token/expires_at/user`）
- 說明：
  - 只允許 `student/teacher` 登入（對齊 circulation policy 的 audience_role）
  - 若密碼尚未設定，會回 409（`PASSWORD_NOT_SET`）

### 11.3 Set Password（需要登入；可用於 staff 與 patron）
- `POST /orgs/{orgId}/auth/set-password`
- Header：
  - `Authorization: Bearer <access_token>`
- Request：
  ```json
  {
    "actor_user_id": "u_admin_or_librarian",
    "target_user_id": "u_target_user",
    "new_password": "new-password",
    "note": "optional"
  }
  ```
- 說明：
  - 後端會寫入 `audit_events`（action=`auth.set_password`）
  - StaffAuthGuard 會要求 `actor_user_id` 必須等於登入者（避免冒用）
  - `target_user_id` 允許：
    - staff：admin/librarian（Web Console 登入）
    - patron：student/teacher（OPAC Account 登入）

### 11.4 Bootstrap Set Password（第一次設定密碼）
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

## 12) Inventory（盤點）
> 盤點屬於 staff 作業，因此本組端點視為 staff-only：
> - 需要 `Authorization: Bearer <token>`（StaffAuthGuard）
> - 仍要求 `actor_user_id`（admin/librarian），且必須等於登入者（避免冒用）

- `POST /orgs/{orgId}/inventory/sessions`：開始盤點（建立 session）
  - Request：
    ```json
    { "actor_user_id": "u_admin_or_librarian", "location_id": "loc_...", "note": "optional" }
    ```
- `GET /orgs/{orgId}/inventory/sessions?location_id=&status=open|closed|all&limit=`：列出盤點 sessions
- `POST /orgs/{orgId}/inventory/sessions/{sessionId}/scan`：掃冊條碼
  - Request：
    ```json
    { "actor_user_id": "u_admin_or_librarian", "item_barcode": "LIB-00001234" }
    ```
  - 行為：寫入 `inventory_scans`，並更新 `item_copies.last_inventory_at`
- `POST /orgs/{orgId}/inventory/sessions/{sessionId}/close`：結束盤點（關閉 session）
  - Request：
    ```json
    { "actor_user_id": "u_admin_or_librarian", "note": "optional" }
    ```
  - audit：寫入 `audit_events`（action=`inventory.session_closed`；metadata 含摘要）

## 13) OPAC Account（Me / 我的借閱與預約）
> `/me/*` 是「登入後」的讀者自助 API：
> - 需要 `Authorization: Bearer <token>`（PatronAuthGuard；token 由 `POST /auth/patron-login` 取得）
> - user_id 由 token 推導，不允許前端用 `user_external_id` 指定他人

- `GET /orgs/{orgId}/me`：取得我的基本資料
- `GET /orgs/{orgId}/me/loans?status=open|closed|all&limit=&cursor=`：我的借閱（cursor pagination；回 `{ items, next_cursor }`）
- `GET /orgs/{orgId}/me/holds?status=queued|ready|cancelled|fulfilled|expired|all&limit=&cursor=`：我的預約（cursor pagination；回 `{ items, next_cursor }`）
- `POST /orgs/{orgId}/me/holds`：替自己建立預約
  - Request：
    ```json
    { "bibliographic_id": "b_...", "pickup_location_id": "loc_..." }
    ```
- `POST /orgs/{orgId}/me/holds/{holdId}/cancel`：取消自己的預約
