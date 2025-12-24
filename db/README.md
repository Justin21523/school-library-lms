# Database

## 快速開始（本機）
1. 啟動資料庫：`docker compose up -d postgres`
2. 套用 schema（草案）：把 `db/schema.sql` 匯入到 `library_system` 資料庫
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

> 後續若採 Prisma migrations，可把 `db/schema.sql` 視為「初版對照」，再轉成 migration 檔。
