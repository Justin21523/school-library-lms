# Database

## 快速開始（本機）
1. 啟動資料庫：`docker compose up -d postgres`
2. 套用 schema（demo/開發用）：把 `db/schema.sql` 匯入到 `library_system` 資料庫
3. （可選）套用 demo 假資料：把 `db/seed-demo.sql` 匯入到 `library_system` 資料庫（會建立示範 organization 與測試資料）

### bash（Mac/Linux/WSL）
```bash
docker compose exec -T postgres psql -U library -d library_system -f db/schema.sql
docker compose exec -T postgres psql -U library -d library_system -f db/seed-demo.sql
```

### PowerShell（Windows）
```powershell
docker compose exec -T postgres psql -U library -d library_system -f db\\schema.sql
docker compose exec -T postgres psql -U library -d library_system -f db\\seed-demo.sql
```

## 正式環境：migrations（建議）
正式環境（上線/擴校）建議改用 migrations 取代直接套用 `db/schema.sql`：
- 版本可追溯：每次變更都新增一個 `db/migrations/*.sql`
- 已套用版本會記錄在 DB 的 `schema_migrations` 表

### 執行方式（用 DATABASE_URL）
```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname" npm run db:migrate
```

### 檔案位置
- Demo/開發：`db/schema.sql`（可重複套用、可讀性高）
- 正式 migrations：`db/migrations/*`（例如 `db/migrations/0001_init.sql`）
