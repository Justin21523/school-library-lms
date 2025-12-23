# Database

## 快速開始（本機）
1. 啟動資料庫：`docker compose up -d postgres`
2. 套用 schema（草案）：把 `db/schema.sql` 匯入到 `library_system` 資料庫

> 後續若採 Prisma migrations，可把 `db/schema.sql` 視為「初版對照」，再轉成 migration 檔。

