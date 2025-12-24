# 資料字典（MVP）

本資料字典以「中小學低人力可維運」為前提，先定義 MVP 必要資料結構。欄位命名以 `snake_case` 表示（實作時可再映射到 API 命名慣例）。

型別建議：`string`、`int`、`bool`、`datetime`（ISO 8601）、`text`、`enum`、`json`、`string[]`。

多租戶（Multi-tenant）建議：核心資料表都包含 `organization_id`（學校/租戶），避免未來要支援多校時大改資料庫。

## 0) organizations（學校/租戶）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | organization ID（UUID） | `org_1a2...` |
| name | string | Y | 學校/單位名稱 | `XX 國小` |
| code | string | N | 可讀代碼（可用於匯入/設定） | `xxes` |
| created_at | datetime | Y | 建立時間 | `2025-12-24T00:00:00Z` |
| updated_at | datetime | Y | 更新時間 | `2025-12-24T00:00:00Z` |

## 1) users（使用者）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 系統內部 ID（UUID） | `u_3f2...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| external_id | string | Y | 學號/教職員編號（來源系統 ID） | `S1130123` |
| name | string | Y | 姓名 | `王小明` |
| role | enum | Y | `admin/librarian/teacher/student/guest` | `student` |
| org_unit | string | N | 班級/單位（可用於篩選與報表） | `501` |
| status | enum | Y | `active/inactive` | `active` |
| created_at | datetime | Y | 建立時間 | `2025-12-24T00:00:00Z` |
| updated_at | datetime | Y | 更新時間 | `2025-12-24T00:00:00Z` |

## 1.1) user_credentials（密碼/憑證；內部用）
> 這張表用於登入（Staff/Patron），避免把密碼欄位與 users 混在一起造成誤回傳風險。

| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| user_id | string | Y | users.id（PK/FK） | `u_3f2...` |
| password_salt | text | Y | 雜湊用 salt | `base64...` |
| password_hash | text | Y | 密碼雜湊 | `base64...` |
| algorithm | string | Y | 演算法版本（MVP：`scrypt-v1`） | `scrypt-v1` |
| created_at | datetime | Y | 建立時間 | `2025-12-24T00:00:00Z` |
| updated_at | datetime | Y | 更新時間 | `2025-12-24T00:00:00Z` |

## 2) bibliographic_records（書目記錄）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 書目 ID（UUID） | `b_8aa...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| title | string | Y | 題名 | `哈利波特：神秘的魔法石` |
| creators | string[] | N | 作者/主要責任者 | `["J. K. Rowling"]` |
| contributors | string[] | N | 譯者/繪者等 | `["彭倩文"]` |
| publisher | string | N | 出版者 | `皇冠` |
| published_year | int | N | 出版年 | `2000` |
| language | string | N | 語言（建議 ISO 639-1） | `zh` |
| subjects | string[] | N | 主題詞/關鍵詞 | `["魔法","小說"]` |
| isbn | string | N | ISBN（去除破折號後儲存也可） | `9789573317248` |
| classification | string | N | 分類（如 DDC 主類/類號） | `823.914` |

## 3) item_copies（館藏冊/複本）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 冊 ID（UUID） | `i_12c...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| bibliographic_id | string | Y | 對應書目 ID | `b_8aa...` |
| barcode | string | Y | 冊條碼（唯一） | `LIB-00001234` |
| call_number | string | Y | 索書號（含分類+著者號/卷冊） | `823.914 R79 v.1` |
| location_id | string | Y | 館藏位置/分館 | `loc_main` |
| status | enum | Y | `available/checked_out/on_hold/lost/withdrawn/repair` | `available` |
| acquired_at | datetime | N | 入藏/取得日期 | `2024-09-01T00:00:00Z` |
| last_inventory_at | datetime | N | 最近盤點掃到時間 | `2025-11-01T03:20:00Z` |
| notes | text | N | 備註（破損、贈書等） | `封面破損` |

## 3.1) inventory_sessions（盤點作業）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 盤點 session ID（UUID） | `inv_s_...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| location_id | string | Y | 盤點位置/分館 | `loc_abc...` |
| actor_user_id | string | Y | 開始/關閉盤點的操作者（staff） | `u_admin...` |
| note | text | N | 盤點備註 | `期末盤點` |
| started_at | datetime | Y | 開始時間 | `2025-12-24T08:00:00Z` |
| closed_at | datetime | N | 結束時間（未結束為空） | `2025-12-24T10:00:00Z` |

## 3.2) inventory_scans（盤點掃描紀錄）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | scan ID（UUID） | `inv_sc_...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| session_id | string | Y | 對應 inventory_sessions.id | `inv_s_...` |
| location_id | string | Y | 盤點 location（與 session 同） | `loc_abc...` |
| item_id | string | Y | 掃到的冊（item_copies.id） | `i_12c...` |
| actor_user_id | string | Y | 執行掃描的操作者（staff） | `u_admin...` |
| scanned_at | datetime | Y | 掃描時間 | `2025-12-24T08:30:00Z` |

## 4) loans（借閱）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 借閱 ID（UUID） | `l_55e...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| item_id | string | Y | 借出的冊 ID | `i_12c...` |
| user_id | string | Y | 借閱者 ID | `u_3f2...` |
| checked_out_at | datetime | Y | 借出時間 | `2025-12-01T08:10:00Z` |
| due_at | datetime | Y | 到期日 | `2025-12-15T23:59:59Z` |
| returned_at | datetime | N | 歸還時間（未還為空） | `2025-12-10T10:00:00Z` |
| renewed_count | int | Y | 續借次數 | `1` |
| status | enum | Y | `open/closed`（逾期可由 `due_at < now` 且 `returned_at` 為空推導） | `open` |

## 5) holds（預約/保留）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 預約 ID（UUID） | `h_9b1...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| bibliographic_id | string | Y | 以書目為主的預約（較常見） | `b_8aa...` |
| user_id | string | Y | 預約者 | `u_3f2...` |
| pickup_location_id | string | Y | 取書地點 | `loc_main` |
| placed_at | datetime | Y | 預約時間 | `2025-12-02T09:00:00Z` |
| status | enum | Y | `queued/ready/cancelled/fulfilled/expired` | `queued` |
| assigned_item_id | string | N | 指派給此預約的冊（到書/保留時） | `i_12c...` |
| ready_at | datetime | N | 到書可取時間 | `2025-12-03T09:00:00Z` |
| ready_until | datetime | N | 到書保留期限 | `2025-12-06T23:59:59Z` |
| cancelled_at | datetime | N | 取消時間 | `2025-12-03T10:00:00Z` |
| fulfilled_at | datetime | N | 完成取書/借出時間 | `2025-12-04T08:00:00Z` |

## 6) circulation_policies（借閱政策）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 政策 ID | `p_student_default` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| code | string | Y | 可讀代碼（唯一於 organization） | `student_default` |
| name | string | Y | 名稱 | `學生預設政策` |
| audience_role | enum | Y | `student/teacher` | `student` |
| loan_days | int | Y | 借期（天） | `14` |
| max_loans | int | Y | 同時可借上限 | `5` |
| max_renewals | int | Y | 續借上限 | `1` |
| max_holds | int | Y | 預約上限 | `3` |
| hold_pickup_days | int | Y | 到書後保留天數 | `3` |
| overdue_block_days | int | Y | 逾期達 X 天後禁止新增借閱（checkout/renew/hold/fulfill；0=不啟用） | `7` |

## 7) locations（位置/分館/書架區）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 位置 ID（UUID） | `loc_abc...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| code | string | Y | 可讀代碼（唯一於 organization） | `loc_main` |
| name | string | Y | 名稱 | `圖書館主館` |
| area | string | N | 分區（兒童區/小說區等） | `兒童區` |
| shelf_code | string | N | 書架代碼（可貼標） | `A-03` |
| status | enum | Y | `active/inactive` | `active` |

## 8) audit_events（稽核紀錄）
| 欄位 | 型別 | 必填 | 說明 | 例子 |
| --- | --- | --- | --- | --- |
| id | string | Y | 紀錄 ID | `a_01d...` |
| organization_id | string | Y | 所屬 organization | `org_1a2...` |
| actor_user_id | string | Y | 操作者 | `u_admin...` |
| action | string | Y | 動作代碼（借出/歸還/刪除/匯入等） | `loan.checkout` |
| entity_type | string | Y | 影響的資料類型 | `item_copy` |
| entity_id | string | Y | 影響的資料 ID | `i_12c...` |
| metadata | json | N | 事件細節（差異欄位、來源檔名等） | `{...}` |
| created_at | datetime | Y | 發生時間 | `2025-12-24T00:00:00Z` |

## MVP 資料原則（建議）
- `barcode` 建議「同一 organization 內唯一」；若要跨校彙整，建議加上學校前綴以降低衝突風險。
- 借閱歷史（已歸還）若要保留，請用「保存期限 + 權限」控管；預設只留必要的統計彙總。
- 書目與冊分離：一本書可有多冊；借還只作用在冊（`item_copies`）。
