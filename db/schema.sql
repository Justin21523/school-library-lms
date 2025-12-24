-- PostgreSQL schema draft for the MVP.
-- Notes:
-- - Multi-tenant: most tables include organization_id.
-- - Overdue is derived (due_at < now() AND returned_at IS NULL), not persisted.

-- pgcrypto：提供 gen_random_uuid() 等函式，讓我們在 DB 端產生 UUID。
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- pg_trgm：提供 trigram 相似度搜尋，適合做「容錯的文字搜尋」（MVP 用 title/name 搜尋很實用）。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 使用 enum 型別的原因：
-- - 對 status/role 這種「有限集合」的欄位，enum 能避免拼字錯誤進入資料庫
-- - 也能讓 constraint 更明確（資料品質更穩）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'librarian', 'teacher', 'student', 'guest');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('active', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
    CREATE TYPE item_status AS ENUM ('available', 'checked_out', 'on_hold', 'lost', 'withdrawn', 'repair');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_status') THEN
    CREATE TYPE loan_status AS ENUM ('open', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hold_status') THEN
    CREATE TYPE hold_status AS ENUM ('queued', 'ready', 'cancelled', 'fulfilled', 'expired');
  END IF;
END $$;

-- organizations：多租戶的根（學校/單位）
-- - 其他幾乎所有表都會用 organization_id 連回來，形成資料隔離邊界
CREATE TABLE IF NOT EXISTS organizations (
  -- id：UUID 主鍵（由 DB 產生）
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- name：學校/單位名稱（必填）
  name text NOT NULL,
  -- code：可讀代碼（選填；若提供，需唯一）
  code text NULL,
  -- created_at/updated_at：時間欄位，方便管理與排序
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- UNIQUE(code)：避免同一套系統裡 code 重複（若未來要允許重複，可改成 UNIQUE(organization_id, code) 或移除）
  UNIQUE (code)
);

-- locations：館別/分區/書架位置
-- - 一個 organization 會有多個 location
-- - 一個 item_copy 必須屬於一個 location（同一時間只在一個位置）
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- organization_id：多租戶隔離（刪除 organization 時連帶刪除 locations）
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- code：可讀代碼（同 org 內唯一）
  code text NOT NULL,
  -- name：顯示名稱
  name text NOT NULL,
  -- area/shelf_code：選填，用於 UI 顯示或實體標籤
  area text NULL,
  shelf_code text NULL,
  -- status：active/inactive（建議用停用，而不是刪除）
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 同一 org 內 location code 不可重複
  UNIQUE (organization_id, code)
);

-- users：讀者/教師/館員/管理者
-- - external_id（學號/員編）作為同 org 內唯一鍵，避免同名問題
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  role user_role NOT NULL,
  org_unit text NULL,
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

-- trigram index：支援 name 的模糊搜尋（例如打錯字、部分匹配）
CREATE INDEX IF NOT EXISTS users_org_name_trgm
  ON users USING gin (name gin_trgm_ops);

-- bibliographic_records：書目（描述「一本書是什麼」）
-- - 注意：這裡不放條碼/位置；那些屬於 item_copies（實體冊）
CREATE TABLE IF NOT EXISTS bibliographic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  -- creators/contributors/subjects 目前先用 text[] 簡化（概念上是多對多，未來可正規化成 junction tables）
  creators text[] NULL,
  contributors text[] NULL,
  publisher text NULL,
  published_year int NULL,
  language text NULL,
  subjects text[] NULL,
  isbn text NULL,
  classification text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 常用查詢索引：ISBN / 分類
CREATE INDEX IF NOT EXISTS bibs_org_isbn
  ON bibliographic_records (organization_id, isbn);
CREATE INDEX IF NOT EXISTS bibs_org_classification
  ON bibliographic_records (organization_id, classification);
-- trigram index：title 模糊搜尋（MVP 的 OPAC/後台搜尋會用到）
CREATE INDEX IF NOT EXISTS bibs_title_trgm
  ON bibliographic_records USING gin (title gin_trgm_ops);

-- item_copies：實體冊（描述「這一冊在哪裡、能不能借」）
-- - 一筆書目可以有多冊（同書多本）
-- - 借還作用在 item_copies（不是作用在書目）
CREATE TABLE IF NOT EXISTS item_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- bibliographic_id：冊必須屬於一筆書目（RESTRICT：避免誤刪書目導致冊/歷史斷鏈）
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE RESTRICT,
  -- barcode：冊條碼（同 org 內唯一，借還流程主要以條碼操作）
  barcode text NOT NULL,
  -- call_number：索書號（上架與找書用）
  call_number text NOT NULL,
  -- location_id：冊目前所在位置（RESTRICT：避免誤刪 location 造成冊失去位置）
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  -- status：available/checked_out/on_hold/...（有限集合）
  status item_status NOT NULL DEFAULT 'available',
  acquired_at timestamptz NULL,
  last_inventory_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 同 org 內 barcode 唯一
  UNIQUE (organization_id, barcode)
);

-- 常用索引：依狀態找可借/借出/保留；依 location 找某區的冊
CREATE INDEX IF NOT EXISTS items_org_status
  ON item_copies (organization_id, status);
CREATE INDEX IF NOT EXISTS items_org_location
  ON item_copies (organization_id, location_id);

-- circulation_policies：借閱政策（把規則存資料，不寫死在程式）
CREATE TABLE IF NOT EXISTS circulation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  -- audience_role：此政策主要給哪一類使用者（MVP：student/teacher）
  audience_role user_role NOT NULL,
  loan_days int NOT NULL,
  max_loans int NOT NULL,
  max_renewals int NOT NULL,
  max_holds int NOT NULL,
  hold_pickup_days int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

-- loans：借閱紀錄（交易資料）
-- - 狀態只分 open/closed；逾期用 due_at 與 returned_at 推導（避免排程更新狀態）
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- item_id/user_id 用 RESTRICT：避免誤刪主檔導致借閱歷史斷鏈
  item_id uuid NOT NULL REFERENCES item_copies(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  returned_at timestamptz NULL,
  renewed_count int NOT NULL DEFAULT 0,
  status loan_status NOT NULL DEFAULT 'open'
);

-- DB 保證一致性：同一冊同一時間最多只有一筆「未歸還」借閱
-- - 用 partial unique index：只對 returned_at IS NULL 的列施加唯一性
CREATE UNIQUE INDEX IF NOT EXISTS loans_one_open_per_item
  ON loans (organization_id, item_id)
  WHERE returned_at IS NULL;

-- 常用索引：查某人目前借了什麼（open loans）
CREATE INDEX IF NOT EXISTS loans_org_user_open
  ON loans (organization_id, user_id)
  WHERE returned_at IS NULL;

-- 常用索引：查逾期/即將到期（open loans 按 due_at）
CREATE INDEX IF NOT EXISTS loans_org_due_open
  ON loans (organization_id, due_at)
  WHERE returned_at IS NULL;

-- holds：預約/保留
-- - 預約以書目為主（bibliographic_id）：讀者想借「這本書」，不在乎是哪一冊
-- - assigned_item_id 是可選：到 ready 階段才會指派某一冊
CREATE TABLE IF NOT EXISTS holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pickup_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  placed_at timestamptz NOT NULL DEFAULT now(),
  status hold_status NOT NULL DEFAULT 'queued',
  -- SET NULL：若冊被移除/修正，保留 holds 記錄與隊列，只解除指派
  assigned_item_id uuid NULL REFERENCES item_copies(id) ON DELETE SET NULL,
  ready_at timestamptz NULL,
  ready_until timestamptz NULL,
  cancelled_at timestamptz NULL,
  fulfilled_at timestamptz NULL
);

-- 常用索引：依狀態查預約（queued/ready）
CREATE INDEX IF NOT EXISTS holds_org_status
  ON holds (organization_id, status);
-- 排隊索引：對同一書目，依 placed_at 形成隊列（只針對 queued 狀態）
CREATE INDEX IF NOT EXISTS holds_org_bib_queue
  ON holds (organization_id, bibliographic_id, placed_at)
  WHERE status = 'queued';

-- DB 保證一致性：同一位讀者對同一書目同時只能有一筆「進行中」的 hold（queued/ready）
-- - 這能避免：重複排隊、以及併發下「先查不存在 → 同時 insert」造成的重複資料
-- - 部分狀態（cancelled/fulfilled/expired）屬於歷史資料，不應阻擋新預約
CREATE UNIQUE INDEX IF NOT EXISTS holds_one_active_per_user_bib
  ON holds (organization_id, bibliographic_id, user_id)
  WHERE status IN ('queued'::hold_status, 'ready'::hold_status);

-- audit_events：稽核事件（追溯誰在什麼時間做了什麼）
-- - entity_type/entity_id 是多型指向（polymorphic），可記錄 item/loan/hold/... 的異動
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 常用索引：依時間倒序查稽核事件
CREATE INDEX IF NOT EXISTS audit_org_created_at
  ON audit_events (organization_id, created_at DESC);
