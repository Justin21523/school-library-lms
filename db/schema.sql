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
  -- authority_term_kind：權威控制款目類型（MVP+ 進階編目基礎）
  -- - name：姓名/著者款目（個人名/團體名…後續可再細分）
  -- - subject：主題詞/控制詞彙（thesaurus 的主詞彙）
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'authority_term_kind') THEN
    -- v1.2 起擴充：把其他 controlled vocab 也納入同一張 authority_terms（以 kind 區分）
    -- - geographic：地理名稱（MARC 651）
    -- - genre：類型/體裁（MARC 655）
    -- - language：語言代碼（MARC 041；是否用 $0/$2 視規則而定）
    -- - relator：角色/關係代碼（MARC 700$e/$4；本輪先用前端 datalist，DB 端先預留 kind）
    CREATE TYPE authority_term_kind AS ENUM ('name', 'subject', 'geographic', 'genre', 'language', 'relator');
  ELSE
    -- 既有 DB：用 ALTER TYPE 增補 enum value（Postgres 16 支援 IF NOT EXISTS）
    -- 注意：ALTER TYPE 需要 lock；建議在維運時段執行。
    ALTER TYPE authority_term_kind ADD VALUE IF NOT EXISTS 'geographic';
    ALTER TYPE authority_term_kind ADD VALUE IF NOT EXISTS 'genre';
    ALTER TYPE authority_term_kind ADD VALUE IF NOT EXISTS 'language';
    ALTER TYPE authority_term_kind ADD VALUE IF NOT EXISTS 'relator';
  END IF;
  -- authority_relation_type：thesaurus 關係（BT/NT/RT 的資料模型基礎）
  --
  -- 設計取捨：
  -- - v1 先落地「最常見且最有用」的兩種：
  --   - broader：BT（我們以「narrower → broader」方向存；NT 由反向查詢推導）
  --   - related：RT（同級相關；可做為瀏覽/推薦）
  -- - USE/UF（同義/入口詞）在 v1 先用 authority_terms.variant_labels 表達（簡化）
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'authority_relation_type') THEN
    CREATE TYPE authority_relation_type AS ENUM ('broader', 'related');
  END IF;
  -- bibliographic_name_role：書目 ↔ 姓名款目連結的角色（creator/contributor）
  -- - creator：主要作者/著者（對應表單 creators；MARC 100/700）
  -- - contributor：貢獻者（譯者/插畫者/編者…；對應表單 contributors；MARC 700）
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bibliographic_name_role') THEN
    CREATE TYPE bibliographic_name_role AS ENUM ('creator', 'contributor');
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

-- user_credentials：使用者登入憑證（Staff Auth）
-- - 這張表把「密碼」與「user 本體資料」分離：
--   1) 減少不必要的查詢/回傳時誤把密碼資料帶出去的風險
--   2) 未來若要改成 SSO/LDAP，也能只調整 auth 模組
-- - user_id 為 PK：一個 user 最多一組登入憑證（MVP 版本）
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  algorithm text NOT NULL DEFAULT 'scrypt-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
  -- creators/contributors/subjects/geographics/genres 目前先用 text[] 簡化（概念上是多對多，未來可正規化成 junction tables）
  creators text[] NULL,
  contributors text[] NULL,
  publisher text NULL,
  published_year int NULL,
  language text NULL,
  subjects text[] NULL,
  -- geographics：MARC 651（Subject Added Entry—Geographic Name）
  -- - v1.3 起：逐步改成 term-based（bibliographic_geographic_terms）
  -- - 這裡保留 text[] 做顯示/相容/快速查詢；真正治理/連結以 junction table 為準
  geographics text[] NULL,
  -- genres：MARC 655（Index Term—Genre/Form）
  -- - v1.3 起：逐步改成 term-based（bibliographic_genre_terms）
  -- - 這裡保留 text[] 做顯示/相容/快速查詢；真正治理/連結以 junction table 為準
  genres text[] NULL,
  isbn text NULL,
  classification text NULL,
  -- marc_extras：進階編目用的「額外 MARC 欄位」
  --
  -- 設計原則（對齊你的決策：表單欄位為真相來源）：
  -- - title/creators/subjects/... 這些「表單欄位」是本系統的可治理資料（UI 可編輯/可驗證/可報表）
  -- - MARC 21 是「輸出格式 / 交換格式」：由表單欄位產生
  -- - 但 MARC 還有大量「我們暫時沒做成表單」的欄位（例如 5XX/6XX 進階子欄位）
  --   → 這些欄位先存到 marc_extras（JSONB），讓你：
  --     1) 匯入 MARC 時不會丟資料（保留未對映欄位）
  --     2) 之後做 MARC 編輯器時，有地方可以安全落地
  --
  -- 資料型別：
  -- - 這裡不直接存 ISO2709 二進位（.mrc），因為：
  --   1) JSONB 更容易版本演進、也更容易做差異比對
  --   2) .mrc/.xml 都可以由 JSONB + 表單欄位重建
  marc_extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 重要：schema.sql 會被重複執行（demo-db seed 會每次跑），因此我們用 ADD COLUMN IF NOT EXISTS
-- 讓既有 DB（未 reset volume）也能「就地升級」到新欄位。
ALTER TABLE IF EXISTS bibliographic_records
  ADD COLUMN IF NOT EXISTS marc_extras jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS bibliographic_records
  ADD COLUMN IF NOT EXISTS geographics text[] NULL,
  ADD COLUMN IF NOT EXISTS genres text[] NULL;

-- 常用查詢索引：ISBN / 分類
CREATE INDEX IF NOT EXISTS bibs_org_isbn
  ON bibliographic_records (organization_id, isbn);
CREATE INDEX IF NOT EXISTS bibs_org_classification
  ON bibliographic_records (organization_id, classification);
-- trigram index：title 模糊搜尋（MVP 的 OPAC/後台搜尋會用到）
CREATE INDEX IF NOT EXISTS bibs_title_trgm
  ON bibliographic_records USING gin (title gin_trgm_ops);
-- GIN index：subjects overlap 查詢（支援 `subjects && $labels::text[]`）
-- - 用於 OPAC/後台的「主題詞擴充查詢」（thesaurus expand 後的 labels[]）
CREATE INDEX IF NOT EXISTS bibs_subjects_gin
  ON bibliographic_records USING gin (subjects);
-- GIN index：geographics/genres overlap 查詢（支援 `geographics && $labels::text[]`）
-- - 用於後台的「地理名稱/類型」擴充查詢（例如由 controlled vocab expand 產生 labels[]）
CREATE INDEX IF NOT EXISTS bibs_geographics_gin
  ON bibliographic_records USING gin (geographics);
CREATE INDEX IF NOT EXISTS bibs_genres_gin
  ON bibliographic_records USING gin (genres);

-- bibliographic_identifiers：書目識別碼（外部系統對應/去重）
--
-- 需求背景（進階編目 / MARC 匯入）：
-- - MARC 035（System Control Number）常用於連結外部系統（例如 OCLC number）
-- - 批次匯入時需要「去重」：用 ISBN（020）與 035 來判斷是否應 update vs create
--
-- 設計取捨：
-- - 不把 035 塞進 bibliographic_records（避免 schema 無限膨脹，也避免只支援單一識別碼）
-- - 用 scheme/value 表達，可擴充到其他識別碼（例如 LCCN/ISNI/VIAF...）
-- - 不強制 UNIQUE（同一識別碼出現在多筆資料時，仍能在 preview 階段回報「模糊匹配」）
CREATE TABLE IF NOT EXISTS bibliographic_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE CASCADE,
  scheme text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 常用查詢索引：依 org + scheme + value 查找（preview 去重會用）
CREATE INDEX IF NOT EXISTS bib_identifiers_org_scheme_value
  ON bibliographic_identifiers (organization_id, scheme, value);

-- 常用查詢索引：依 bib 刪除/重建識別碼（apply 更新會用）
CREATE INDEX IF NOT EXISTS bib_identifiers_org_bib
  ON bibliographic_identifiers (organization_id, bibliographic_id);

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

-- inventory_sessions：盤點作業（一次在某個 location 的盤點）
--
-- 盤點的 MVP 目標（對齊 MVP-SPEC.md）：
-- - 「掃描盤點」：館員在書架前掃冊條碼，系統記錄「這本書在這個時間被掃到」
-- - 「差異清單」：
--   1) 在架但未掃（missing）：系統顯示在該 location 的 available 冊，但本次盤點沒掃到
--   2) 掃到但系統顯示非在架（unexpected）：本次掃到的冊，卻不是 available（例如 checked_out/on_hold/lost）
--      或其系統 location 與盤點 location 不一致（代表資料/上架可能有問題）
--
-- 設計取捨：
-- - 我們另外建立 inventory_sessions / inventory_scans 兩張表，原因是：
--   1) 能明確界定「某次盤點」的範圍（session_id）
--   2) 差異清單與 CSV 匯出只要給 session_id 就可重現（不必猜測時間區間）
-- - 同時仍會更新 item_copies.last_inventory_at，讓「單冊最後盤點時間」可直接顯示/搜尋
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NULL
);

-- 常用索引：盤點通常以「最近的 session」為主
CREATE INDEX IF NOT EXISTS inventory_sessions_org_started_at
  ON inventory_sessions (organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS inventory_sessions_org_location_started_at
  ON inventory_sessions (organization_id, location_id, started_at DESC);

-- inventory_scans：盤點掃描紀錄（session × item）
--
-- 重要：一個 session 可能會重複掃到同一冊（例如重掃確認）
-- - MVP 先用 UNIQUE(session_id, item_id) 讓「同冊同 session」只保留一筆（最新 scanned_at）
-- - 若未來要分析「重複掃描次數」，可再加 scan_count 或獨立紀錄表
CREATE TABLE IF NOT EXISTS inventory_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES item_copies(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_id)
);

CREATE INDEX IF NOT EXISTS inventory_scans_session_scanned_at
  ON inventory_scans (session_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS inventory_scans_org_item
  ON inventory_scans (organization_id, item_id);

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
  -- overdue_block_days：逾期達 X 天後，禁止新增借閱（checkout/renew/hold/fulfill）
  -- - 對齊 MVP-SPEC.md：學生 7 天、教師 14 天（可依校內政策調整）
  -- - 0 代表不啟用此規則（MVP 允許）
  overdue_block_days int NOT NULL DEFAULT 0,
  -- is_active：同一 org + audience_role「目前生效」的那一套政策
  --
  -- 為什麼需要 is_active？
  -- - circulation_policies 允許同 role 多筆（代表政策可以有歷史版本）
  -- - 但 checkout/renew/holds 必須有「唯一明確」的規則來源，否則就只能用「最新一筆」的隱性規則
  -- - 我們用 is_active + partial unique index（見下方）把「有效政策」做成可管理的主檔
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

-- DB 保證一致性：同一 org + audience_role 同時只能有一筆 active policy
-- - 用 partial unique index：只對 is_active=true 的列施加唯一性
CREATE UNIQUE INDEX IF NOT EXISTS circulation_policies_one_active_per_role
  ON circulation_policies (organization_id, audience_role)
  WHERE is_active;

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

-- 報表用索引（US-050 / Reports）：
-- - 熱門書/借閱量彙總會依 checked_out_at 做期間查詢
-- - 加上 (organization_id, checked_out_at) 能讓「指定期間」的掃描更快
CREATE INDEX IF NOT EXISTS loans_org_checked_out_at
  ON loans (organization_id, checked_out_at);

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

-- authority_terms：權威控制款目（Authority / Vocabulary v0）
--
-- 目標（對齊你的進階編目需求）：
-- - 提供「姓名」與「主題詞」的權威控制檔（authority file）
-- - 支援「內建詞彙庫」（built-in vocabulary）：用 vocabulary_code + source 表達來源
-- - 先不改動 bibliographic_records.creators/subjects（仍是 text[]），先用 UI/流程「引導一致用詞」
--   → 後續若要做「真正的 authority linking」（以 id 綁定），再新增 junction table 或改欄位型別
--
-- 設計（v0）：
-- - preferred_label：權威標目（應該是最推薦、最一致的用法）
-- - variant_labels：同義詞/別名（例如：同一作者的不同拼法、同一主題詞的別稱）
-- - vocabulary_code：詞彙庫代碼（local / builtin-zh / ...；方便未來擴充多套詞彙庫）
-- - source：資料來源標記（local/builtin/seed-scale/...），便於追溯（traceability）
-- - status：active/inactive（沿用 user_status，與 locations 一致；停用不刪除）
CREATE TABLE IF NOT EXISTS authority_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind authority_term_kind NOT NULL,
  vocabulary_code text NOT NULL DEFAULT 'local',
  preferred_label text NOT NULL,
  variant_labels text[] NULL,
  note text NULL,
  source text NOT NULL DEFAULT 'local',
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 同一 org + kind + vocabulary_code 下，preferred_label 應該唯一（避免兩筆同名款目）
  UNIQUE (organization_id, kind, vocabulary_code, preferred_label)
);

-- 常用索引：依 org/kind/status 列出（管理頁常用）
CREATE INDEX IF NOT EXISTS authority_terms_org_kind_status_created
  ON authority_terms (organization_id, kind, status, created_at DESC);

-- trigram index：支援模糊搜尋（含 variant_labels）
-- - 讓 UI 能做到「輸入一段字」就找得到（包含別名/同義詞）
CREATE INDEX IF NOT EXISTS authority_terms_search_trgm
  ON authority_terms USING gin (
    (preferred_label || ' ' || COALESCE(array_to_string(variant_labels, ' '), '')) gin_trgm_ops
  );

-- authority_term_relations：thesaurus 關係（BT/NT/RT）
--
-- 目標（對齊你要的「主題詞權威控制 + thesaurus」）：
-- - 支援 BT/NT/RT 的基本導覽（瀏覽比純搜尋更適合 K–12）
-- - 可用於檢索擴充（例如：搜尋某主題時，自動包含 UF/NT/RT）
--
-- 資料模型設計（v1）：
-- - relation_type='broader'：我們用「narrower_term → broader_term」方向存
--   - 例如：A（魔法史） BT B（魔法） → 存成 from=A, to=B, type=broader
--   - NT 由反向查詢推導（to=本 term 的那些 from）
-- - relation_type='related'：RT 為對稱關係
--   - DB 只存一筆（用 UUID 字串排序決定 from/to），避免 A↔B 存兩筆造成去重麻煩
--
-- 安全性與資料品質：
-- - 同一 org 內的關係才允許（多租戶隔離）
-- - 服務層會驗證：
--   - from/to 兩端 term 必須同 kind + 同 vocabulary_code
--   - broader 不可形成 cycle（會用 recursive CTE 檢查）
CREATE TABLE IF NOT EXISTS authority_term_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_term_id uuid NOT NULL REFERENCES authority_terms(id) ON DELETE CASCADE,
  relation_type authority_relation_type NOT NULL,
  to_term_id uuid NOT NULL REFERENCES authority_terms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_term_id <> to_term_id),
  UNIQUE (organization_id, from_term_id, relation_type, to_term_id)
);

-- 常用索引：term detail 會用「查本 term 的 BT/NT/RT」
CREATE INDEX IF NOT EXISTS authority_term_relations_org_from
  ON authority_term_relations (organization_id, from_term_id, relation_type);
CREATE INDEX IF NOT EXISTS authority_term_relations_org_to
  ON authority_term_relations (organization_id, to_term_id, relation_type);

-- bibliographic_subject_terms：書目 ↔ 主題詞（authority_terms.kind='subject'）連結表（authority linking v1）
--
-- 你提出的關鍵方向：
-- 1) subjects 先「正規化」再落庫（preferred label）
-- 2) 檢索擴充逐步改為 term_id 驅動（避免靠字串長相）
-- 3) MARC 650/651 的 $0 應能放 authority term id（linking subfield）
--
-- 因此我們新增這張「junction table」：
-- - bibliographic_records.subjects 仍保留 text[]（方便顯示/相容既有 UI）
-- - 但真正的治理/查詢/連結以 bibliographic_subject_terms.term_id 為準
--
-- 欄位設計：
-- - position：保留原本 subjects 的順序（方便匯出/顯示）
-- - PK 採 (org, bib, term) 避免同一主題詞重複連到同一書目
-- - UNIQUE(org, bib, position) 保證序列位置不重複
CREATE TABLE IF NOT EXISTS bibliographic_subject_terms (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES authority_terms(id) ON DELETE RESTRICT,
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, bibliographic_id, term_id),
  UNIQUE (organization_id, bibliographic_id, position)
);

-- 常用索引：
-- - 依 term_id 找有哪些書目（subject term usage / term_id-driven search）
-- - 依 bib_id 列出已連結 terms（讀取/匯出）
CREATE INDEX IF NOT EXISTS bib_subject_terms_org_term_bib
  ON bibliographic_subject_terms (organization_id, term_id, bibliographic_id);
CREATE INDEX IF NOT EXISTS bib_subject_terms_org_bib_pos
  ON bibliographic_subject_terms (organization_id, bibliographic_id, position);

-- bibliographic_name_terms：書目 ↔ 姓名款目（authority_terms.kind='name'）連結表（name linking v1）
--
-- 你要的「人名 term-based」：
-- - 編目 UI 不再讓使用者直接輸入 creators/contributors 字串（避免拼法差異）
-- - 改用 authority_terms.id（term_id）作為真相來源
-- - 並在匯出 MARC 100/700 的 $0 放 `urn:uuid:<term_id>`（linking subfield）
--
-- 角色：
-- - role='creator'：主作者/主要著者（通常第一位會成為 100$a）
-- - role='contributor'：其他貢獻者（通常放 700$a）
--
-- 欄位設計：
-- - position：保留每個 role 內的順序（1-based；WITH ORDINALITY）
-- - PK 採 (org, bib, role, term) 避免同一角色重複連到同一書目
-- - UNIQUE(org, bib, role, position) 保證序列位置不重複
CREATE TABLE IF NOT EXISTS bibliographic_name_terms (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE CASCADE,
  role bibliographic_name_role NOT NULL,
  term_id uuid NOT NULL REFERENCES authority_terms(id) ON DELETE RESTRICT,
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, bibliographic_id, role, term_id),
  UNIQUE (organization_id, bibliographic_id, role, position)
);

-- 常用索引：
-- - 依 term_id 找有哪些書目（name term usage / term_id-driven search）
-- - 依 bib_id 列出 creators/contributors（讀取/匯出）
CREATE INDEX IF NOT EXISTS bib_name_terms_org_term_role_bib
  ON bibliographic_name_terms (organization_id, term_id, role, bibliographic_id);
CREATE INDEX IF NOT EXISTS bib_name_terms_org_bib_role_pos
  ON bibliographic_name_terms (organization_id, bibliographic_id, role, position);

-- bibliographic_geographic_terms：書目 ↔ 地理名稱（authority_terms.kind='geographic'；MARC 651）連結表
--
-- 你要的方向（比照 subjects v1）：
-- - 編目 UI 改成 term-based（送 geographic_term_ids）
-- - 後端回寫/正規化 geographics（text[]）作為顯示/相容用
-- - term_id-driven search / usage / merge 治理以 junction table 為準
--
-- 欄位設計：
-- - position：保留編目順序（匯出 MARC 651 順序）
-- - PK (org, bib, term) 避免同一地理名稱重複連到同一書目
-- - UNIQUE(org, bib, position) 保證序列位置不重複
CREATE TABLE IF NOT EXISTS bibliographic_geographic_terms (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES authority_terms(id) ON DELETE RESTRICT,
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, bibliographic_id, term_id),
  UNIQUE (organization_id, bibliographic_id, position)
);

-- 常用索引（term_id-driven search / usage / 讀取匯出）
CREATE INDEX IF NOT EXISTS bib_geo_terms_org_term_bib
  ON bibliographic_geographic_terms (organization_id, term_id, bibliographic_id);
CREATE INDEX IF NOT EXISTS bib_geo_terms_org_bib_pos
  ON bibliographic_geographic_terms (organization_id, bibliographic_id, position);

-- bibliographic_genre_terms：書目 ↔ 類型/體裁（authority_terms.kind='genre'；MARC 655）連結表
--
-- 設計與 bibliographic_subject_terms 相同（只換 kind/欄位對映）：
-- - term_id-driven：可用於 filters/報表/治理
-- - position：保留編目順序（匯出 MARC 655 順序）
CREATE TABLE IF NOT EXISTS bibliographic_genre_terms (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bibliographic_id uuid NOT NULL REFERENCES bibliographic_records(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES authority_terms(id) ON DELETE RESTRICT,
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, bibliographic_id, term_id),
  UNIQUE (organization_id, bibliographic_id, position)
);

CREATE INDEX IF NOT EXISTS bib_genre_terms_org_term_bib
  ON bibliographic_genre_terms (organization_id, term_id, bibliographic_id);
CREATE INDEX IF NOT EXISTS bib_genre_terms_org_bib_pos
  ON bibliographic_genre_terms (organization_id, bibliographic_id, position);
