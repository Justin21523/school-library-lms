# 架構與技術棧決策（可擴充版）

本專案目標是「低人力、低學習成本、資料結構正確、可擴充」的中小學雲端圖書館系統。為了讓 MVP 能快速落地、又不在未來擴充時大改架構，採用「模組化單體（Modular Monolith）＋明確邊界」策略。

## 1) 程式語言與主要技術選型（決策）
- **主要語言：TypeScript**（前後端共用型別與驗證規則，降低整體複雜度）
- **後端：Node.js + NestJS（TypeScript）**
  - 原因：模組化、依賴注入、測試友善、適合逐步擴展成多模組服務
- **前端：Next.js（React + TypeScript）**
  - 原因：可做管理後台與公開 OPAC（查詢頁），並能以 PWA 形式支援行動裝置掃碼作業
- **資料庫：PostgreSQL**
  - 原因：關聯資料一致性、支援 JSONB/全文檢索（FTS），可由 MVP 平滑擴充
- **DB 存取 / 遷移（現況）**
  - DB driver：`pg` + 手寫 SQL（可讀、可控、避免 ORM 魔法；也更容易做交易與效能優化）
  - Schema：`db/schema.sql`（本機 demo/開發用；可重複套用）
  - Migrations：`db/migrations/*` + `schema_migrations`（正式環境用；版本可追溯）
  - Migration runner：`scripts/db-migrate.mjs`（以 `DATABASE_URL` 或 PG* env 連線）
- **快取/背景作業（預留）：Redis + BullMQ**
  - 用途：通知佇列、匯入任務、報表離線產生（MVP 可先不啟用）
- **檢索（預留）：**
  - MVP：PostgreSQL FTS
  - 擴充：Meilisearch / OpenSearch（當資料量或複雜排序需要時）

## 2) 架構原則（MVP → 可擴充）
1. **多租戶（Multi-tenant）從第一天就保留欄位**：核心表格都帶 `organization_id`，避免未來「加學校」時大改資料庫。
2. **書目（Bibliographic）與冊（Item/Copy）分離**：借還只作用在冊；搜尋/呈現以書目為主。
3. **政策驅動（Policy-driven）**：借期/上限/續借/預約等規則以「借閱政策」配置，不寫死在程式。
4. **稽核與可追溯**：關鍵動作寫 `audit_events`，後續可用於追責與除錯。
5. **隱私預設保守**：借閱歷史保存期限、匯出遮罩、最小蒐集與最小揭露。

## 3) 模組邊界（建議）
- `catalog`：書目、作者/主題、分類與匯入
- `inventory`：冊、位置、狀態、盤點
- `circulation`：借還、續借、預約、逾期
- `identity`：使用者、角色、權限、匯入
- `reports`：報表與匯出（先做 CSV）
- `audit`：稽核事件與查詢

## 4) 倉庫目錄結構（建議）
- `apps/api/`：後端服務（REST API）
- `apps/web/`：前端網站（管理後台 + OPAC）
- `packages/shared/`：共用型別、驗證 schema、共用工具
- `db/`：資料庫 schema / migrations / seed
- 文件：`README.md`、`MVP-SPEC.md`、`DATA-DICTIONARY.md`、`reference-docs/`
