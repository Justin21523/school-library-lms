-- Demo seed（本機開發用假資料）
--
-- 目標：
-- - 幫你在 DB 裡準備一整套「可測所有面板」的資料：
--   - 1 個 organization
--   - locations / users / user_credentials（可直接登入 staff + OPAC）
--   - circulation_policies（含 overdue_block_days）
--   - bibs / items（含多種 status：available/checked_out/on_hold/lost/repair）
--   - loans（含逾期 open loan，能測 Overdue Report + 停權錯誤）
--   - holds（含 ready + queued + expired-ready，可測 ready holds report / fulfill / expire-ready maintenance）
--   - inventory session + scans（可測 Inventory 工作台 + inventory-diff report）
--   - audit_events（讓 /audit-events 進去就看得到資料）
--
-- 安全性聲明（很重要）：
-- - 這是「示範用」：包含可登入的 demo 密碼（雜湊後儲存在 user_credentials）
-- - 請勿在正式環境使用；也不要把含真實個資的資料貼到公開倉庫
--
-- 可重複執行（idempotent）：
-- - 我們優先用「可唯一定位」的欄位找到既有資料（org.code / location.code / user.external_id）
-- - 其餘資料（bibs/items/loans/holds/inventory/...）使用固定 UUID 並以 ON CONFLICT DO NOTHING 防止重複插入

BEGIN;

DO $$
DECLARE
  -- ----------------------------
  -- 0) Demo 組織基本資訊
  -- ----------------------------
  -- code 具有全域唯一限制（organizations.code UNIQUE），因此這裡用一個「很不容易撞到」的值
  -- - 若你想要同一台機器跑多份 demo，可以自行改成 demo-lms-seed-002 之類
  v_org_code text := 'demo-lms-seed';
  v_org_name text := '示範國小（Demo School）';
  v_org_id uuid;

  -- ----------------------------
  -- 1) Locations（館別/位置）
  -- ----------------------------
  v_loc_main uuid;
  v_loc_branch uuid;
  v_loc_inactive uuid;

  -- ----------------------------
  -- 2) Users（含 staff + patron）
  -- ----------------------------
  v_user_admin uuid;
  v_user_librarian uuid;
  v_user_teacher uuid;
  v_user_student_ok uuid;
  v_user_student_blocked uuid;

  -- ----------------------------
  -- 3) BIB IDs（固定 UUID；避免重複插入）
  -- ----------------------------
  v_bib_hp uuid := 'fd7ab6ef-6c68-44de-9139-d8d071c8e22b';
  v_bib_lp uuid := 'b6864e0a-98f9-4a25-8730-2dbf30f388c7';
  v_bib_zero uuid := 'e421acc6-21cd-4d9f-b7c5-65960a744ab5';
  v_bib_inv uuid := 'c201e347-9bbf-4e8f-a05a-cdc34dbf31d2';
  v_bib_exp uuid := 'ca7b975f-e664-46a2-9dd1-f2a0681e19da';
  v_bib_withdrawn uuid := 'ad677403-fda2-4f28-9928-635e0e54f2a0';

  -- ----------------------------
  -- 4) Item IDs（固定 UUID）
  -- ----------------------------
  v_item_hp_1 uuid := '860e17da-c349-4c93-966f-d7136513205f';
  v_item_hp_2 uuid := 'b4fa80f1-a63f-4186-97eb-365b393a02bf';
  v_item_lp_1 uuid := '1f699e14-1ca2-48b9-8030-0fb62b043968';
  v_item_zero_1 uuid := '3d39bc91-fca2-4916-9e63-dbbf3079bd2c';
  v_item_repair_1 uuid := 'adb02d34-8204-44bf-ae10-b26790c24eda';
  v_item_lost_1 uuid := '8e0afeef-9cf0-4876-b36b-38b8dbc0d3ff';
  v_item_inv_a uuid := 'b81f6dc1-e994-40d4-be31-1409aa776ebe';
  v_item_inv_b uuid := '57898c91-dbc1-4d6b-9188-88ac2118b347';
  v_item_inv_c uuid := 'bd43c8dd-c1d9-4da4-97eb-29eb384d0789';
  v_item_exp_1 uuid := 'b2e75e13-ce38-457e-8577-e3d133ff7af8';
  v_item_withdrawn_1 uuid := 'baa73bbc-5a0a-4e50-ab81-c66abe4cfa2b';
  v_item_renew_1 uuid := 'df409a9e-528d-4205-a7b4-d66fd551af1a';

  -- ----------------------------
  -- 5) Loans / Holds / Inventory IDs（固定 UUID）
  -- ----------------------------
  v_loan_overdue uuid := '217b03c6-9ec1-425b-8434-fe105492d08a';
  v_loan_renew_ok uuid := 'cb4f2fea-6563-4323-b5b2-b2efc599b4f7';
  v_loan_hp_hist_1 uuid := '36baf0a6-54b1-4cb0-a715-701e54e72aaa';
  v_loan_hp_hist_2 uuid := 'db4dec3e-8eda-488b-b626-93045db90023';
  v_loan_lp_hist_1 uuid := '2c43ae58-6693-4b1a-aa93-bb91ea936a48';

  v_hold_ready_ok uuid := '5d87e167-b82d-4ae0-9aba-17fc12f041c5';
  v_hold_queued_lp uuid := '25c0e206-9531-4cfe-8b97-34b430ee4bad';
  v_hold_ready_expired uuid := 'b26571cd-43d7-4896-91ef-666e32524185';
  v_hold_queued_exp_next uuid := '0257f634-a13a-443a-b4cc-e5f2d73c2985';

  v_inv_session uuid := '60643715-806c-4523-94d3-6c123102470e';
  v_inv_scan_a uuid := '5766a506-d191-484f-b99f-3a683d8777d3';
  v_inv_scan_lost uuid := '45004e51-b91a-4e05-9068-76ccb835e435';
  v_inv_scan_mismatch uuid := '65d6c9e5-f1fd-4726-ba4a-a000cebd3769';

  -- ----------------------------
  -- 6) Audit event IDs（固定 UUID；避免重複插入）
  -- ----------------------------
  v_audit_inventory_started uuid := '503ada81-5892-4782-8dff-5f5a5eb80a76';
  v_audit_inventory_closed uuid := 'd6e86c7c-247d-4b69-997e-77b84717116b';
  v_audit_catalog_import uuid := '272c8599-6640-4624-8691-101676c48e1d';
  v_audit_auth_set_password uuid := '89a24c65-798b-4f13-845a-5b5cf51ca6ff';
  v_audit_loan_checkout uuid := 'fafc0625-6cda-4a65-9d2d-05d9bdfc5adc';
  v_audit_hold_place uuid := '9b919603-c335-4712-bdb2-985fecb4bd7d';

  -- catalog.import_csv 的 entity_id：我們用「固定字串的 sha256」模擬（只用於 demo）
  v_demo_catalog_sha256 text := 'deeba0d29a135809c722da6d066d7bbd377f14c9014a11f4c2b4ee7cf65484ca';
BEGIN
  -- ----------------------------
  -- A) organizations：用 code 找；不存在就建立
  -- ----------------------------
  SELECT id INTO v_org_id
  FROM organizations
  WHERE code = v_org_code;

  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, code)
    VALUES (v_org_name, v_org_code)
    RETURNING id INTO v_org_id;
  END IF;

  -- ----------------------------
  -- B) locations：用 (org, code) 找；不存在就建立
  -- ----------------------------
  SELECT id INTO v_loc_main
  FROM locations
  WHERE organization_id = v_org_id
    AND code = 'MAIN';

  IF v_loc_main IS NULL THEN
    INSERT INTO locations (organization_id, code, name, area, shelf_code, status)
    VALUES (v_org_id, 'MAIN', '主館（示範）', '圖書館', 'A-01', 'active')
    RETURNING id INTO v_loc_main;
  END IF;

  SELECT id INTO v_loc_branch
  FROM locations
  WHERE organization_id = v_org_id
    AND code = 'BRANCH';

  IF v_loc_branch IS NULL THEN
    INSERT INTO locations (organization_id, code, name, area, shelf_code, status)
    VALUES (v_org_id, 'BRANCH', '分館（示範）', '教學大樓', 'B-02', 'active')
    RETURNING id INTO v_loc_branch;
  END IF;

  -- inactive location：用於測試「OPAC 只顯示 active locations」的 UX
  SELECT id INTO v_loc_inactive
  FROM locations
  WHERE organization_id = v_org_id
    AND code = 'CLOSED';

  IF v_loc_inactive IS NULL THEN
    INSERT INTO locations (organization_id, code, name, area, shelf_code, status)
    VALUES (v_org_id, 'CLOSED', '已停用館別（示範）', '舊館', 'X-00', 'inactive')
    RETURNING id INTO v_loc_inactive;
  END IF;

  -- ----------------------------
  -- C) users：用 (org, external_id) 找；不存在就建立
  --
  -- Demo 密碼（所有帳號相同，便於測試）：
  -- - password = demo1234
  -- ----------------------------
  SELECT id INTO v_user_admin
  FROM users
  WHERE organization_id = v_org_id
    AND external_id = 'A0001';

  IF v_user_admin IS NULL THEN
    INSERT INTO users (organization_id, external_id, name, role, org_unit, status)
    VALUES (v_org_id, 'A0001', 'Demo Admin', 'admin', NULL, 'active')
    RETURNING id INTO v_user_admin;
  END IF;

  SELECT id INTO v_user_librarian
  FROM users
  WHERE organization_id = v_org_id
    AND external_id = 'L0001';

  IF v_user_librarian IS NULL THEN
    INSERT INTO users (organization_id, external_id, name, role, org_unit, status)
    VALUES (v_org_id, 'L0001', 'Demo Librarian', 'librarian', '圖書館', 'active')
    RETURNING id INTO v_user_librarian;
  END IF;

  SELECT id INTO v_user_teacher
  FROM users
  WHERE organization_id = v_org_id
    AND external_id = 'T0001';

  IF v_user_teacher IS NULL THEN
    INSERT INTO users (organization_id, external_id, name, role, org_unit, status)
    VALUES (v_org_id, 'T0001', '陳老師', 'teacher', '教務處', 'active')
    RETURNING id INTO v_user_teacher;
  END IF;

  SELECT id INTO v_user_student_ok
  FROM users
  WHERE organization_id = v_org_id
    AND external_id = 'S1130123';

  IF v_user_student_ok IS NULL THEN
    INSERT INTO users (organization_id, external_id, name, role, org_unit, status)
    VALUES (v_org_id, 'S1130123', '王小明', 'student', '501', 'active')
    RETURNING id INTO v_user_student_ok;
  END IF;

  -- blocked student：我們會給他一筆「逾期 open loan」，用於測試停權錯誤碼
  SELECT id INTO v_user_student_blocked
  FROM users
  WHERE organization_id = v_org_id
    AND external_id = 'S1130999';

  IF v_user_student_blocked IS NULL THEN
    INSERT INTO users (organization_id, external_id, name, role, org_unit, status)
    VALUES (v_org_id, 'S1130999', '李小華', 'student', '502', 'active')
    RETURNING id INTO v_user_student_blocked;
  END IF;

  -- ----------------------------
  -- D) user_credentials（密碼雜湊/鹽；scrypt-v1）
  --
  -- 這裡的 salt/hash 是用 Node.js crypto.scrypt 產生：
  -- - salt：16 bytes random → base64
  -- - hash：scrypt(password, salt, 64) → base64
  --
  -- 注意：為了示範「可直接登入」，我們在 seed 直接寫入 credentials。
  -- ----------------------------
  INSERT INTO user_credentials (user_id, password_salt, password_hash, algorithm)
  VALUES (v_user_admin, 'puw4JlsUc1LVsJ7VtQAN9g==', 'qAPb9M3k9ZP68ZDkTyoMnpg/IMHDOZtEvTB5ISNrSZ77xDPOf1MqWemAUqky8Lrq9FL0nHEqq/68TGW+P/oE5Q==', 'scrypt-v1')
  ON CONFLICT (user_id)
  DO UPDATE SET
    password_salt = EXCLUDED.password_salt,
    password_hash = EXCLUDED.password_hash,
    algorithm = EXCLUDED.algorithm,
    updated_at = now();

  INSERT INTO user_credentials (user_id, password_salt, password_hash, algorithm)
  VALUES (v_user_librarian, '4MQCkUFTOwGsUjfKLFMlbQ==', 'jTweXr/ceWlDeRRPsP5n8FXg2AslAuvMv8bAxENtHaLMMd6zfoBPqbBcaktfye94mRQYo6fKBFtmKkbT3a+1bw==', 'scrypt-v1')
  ON CONFLICT (user_id)
  DO UPDATE SET
    password_salt = EXCLUDED.password_salt,
    password_hash = EXCLUDED.password_hash,
    algorithm = EXCLUDED.algorithm,
    updated_at = now();

  INSERT INTO user_credentials (user_id, password_salt, password_hash, algorithm)
  VALUES (v_user_teacher, 'viPzDz5aMbdPk/eTyVnMxA==', '5qGQjoSzY6L2Dn0T2uxiqCt7m5jKYXQxtK/ZIqwc6NQT9ugfTljOLc4KA4uMd2HEArwmKROhs0YwSejP0o7CBg==', 'scrypt-v1')
  ON CONFLICT (user_id)
  DO UPDATE SET
    password_salt = EXCLUDED.password_salt,
    password_hash = EXCLUDED.password_hash,
    algorithm = EXCLUDED.algorithm,
    updated_at = now();

  INSERT INTO user_credentials (user_id, password_salt, password_hash, algorithm)
  VALUES (v_user_student_ok, 'QReOCa3H4lZtrrlz+uDcIg==', 'TcwKJmyqu9Hq3fNMlJiSM0AKlhkRyhRtNs7KAGo7XzPbclaOdJi4Ar+ttz9a7komwyHdWG7b6O75ogv+v3BAmQ==', 'scrypt-v1')
  ON CONFLICT (user_id)
  DO UPDATE SET
    password_salt = EXCLUDED.password_salt,
    password_hash = EXCLUDED.password_hash,
    algorithm = EXCLUDED.algorithm,
    updated_at = now();

  INSERT INTO user_credentials (user_id, password_salt, password_hash, algorithm)
  VALUES (v_user_student_blocked, 'fNyCM+Kl869Hqk1SvUlOKw==', '6tYOsUt+08OU5M6aqiks+/frUkEaV3cKNCJpDv8R0I1zkLqE9VRSJME034EwVsjiHXH8DpBEi63/GzjbokEpJw==', 'scrypt-v1')
  ON CONFLICT (user_id)
  DO UPDATE SET
    password_salt = EXCLUDED.password_salt,
    password_hash = EXCLUDED.password_hash,
    algorithm = EXCLUDED.algorithm,
    updated_at = now();

  -- ----------------------------
  -- E) circulation_policies：用 (org, code) 找；不存在就建立
  -- ----------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM circulation_policies
    WHERE organization_id = v_org_id
      AND code = 'student_default'
  ) THEN
    INSERT INTO circulation_policies (
      organization_id,
      code,
      name,
      audience_role,
      loan_days,
      max_loans,
      max_renewals,
      max_holds,
      hold_pickup_days,
      overdue_block_days
    )
    VALUES (
      v_org_id,
      'student_default',
      '學生預設政策（Demo）',
      'student',
      14,
      5,
      1,
      3,
      3,
      7
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM circulation_policies
    WHERE organization_id = v_org_id
      AND code = 'teacher_default'
  ) THEN
    INSERT INTO circulation_policies (
      organization_id,
      code,
      name,
      audience_role,
      loan_days,
      max_loans,
      max_renewals,
      max_holds,
      hold_pickup_days,
      overdue_block_days
    )
    VALUES (
      v_org_id,
      'teacher_default',
      '教師預設政策（Demo）',
      'teacher',
      30,
      10,
      2,
      5,
      5,
      14
    );
  END IF;

  -- ----------------------------
  -- F) bibliographic_records：固定 UUID + ON CONFLICT DO NOTHING
  -- ----------------------------
  INSERT INTO bibliographic_records (
    id, organization_id, title, creators, publisher, published_year, language, subjects, isbn, classification
  )
  VALUES (
    v_bib_hp,
    v_org_id,
    '哈利波特：神秘的魔法石（Demo）',
    ARRAY['J. K. Rowling'],
    '皇冠',
    2000,
    'zh',
    ARRAY['魔法', '小說'],
    '9789573317248',
    '823.914'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO bibliographic_records (
    id, organization_id, title, creators, publisher, published_year, language, subjects, isbn, classification
  )
  VALUES (
    v_bib_lp,
    v_org_id,
    '小王子（Demo）',
    ARRAY['Antoine de Saint-Exupéry'],
    '某出版社',
    1943,
    'zh',
    ARRAY['寓言', '成長'],
    '9789864790000',
    '863.8'
  )
  ON CONFLICT (id) DO NOTHING;

  -- zero-circulation：有 item，但刻意不建立任何 loans（確保近一年查得到）
  INSERT INTO bibliographic_records (
    id, organization_id, title, creators, publisher, published_year, language, subjects, isbn, classification
  )
  VALUES (
    v_bib_zero,
    v_org_id,
    '從未借閱的書（Zero Circulation Demo）',
    ARRAY['Unknown'],
    'Demo Publisher',
    2020,
    'zh',
    ARRAY['測試', '汰舊'],
    NULL,
    '001.234'
  )
  ON CONFLICT (id) DO NOTHING;

  -- inventory diff：我們會在 MAIN 放幾本 available，再用 inventory_scans 造出 missing/unexpected
  INSERT INTO bibliographic_records (
    id, organization_id, title, creators, publisher, published_year, language, subjects, isbn, classification
  )
  VALUES (
    v_bib_inv,
    v_org_id,
    '盤點測試書（Inventory Demo）',
    ARRAY['Inventory Bot'],
    'Demo Publisher',
    2024,
    'zh',
    ARRAY['盤點', '測試'],
    NULL,
    '999.000'
  )
  ON CONFLICT (id) DO NOTHING;

  -- expired ready hold：用於測試 expire-ready maintenance（ready_until < now）
  INSERT INTO bibliographic_records (
    id, organization_id, title, creators, publisher, published_year, language, subjects, isbn, classification
  )
  VALUES (
    v_bib_exp,
    v_org_id,
    '到書未取測試書（Expire Ready Demo）',
    ARRAY['Hold Bot'],
    'Demo Publisher',
    2024,
    'zh',
    ARRAY['預約', '到期處理'],
    NULL,
    '999.100'
  )
  ON CONFLICT (id) DO NOTHING;

  -- withdrawn：用於測試 item exception 的 withdrawn 狀態（報廢/除籍）
  INSERT INTO bibliographic_records (
    id, organization_id, title, creators, publisher, published_year, language, subjects, isbn, classification
  )
  VALUES (
    v_bib_withdrawn,
    v_org_id,
    '已報廢示範書（Withdrawn Demo）',
    ARRAY['Withdraw Bot'],
    'Demo Publisher',
    2010,
    'zh',
    ARRAY['報廢', '除籍', '示範'],
    NULL,
    '000.000'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------
  -- G) item_copies：固定 UUID + ON CONFLICT DO NOTHING
  --
  -- 我們用不同 status 讓你能測：
  -- - Items 列表/Item Detail
  -- - 逾期（checked_out + due_at past）
  -- - Ready holds（on_hold）
  -- - Item exceptions（lost/repair）
  -- - Inventory diff（available + scanned/not scanned）
  -- ----------------------------
  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_hp_1,
    v_org_id,
    v_bib_hp,
    'DEMO-HP-0001',
    '823.914 R79 v.1',
    v_loc_main,
    'available',
    now() - interval '180 days',
    'Demo：可借冊（用於盤點 missing）'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_hp_2,
    v_org_id,
    v_bib_hp,
    'DEMO-HP-0002',
    '823.914 R79 v.1 c.2',
    v_loc_main,
    'checked_out',
    now() - interval '200 days',
    'Demo：逾期 open loan 用（會觸發停權）'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_lp_1,
    v_org_id,
    v_bib_lp,
    'DEMO-LP-0001',
    '863.8 S39',
    v_loc_main,
    'on_hold',
    now() - interval '90 days',
    'Demo：ready hold 指派冊（可用於 fulfill 掃碼）'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_zero_1,
    v_org_id,
    v_bib_zero,
    'DEMO-ZERO-0001',
    '001.234 Z99',
    v_loc_branch,
    'available',
    now() - interval '60 days',
    'Demo：零借閱清單用（不建立 loans）'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_repair_1,
    v_org_id,
    v_bib_inv,
    'DEMO-REP-0001',
    '999.000 I55',
    v_loc_main,
    'repair',
    now() - interval '30 days',
    'Demo：修復中（item exception status）'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_lost_1,
    v_org_id,
    v_bib_inv,
    'DEMO-LOST-0001',
    '999.000 I56',
    v_loc_main,
    'lost',
    now() - interval '30 days',
    'Demo：遺失（item exception status；也用於 inventory unexpected）'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Inventory demo：3 本 available（其中 2 本不掃，形成 missing）
  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_inv_a,
    v_org_id,
    v_bib_inv,
    'DEMO-INV-A',
    '999.000 I01',
    v_loc_main,
    'available',
    now() - interval '20 days',
    'Demo：inventory scan 會掃到（正常）'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_inv_b,
    v_org_id,
    v_bib_inv,
    'DEMO-INV-B',
    '999.000 I02',
    v_loc_main,
    'available',
    now() - interval '20 days',
    'Demo：inventory missing（在架但未掃）'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_inv_c,
    v_org_id,
    v_bib_inv,
    'DEMO-INV-C',
    '999.000 I03',
    v_loc_main,
    'available',
    now() - interval '20 days',
    'Demo：inventory missing（在架但未掃）'
  )
  ON CONFLICT (id) DO NOTHING;

  -- expired-ready hold 指派冊（狀態 on_hold）
  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_exp_1,
    v_org_id,
    v_bib_exp,
    'DEMO-EXP-0001',
    '999.100 H01',
    v_loc_main,
    'on_hold',
    now() - interval '10 days',
    'Demo：ready hold 已過期（測試 expire-ready maintenance）'
  )
  ON CONFLICT (id) DO NOTHING;

  -- withdrawn：報廢/除籍（不可借）
  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_withdrawn_1,
    v_org_id,
    v_bib_withdrawn,
    'DEMO-WD-0001',
    '000.000 W01',
    v_loc_main,
    'withdrawn',
    now() - interval '400 days',
    'Demo：withdrawn（報廢/除籍）狀態示範'
  )
  ON CONFLICT (id) DO NOTHING;

  -- renew 正常案例：一筆「未逾期、可續借」的 open loan
  -- - 重要：renew 會檢查「同書目是否有 queued holds」，因此我們選用沒有 hold 排隊的 v_bib_hp
  INSERT INTO item_copies (
    id, organization_id, bibliographic_id, barcode, call_number, location_id, status, acquired_at, notes
  )
  VALUES (
    v_item_renew_1,
    v_org_id,
    v_bib_hp,
    'DEMO-REN-0001',
    '823.914 R79 v.1 c.3',
    v_loc_main,
    'checked_out',
    now() - interval '15 days',
    'Demo：可續借 open loan（用於 Loans/Renew 成功案例）'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------
  -- H) loans：示範用
  -- ----------------------------

  -- 1) 逾期 open loan（Overdue + 停權）
  -- - due_at < now()，且 days_overdue >= student policy 的 overdue_block_days=7
  INSERT INTO loans (
    id, organization_id, item_id, user_id, checked_out_at, due_at, returned_at, renewed_count, status
  )
  VALUES (
    v_loan_overdue,
    v_org_id,
    v_item_hp_2,
    v_user_student_blocked,
    now() - interval '30 days',
    now() - interval '10 days',
    NULL,
    0,
    'open'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 1.5) 可續借 open loan（Loans/Renew 成功案例）
  INSERT INTO loans (
    id, organization_id, item_id, user_id, checked_out_at, due_at, returned_at, renewed_count, status
  )
  VALUES (
    v_loan_renew_ok,
    v_org_id,
    v_item_renew_1,
    v_user_student_ok,
    now() - interval '3 days',
    now() + interval '11 days',
    NULL,
    0,
    'open'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2) 幾筆歷史 loan（給 US-050 報表用：top-circulation / circulation-summary）
  INSERT INTO loans (
    id, organization_id, item_id, user_id, checked_out_at, due_at, returned_at, renewed_count, status
  )
  VALUES (
    v_loan_hp_hist_1,
    v_org_id,
    v_item_hp_1,
    v_user_student_ok,
    now() - interval '12 days',
    now() - interval '2 days',
    now() - interval '5 days',
    0,
    'closed'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO loans (
    id, organization_id, item_id, user_id, checked_out_at, due_at, returned_at, renewed_count, status
  )
  VALUES (
    v_loan_hp_hist_2,
    v_org_id,
    v_item_hp_1,
    v_user_teacher,
    now() - interval '8 days',
    now() + interval '6 days',
    now() - interval '1 days',
    1,
    'closed'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO loans (
    id, organization_id, item_id, user_id, checked_out_at, due_at, returned_at, renewed_count, status
  )
  VALUES (
    v_loan_lp_hist_1,
    v_org_id,
    v_item_lp_1,
    v_user_student_ok,
    now() - interval '20 days',
    now() - interval '6 days',
    now() - interval '18 days',
    0,
    'closed'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------
  -- I) holds：ready / queued / expired-ready（示範用）
  -- ----------------------------

  -- 1) ready（未過期）：可用於 Circulation 頁的「Fulfill（掃冊條碼）」測試
  -- - 注意：fulfill 會檢查 ready_until 是否過期，因此這筆 ready_until 必須在未來
  INSERT INTO holds (
    id,
    organization_id,
    bibliographic_id,
    user_id,
    pickup_location_id,
    placed_at,
    status,
    assigned_item_id,
    ready_at,
    ready_until
  )
  VALUES (
    v_hold_ready_ok,
    v_org_id,
    v_bib_lp,
    v_user_student_ok,
    v_loc_main,
    now() - interval '1 days',
    'ready',
    v_item_lp_1,
    now() - interval '1 days',
    now() + interval '2 days'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2) queued：同書目排隊中（讓 holds 頁面有資料可看）
  INSERT INTO holds (
    id,
    organization_id,
    bibliographic_id,
    user_id,
    pickup_location_id,
    placed_at,
    status
  )
  VALUES (
    v_hold_queued_lp,
    v_org_id,
    v_bib_lp,
    v_user_teacher,
    v_loc_main,
    now() - interval '12 hours',
    'queued'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3) ready（已過期）：expire-ready maintenance preview 會抓得到
  INSERT INTO holds (
    id,
    organization_id,
    bibliographic_id,
    user_id,
    pickup_location_id,
    placed_at,
    status,
    assigned_item_id,
    ready_at,
    ready_until
  )
  VALUES (
    v_hold_ready_expired,
    v_org_id,
    v_bib_exp,
    v_user_student_blocked,
    v_loc_main,
    now() - interval '5 days',
    'ready',
    v_item_exp_1,
    now() - interval '5 days',
    now() - interval '2 days'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 4) queued：過期後可轉派給下一位（expire-ready apply 會轉派/釋放）
  INSERT INTO holds (
    id,
    organization_id,
    bibliographic_id,
    user_id,
    pickup_location_id,
    placed_at,
    status
  )
  VALUES (
    v_hold_queued_exp_next,
    v_org_id,
    v_bib_exp,
    v_user_teacher,
    v_loc_main,
    now() - interval '4 days',
    'queued'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------
  -- J) inventory session + scans：示範 missing / unexpected
  -- ----------------------------
  INSERT INTO inventory_sessions (
    id, organization_id, location_id, actor_user_id, note, started_at, closed_at
  )
  VALUES (
    v_inv_session,
    v_org_id,
    v_loc_main,
    v_user_librarian,
    'Demo：用固定掃描結果做 inventory-diff',
    now() - interval '1 days',
    now() - interval '1 days' + interval '2 hours'
  )
  ON CONFLICT (id) DO NOTHING;

  -- scans：1) 正常掃到一冊（available + location match）
  INSERT INTO inventory_scans (
    id, organization_id, session_id, location_id, item_id, actor_user_id, scanned_at
  )
  VALUES (
    v_inv_scan_a,
    v_org_id,
    v_inv_session,
    v_loc_main,
    v_item_inv_a,
    v_user_librarian,
    now() - interval '1 days' + interval '10 minutes'
  )
  ON CONFLICT (id) DO NOTHING;

  -- scans：2) 掃到但 status 不合理（lost）
  INSERT INTO inventory_scans (
    id, organization_id, session_id, location_id, item_id, actor_user_id, scanned_at
  )
  VALUES (
    v_inv_scan_lost,
    v_org_id,
    v_inv_session,
    v_loc_main,
    v_item_lost_1,
    v_user_librarian,
    now() - interval '1 days' + interval '12 minutes'
  )
  ON CONFLICT (id) DO NOTHING;

  -- scans：3) 掃到但 location 不一致（掃到 BRANCH 的冊）
  INSERT INTO inventory_scans (
    id, organization_id, session_id, location_id, item_id, actor_user_id, scanned_at
  )
  VALUES (
    v_inv_scan_mismatch,
    v_org_id,
    v_inv_session,
    v_loc_main,
    v_item_zero_1,
    v_user_librarian,
    now() - interval '1 days' + interval '14 minutes'
  )
  ON CONFLICT (id) DO NOTHING;

  -- last_inventory_at：讓 Items/Inventory UI 看得到「最近盤點時間」
  UPDATE item_copies
  SET last_inventory_at = now() - interval '1 days' + interval '10 minutes'
  WHERE id = v_item_inv_a
    AND organization_id = v_org_id;

  UPDATE item_copies
  SET last_inventory_at = now() - interval '1 days' + interval '12 minutes'
  WHERE id = v_item_lost_1
    AND organization_id = v_org_id;

  UPDATE item_copies
  SET last_inventory_at = now() - interval '1 days' + interval '14 minutes'
  WHERE id = v_item_zero_1
    AND organization_id = v_org_id;

  -- ----------------------------
  -- K) audit_events：讓 /audit-events 頁面「一進去就有資料」
  --
  -- 注意：
  -- - 這些事件是「示範用」：我們是用 seed 直接 INSERT（不是透過 service 寫入）
  -- - entity_type/entity_id/metadata 只要能讓 UI 看懂即可（MVP）
  -- ----------------------------
  INSERT INTO audit_events (
    id, organization_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_audit_inventory_started,
    v_org_id,
    v_user_librarian,
    'inventory.session_started',
    'inventory_session',
    v_inv_session::text,
    jsonb_build_object(
      'note', 'Demo seed insert',
      'location_code', 'MAIN'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO audit_events (
    id, organization_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_audit_inventory_closed,
    v_org_id,
    v_user_librarian,
    'inventory.session_closed',
    'inventory_session',
    v_inv_session::text,
    jsonb_build_object(
      'note', 'Demo seed insert',
      'summary', jsonb_build_object(
        'expected_available_count', 4,
        'scanned_count', 3,
        'missing_count', 3,
        'unexpected_count', 2
      )
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO audit_events (
    id, organization_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_audit_catalog_import,
    v_org_id,
    v_user_admin,
    'catalog.import_csv',
    'catalog_import',
    v_demo_catalog_sha256,
    jsonb_build_object(
      'csv_sha256', v_demo_catalog_sha256,
      'source_filename', 'demo.csv',
      'source_note', 'Demo seed insert',
      'summary', jsonb_build_object('items_to_create', 0)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO audit_events (
    id, organization_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_audit_auth_set_password,
    v_org_id,
    v_user_admin,
    'auth.set_password',
    'user',
    v_user_student_ok::text,
    jsonb_build_object(
      'target_external_id', 'S1130123',
      'target_role', 'student',
      'note', 'Demo seed insert'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO audit_events (
    id, organization_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_audit_loan_checkout,
    v_org_id,
    v_user_librarian,
    'loan.checkout',
    'loan',
    v_loan_overdue::text,
    jsonb_build_object(
      'item_barcode', 'DEMO-HP-0002',
      'user_external_id', 'S1130999',
      'note', 'Demo seed insert'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO audit_events (
    id, organization_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_audit_hold_place,
    v_org_id,
    v_user_student_ok,
    'hold.place',
    'hold',
    v_hold_ready_ok::text,
    jsonb_build_object(
      'bibliographic_id', v_bib_lp::text,
      'pickup_location_id', v_loc_main::text,
      'note', 'Demo seed insert'
    )
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

COMMIT;
