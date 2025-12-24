# 實作說明 0003：借出/歸還（checkout/checkin）

本文件說明我在第三輪實作完成的「借出/歸還」流程，重點在於交易一致性（transaction）、政策套用（policy）、以及稽核事件（audit）。這一輪的目的，是讓 circulation 真正能跑起來，並且在資料層面保持可追溯。

> 延續你的學習需求：本輪新增的 TypeScript 程式檔都已加上高密度註解，可直接當教材閱讀。

## 1) 這一輪完成了什麼（對照 MVP/故事）
對照 `USER-STORIES.md`：
- **US-040 借出（Checkout）**：已做（API + transaction + audit）
- **US-041 歸還（Check-in）**：已做（API + transaction + audit）
- **US-060 稽核事件（Audit Events）**：借出/歸還皆會寫入 audit_events
- **US-042 續借**：尚未做
- **US-043 預約**：未實作 API，但歸還時會處理 queued hold（若 DB 內已有資料）

對照 `API-DRAFT.md`（v1）已落地端點：
- `POST /api/v1/orgs/:orgId/circulation/checkout`
- `POST /api/v1/orgs/:orgId/circulation/checkin`

## 2) 為什麼一定要用 transaction？
借出/歸還不是單表操作，至少會同時改：
- `loans`（新增或關閉借閱）
- `item_copies`（更新冊狀態）
- `audit_events`（記錄誰做了什麼）

如果中間任何一步失敗，就必須全部回滾，否則會出現「冊已被標記借出，但 loan 沒有建立」的錯誤狀態。因此本輪所有流程都包在 `DbService.transaction()` 內。

## 3) 為什麼 request 需要 `actor_user_id`？
目前專案尚未實作登入/權限（auth/guards），所以 API 需要明確知道「誰在操作」才能寫 audit。

因此我在 checkout/checkin 的 body 中加入：
- `actor_user_id`：操作者（館員/管理者）的 user id

未來若加上登入，這個欄位可以改由 token 自動推導；但在 MVP 階段先用明確欄位保證稽核可追溯。

## 4) 重要實作片段（逐段落帶讀）

### 4.1 借出流程的交易骨架
`apps/api/src/circulation/circulation.service.ts`
```ts
return await this.db.transaction(async (client) => {
  const actor = await this.requireActor(client, orgId, input.actor_user_id);
  const borrower = await this.requireBorrowerByExternalId(
    client,
    orgId,
    input.user_external_id,
  );
  const item = await this.requireItemByBarcodeForUpdate(
    client,
    orgId,
    input.item_barcode,
  );
  // ...政策與上限檢查
  // ...建立 loan、更新 item、寫 audit
});
```
重點說明：
1. `transaction` 確保 loans + items + audit 同步成功/失敗。
2. `requireItemByBarcodeForUpdate` 使用 `FOR UPDATE` 鎖定冊，避免同冊被同時借出。
3. `requireActor`/`requireBorrower` 先檢查角色與狀態，避免錯誤操作進 DB。

### 4.2 借閱政策與借閱上限
`apps/api/src/circulation/circulation.service.ts`
```ts
const policy = await this.getPolicyForRole(client, orgId, borrower.role);
if (!policy) {
  throw new NotFoundException({ error: { code: 'POLICY_NOT_FOUND', message: 'Circulation policy not found' } });
}

const openLoanCount = await this.countOpenLoansForUser(client, orgId, borrower.id);
if (openLoanCount >= policy.max_loans) {
  throw new ConflictException({ error: { code: 'LOAN_LIMIT_REACHED', message: 'User has reached max loans' } });
}
```
重點說明：
1. policy 依 `borrower.role` 找（student/teacher），符合資料模型設計。
2. `max_loans` 是最重要的流通限制之一，必須在 DB 變更前先檢查。

### 4.3 歸還時的 hold 指派（若有排隊）
`apps/api/src/circulation/circulation.service.ts`
```ts
const hold = await this.findNextQueuedHold(client, orgId, item.bibliographic_id);

if (hold) {
  const pickupDays = hold.hold_pickup_days ?? DEFAULT_HOLD_PICKUP_DAYS;
  await client.query(
    `
    UPDATE holds
    SET status = 'ready',
        assigned_item_id = $1,
        ready_at = now(),
        ready_until = now() + ($2::int * interval '1 day')
    WHERE id = $3
    `,
    [item.id, pickupDays, hold.id],
  );
  newStatus = 'on_hold';
}
```
重點說明：
1. 若有 queued hold，就把冊轉成 `on_hold` 並指派給隊首。
2. `hold_pickup_days` 會依持有人政策帶入；若找不到政策就用預設值。
3. 這段邏輯即使「還沒做 holds API」也能先運作（若 DB 已有 hold 資料）。

### 4.4 寫入 audit_events
`apps/api/src/circulation/circulation.service.ts`
```ts
await client.query(
  `
  INSERT INTO audit_events (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES ($1, $2, $3, $4, $5, $6::jsonb)
  `,
  [
    orgId,
    actor.id,
    'loan.checkout',
    'loan',
    loan.id,
    JSON.stringify({ item_id: loan.item_id, user_id: loan.user_id, item_barcode: input.item_barcode }),
  ],
);
```
重點說明：
1. `actor_user_id` 由 request 傳入，確保稽核可追溯。
2. `metadata` 留住 item/user/條碼，日後查核會很有幫助。

## 5) 如何手動驗證（不用測試框架也能確認）
前置：
1. `docker compose up -d postgres`
2. 套用 `db/schema.sql`
3. 設定 `DATABASE_URL`
4. `npm run dev:api`

`DATABASE_URL` 範例：
```
postgresql://library:library@localhost:5432/library_system
```

用 curl（或 Postman）測試：
- 借出：
  - `POST http://localhost:3001/api/v1/orgs/{orgId}/circulation/checkout`
  - body：`{ "user_external_id": "S1130123", "item_barcode": "LIB-00001234", "actor_user_id": "{librarianUserId}" }`
- 歸還：
  - `POST http://localhost:3001/api/v1/orgs/{orgId}/circulation/checkin`
  - body：`{ "item_barcode": "LIB-00001234", "actor_user_id": "{librarianUserId}" }`

### 5.1 端到端驗證（PowerShell 範例，含主檔 → 書目/冊 → 借還）
> 這段腳本會建立一套新的 org/資料，因此建議用隨機 suffix 避免 unique 衝突。

```powershell
# 共同設定：API base 與隨機後綴（避免 code/barcode 重複）
$base = "http://localhost:3001/api/v1"
$suffix = Get-Random -Minimum 1000 -Maximum 9999

function Invoke-Api {
  param([string]$Method, [string]$Path, $Body = $null)
  $uri = "$base$Path"
  if ($Body -ne $null) {
    return Invoke-RestMethod -Method $Method -Uri $uri -ContentType "application/json" `
      -Body ($Body | ConvertTo-Json -Depth 6)
  }
  return Invoke-RestMethod -Method $Method -Uri $uri
}

# 1) 建立 organization
$org = Invoke-Api Post "/orgs" @{ name = "XX 國小 $suffix"; code = "xxes-$suffix" }
$orgId = $org.id

# 2) 建立 location
$location = Invoke-Api Post "/orgs/$orgId/locations" @{
  code = "main-$suffix"
  name = "圖書館主館"
  area = "小說區"
  shelf_code = "A-03"
}
$locationId = $location.id

# 3) 建立 circulation policies（student/teacher）
Invoke-Api Post "/orgs/$orgId/circulation-policies" @{
  code = "student_default_$suffix"
  name = "學生預設政策"
  audience_role = "student"
  loan_days = 14
  max_loans = 5
  max_renewals = 1
  max_holds = 3
  hold_pickup_days = 3
}
Invoke-Api Post "/orgs/$orgId/circulation-policies" @{
  code = "teacher_default_$suffix"
  name = "教師預設政策"
  audience_role = "teacher"
  loan_days = 30
  max_loans = 10
  max_renewals = 2
  max_holds = 5
  hold_pickup_days = 5
}

# 4) 建立館員（actor）與借閱者（borrower）
$actor = Invoke-Api Post "/orgs/$orgId/users" @{
  external_id = "L$suffix"
  name = "館員示範"
  role = "librarian"
  org_unit = "圖書館"
}
$actorId = $actor.id

$borrower = Invoke-Api Post "/orgs/$orgId/users" @{
  external_id = "S$suffix"
  name = "借閱示範"
  role = "student"
  org_unit = "501"
}

# 5) 建立書目與冊
$bib = Invoke-Api Post "/orgs/$orgId/bibs" @{
  title = "哈利波特：神秘的魔法石"
  creators = @("J. K. Rowling")
  subjects = @("魔法", "小說")
  isbn = "9789573317248"
  classification = "823.914"
}

$item = Invoke-Api Post "/orgs/$orgId/bibs/$($bib.id)/items" @{
  barcode = "LIB-$suffix"
  call_number = "823.914 R79 v.1"
  location_id = $locationId
}

# 6) 基本查詢（書目/冊）
Invoke-Api Get "/orgs/$orgId/bibs?query=哈利" | Out-Host
Invoke-Api Get "/orgs/$orgId/items?bibliographic_id=$($bib.id)" | Out-Host

# 7) 借出 → 歸還
$checkout = Invoke-Api Post "/orgs/$orgId/circulation/checkout" @{
  user_external_id = $borrower.external_id
  item_barcode = $item.barcode
  actor_user_id = $actorId
}
$checkin = Invoke-Api Post "/orgs/$orgId/circulation/checkin" @{
  item_barcode = $item.barcode
  actor_user_id = $actorId
}

$checkout | Format-List | Out-Host
$checkin | Format-List | Out-Host
```

### 5.2 進階驗證：歸還時觸發 hold 指派
若你想驗證「checkin 時指派 queued hold」的路徑，可先用 SQL 插入一筆 hold，再歸還同書目的冊：

```powershell
$holdSql = @"
INSERT INTO holds (
  organization_id, bibliographic_id, user_id, pickup_location_id, status
)
VALUES (
  '$orgId', '$($bib.id)', '$($borrower.id)', '$locationId', 'queued'
);
"@

$holdSql | docker compose exec -T postgres psql -U library -d library_system
```

此時再做 `checkin`，應該會回傳：
- `item_status = "on_hold"`
- `hold_id` 有值
- `ready_until` 有值（由政策或預設天數計算）
