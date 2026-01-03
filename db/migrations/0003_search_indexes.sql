-- 0003_search_indexes.sql
--
-- 目的：
-- - 補強「模糊搜尋 / 進階搜尋」的效能（對齊 OPAC/後台常用查找行為）
-- - 這些索引也會被 list endpoints（users/items/bibs）大量資料時用到
--
-- 注意：
-- - 這裡只新增 index，不改動資料/欄位，屬於低風險 migration
-- - schema.sql（demo）也會同步包含相同索引；正式環境以 migrations 為準

-- users：borrower lookup（姓名/學號/班級）
-- - listUsers 會用 ILIKE %...% 查 external_id/name/org_unit
-- - name 已有 users_org_name_trgm；這裡補 external_id/org_unit 的 trigram
CREATE INDEX IF NOT EXISTS users_external_id_trgm
  ON users USING gin (external_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_org_unit_trgm
  ON users USING gin (org_unit gin_trgm_ops);

-- item_copies：OPAC available_only / bib counts join
-- - /bibs list 會 JOIN item_copies ON (org_id, bib_id)，並常需要用 status 判斷可借冊
CREATE INDEX IF NOT EXISTS items_org_bib_status
  ON item_copies (organization_id, bibliographic_id, status);

