# 中小學雲端圖書館系統（Lean School Library LMS）

**繁體中文** | [English](README.en.md)

![系統入口（Staff Console / OPAC）](docs/main_entry.png)

本專案目標是打造一套適合台灣中小學、在**人力不足**與**預算有限**情境下可快速導入的雲端圖書館管理系統（LMS）。目前已可在同一套系統內跑通：**編目（MARC21）→ 館藏 → 流通/預約 → 盤點 → 報表/稽核**。此倉庫同時包含：
- **領域知識與參考資料**（A–J 章：編目、分類、主題分析、Metadata、檢索、館藏管理、流通、使用者、資訊行為、倫理政策）
- **可直接落地的 MVP 規格**（user stories、API 草案、資料字典、DB schema）
- **可直接跑起來的 MVP+ 程式**（TypeScript monorepo：NestJS API + Next.js Web + shared SSOT）

> 如果你不熟 TypeScript/Next.js/NestJS，先從 `docs/README.md` 開始讀。

## 專案現況（目前做到了哪裡）
- 文件已整理成「可開發」：`MVP-SPEC.md`、`USER-STORIES.md`、`API-DRAFT.md`、`DATA-DICTIONARY.md`、`db/schema.sql`
- 程式已能端到端操作（MVP+ 版本）：`apps/api` 已落地主檔/名冊 CSV 匯入/書目與冊管理/CSV + MARC 匯入（preview/apply）/MARC 編輯器驗證/權威控制（authority_terms + thesaurus）/進階搜尋（欄位多選 + AND/OR/NOT）/借還續借/預約與到期處理（含 background job）/盤點/報表/稽核/多租戶 RLS，`apps/web` 已提供 Staff Console（`/orgs`）與 OPAC（`/opac`，含 `/me`）
- 架構決策已記錄（含擴充路線）：`ARCHITECTURE.md`、`docs/design-rationale.md`

## 目前功能（MVP+）
以「能在學校現場真的用起來」為目標，先把核心流程做對，並補齊編目/檢索/權威控制的最小可用工具。

### Staff Console（館員端 /orgs）
- 名冊：學生/教師 CSV 匯入、查詢與停用（支援姓名/學號/班級模糊搜尋）
- 編目：書目（bibs）與冊（items）管理、CSV 匯入、MARC 匯入（preview/apply）與 roundtrip
- MARC21：欄位字典（SSOT）+ MARC 編輯器（欄位/子欄位驗證、authority linking helper、即時新增 term）
- 權威控制：authority_terms（姓名/主題/地名/體裁…）+ thesaurus（BT/RT/variants）+ 視覺化編輯器/品質檢查
- 查詢/檢索：書目/冊/借閱/預約支援 `query` 模糊搜尋；書目支援欄位多選 + AND/OR/NOT + metadata filters
- 流通：借出/歸還/續借、預約（holds）建置/取消、取書架、到書未取到期處理（maintenance / background job）
- 盤點：Inventory sessions + 掃碼工作台 + 差異清單 + CSV
- 報表：熱門書、借閱量、逾期、取書架、零借閱…（CSV/列印）
- 稽核：audit events（借還/匯入/狀態異動可追溯）

### OPAC（讀者端 /opac）
- 進階書目檢索：欄位多選 + AND/OR/NOT（must/should/must_not）+ ISBN/分類/出版年/語言/只顯示可借
- OPAC Account：讀者登入（student/teacher）+ `/me`（我的借閱/我的預約）

MVP 預設政策已定案（可調）：請見 `MVP-SPEC.md`。

## 技術選型（為什麼這樣選，與未來怎麼擴充）
這裡的核心策略是「**模組化單體（Modular Monolith）**」：先用最少的部署/維運成本把系統做出來，但保留清楚邊界，未來需要時再拆分。

- 語言：TypeScript（前後端共用型別，降低契約不一致）
- 後端：NestJS（模組化、DI、可測試、適合逐步擴充）
- 前端：Next.js（可做管理後台 + OPAC，也適合 PWA/行動裝置）
- DB：PostgreSQL（交易一致性、JSONB、trigram 容錯搜尋；多租戶 RLS；正式環境 migrations）
- shared：`packages/shared`（SSOT：MARC21 欄位字典、authority linking 規則）

完整理由與替代方案取捨：`docs/design-rationale.md`、`ARCHITECTURE.md`。

## 倉庫結構
```
.
├─ apps/
│  ├─ api/          # NestJS API（/api/v1）
│  └─ web/          # Next.js Web（Staff Console: /orgs、OPAC: /opac）
├─ packages/
│  └─ shared/       # SSOT：MARC21 字典、authority linking 規則等
├─ db/
│  ├─ schema.sql       # Demo/開發：可重複套用、可讀性高
│  ├─ migrations/      # 正式環境：migrations（schema_migrations）
│  ├─ seed-demo.sql    # 本機 demo 假資料（可重複執行）
│  └─ README.md        # DB 說明
└─ docs/            # 文件：運作方式、設計取捨、實作筆記、部署與測試
   └─ reference-docs/  # A–J 文獻與草案（含匯出完整版/摘要版）
```

## 重要文件（你要找什麼就看這裡）
- 新手入口：`docs/README.md`
- 系統怎麼跑起來：`docs/how-it-works.md`
- TS/Next/Nest 入門：`docs/typescript-nextjs-nestjs-primer.md`
- 設計取捨與擴充：`docs/design-rationale.md`
- ER Diagram（資料模型全貌）：`docs/er-diagram.md`
- 開發用「真相來源」：`MVP-SPEC.md`、`USER-STORIES.md`、`API-DRAFT.md`、`DATA-DICTIONARY.md`、`db/schema.sql`
- MARC21 ↔ Controlled Vocabulary 對應規則（term_id / $0 / $2）：`docs/marc21-controlled-vocab-mapping.md`
- MARC21 字典 SSOT + authority 即時新增：`docs/implementation/0043-marc21-ssot-and-authority-quick-create.md`
- 進階搜尋（欄位多選 + AND/OR/NOT）+ 藍白 UI：`docs/implementation/0044-advanced-search-and-ui-blue-theme.md`
- 實作說明（每次實作都會補）：`docs/implementation/0001-api-foundation-and-core-master-data.md`
- Authority Control 主控入口 + shared MARC↔vocab 規則：`docs/implementation/0035-authority-control-home-and-shared-marc-mapping.md`
- Bibs 檢索 term_id filters（chips + 多選 + expand）：`docs/implementation/0036-bibs-term-id-filters-chips-and-expand.md`
- Web Console 實作說明：`docs/implementation/0004-web-console-and-api-integration.md`
- Loans/Renew 實作說明：`docs/implementation/0005-loans-and-renew.md`
- Holds/OPAC 實作說明：`docs/implementation/0006-holds-and-opac.md`
- Overdue Report/CSV 實作說明：`docs/implementation/0007-overdue-report-and-csv.md`
- Audit Events 實作說明：`docs/implementation/0008-audit-events-query.md`
- Item Exceptions（lost/repair/withdrawn）實作說明：`docs/implementation/0009-item-exceptions-and-audit.md`
- Users CSV Import（名冊匯入）實作說明：`docs/implementation/0010-users-csv-import.md`
- Users 查詢/停用（US-011）實作說明：`docs/implementation/0011-users-query-filter-and-update.md`
- Reports（US-050 熱門書/借閱量）實作說明：`docs/implementation/0012-us-050-reports-top-circulation-and-summary.md`
- Holds 到期處理（ready_until → expired）實作說明：`docs/implementation/0013-holds-expiry-and-maintenance.md`
- 取書架清單（Ready Holds）實作說明：`docs/implementation/0014-ready-holds-report-and-print-slips.md`
- 櫃台取書借出掃碼（Circulation fulfill）實作說明：`docs/implementation/0015-circulation-fulfill-scan-workstation.md`
- US-051 零借閱清單（Zero Circulation）實作說明：`docs/implementation/0016-us-051-zero-circulation-report.md`
- US-061 借閱歷史保存期限（Retention）實作說明：`docs/implementation/0017-us-061-loan-history-retention.md`
- Staff Auth / 權限收斂（Bearer token + actor_user_id 對齊）實作說明：`docs/implementation/0018-staff-auth-and-rbac.md`
- 盤點（Inventory）工作台實作說明：`docs/implementation/0019-inventory-workbench.md`
- 逾期停權（Policy enforcement）實作說明：`docs/implementation/0020-policy-overdue-block.md`
- US-022 書目/冊 CSV 匯入實作說明：`docs/implementation/0021-us-022-catalog-csv-import.md`
- OPAC Account（讀者登入 + 我的借閱/我的預約）實作說明：`docs/implementation/0022-opac-account.md`
- Demo organization + 假資料（seed）+ 導覽入口：`docs/implementation/0023-demo-seed-and-navigation.md`
- Demo smoke（E2E-ish）+ 一鍵 reset/seed + 最小 CI：`docs/implementation/0024-demo-smoke-and-ci.md`
- Scale seed（大量假資料；UI 完整性驗證用）：`docs/implementation/0025-scale-seed.md`
- Locations/Policies 治理 + Cursor Pagination + Item detail：`docs/implementation/0026-locations-policies-pagination-and-item-detail.md`
- 補齊缺口 + /me cursor + Maintenance runner：`docs/implementation/0027-bootstrap-ui-users-edit-me-cursor-and-maintenance-runner.md`
- Playwright E2E（真瀏覽器 UI 自動化）：`docs/testing/playwright-e2e.md`
- SSH + Docker Compose 部署：`docs/deployment/ssh-docker-compose.md`
- 註解與教學文件規範：`docs/commenting-guidelines.md`

## 本機開發（從 0 到跑起來）
前置需求：
- Node.js 20+、npm
- Docker Desktop（跑 PostgreSQL/Redis）

### 1) 啟動資料庫
```bash
docker compose up -d postgres redis
```

### 2) 安裝依賴
```bash
npm install
```

### 3) 匯入資料庫 schema（草案）
PowerShell（Windows）範例：
```powershell
Get-Content db\\schema.sql | docker compose exec -T postgres psql -U library -d library_system
```

### 3.5) （可選）匯入 demo 假資料（讓你立刻測所有面板）
```bash
docker compose exec -T postgres psql -U library -d library_system -f db/seed-demo.sql
```

你也可以用一鍵腳本（會自動 up DB + 匯入 schema + 匯入 seed）：
```bash
npm run demo:db:seed
```

### 3.8) 設定環境變數（.env）
API 需要 `DATABASE_URL` 才能連到 PostgreSQL。第一次跑起來請先把 `.env.example` 複製成 `.env`：

```bash
cp .env.example .env
```

（Windows PowerShell：`Copy-Item .env.example .env`）

### 4) 啟動開發伺服器（同時跑 web + api）
```bash
npm run dev
```

檢查：
- Web：`http://localhost:3000`（Console：`/orgs`）
- API：`http://localhost:3001/health`

若你看到 `listen EADDRINUSE 0.0.0.0:3001`（3001 被佔用），有兩種解法擇一：
- 停掉佔用 3001 的程序（常見是你先前跑過的 API 或 `docker compose` 的 api container）
- 或改 port：把 `.env` 的 `API_PORT` 改成 `3002`，並同步把 `NEXT_PUBLIC_API_BASE_URL` 改成 `http://localhost:3002`，再重啟 `npm run dev`

## Docker 跑整套（DB + API + Web + demo seed + smoke）
如果你希望「前後端也都在 Docker 內」跑起來（更接近部署形態），可以用這組指令：

### 1) 啟動整套服務（會 build image）
```bash
npm run docker:up
```

若遇到 port 衝突（常見：`6379`/`5432`/`3000`/`3001` 已被佔用），可用環境變數改 host port：
```bash
REDIS_PORT=6380 POSTGRES_PORT=55432 API_HOST_PORT=3002 WEB_HOST_PORT=3003 npm run docker:up
```

### 2) 匯入 demo 假資料（可重複執行）
```bash
npm run docker:seed
```

### 2.5) （可選）匯入「大量假資料」（Scale seed；用於 UI 完整性驗證）
這會另外建立/重建一個 org（預設 `demo-lms-scale`），並灌入大量 users/bibs/items/loans/holds/inventory/audit，
用來把前端列表/搜尋/報表/盤點等頁面「跑滿」。

```bash
npm run docker:seed:scale
```

快速一鍵（up + scale seed）：
```bash
npm run docker:scale
```

登入帳號（共用密碼 `demo1234`）：
- Staff：admin `A0001` / librarian `L0001`
- OPAC：teacher `T0001` / student `S1130123`

> 安全提醒：demo 密碼只供本機/測試。若站點對外（staging/prod），請立刻改密碼並設定強 `AUTH_TOKEN_SECRET`。

### 3) 端到端 smoke（在 Docker 內跑）
```bash
npm run docker:smoke
```

### 3.2) （可選）例行維運（Maintenance runner）
把「每日例行作業」做成可自動化的 runner（在 Docker network 內打 API）：
```bash
npm run docker:maintenance
```

預設行為（可用 `.env` 的 `MAINTENANCE_*` 覆蓋；見 `.env.example`）：
- `holds/expire-ready`：預設 `mode=apply`
- `loans/purge-history`：預設 `mode=preview`（不可逆刪除；要 `apply` 請明確設定）

一鍵跑完（清空 DB volume → up → seed → smoke）：
```bash
npm run docker:test
```

關閉服務：
```bash
npm run docker:down
```

要連同 DB volume 一起清空（資料會刪掉）：
```bash
npm run docker:down:volumes
```

## 自動化測試（Playwright）
- 一鍵 QA（build/up + scale seed + Playwright + summary）：`npm run qa:e2e`
- 只跑 Playwright：`npm run e2e`
- 開啟報表：`npm run e2e:report`

## 正式環境（migrations）
正式環境（上線/擴校）建議用 `db/migrations/*` + `schema_migrations`（而不是直接套用 `db/schema.sql`）。

執行：
```bash
npm run db:migrate
```

## 部署（SSH + Docker Compose）
- 指南：`docs/deployment/ssh-docker-compose.md`
- 反向代理建議：同一個 domain 下把 `/` 轉到 Web（3000）、把 `/api/v1/*` 與 `/health` 轉到 API（3001）

## 如何把文件變成程式（建議工作流）
1. 從 `USER-STORIES.md` 選一個故事（例如 US-040 借出）。
2. 對照 `API-DRAFT.md` 補齊 request/response 與錯誤碼。
3. 對照 `DATA-DICTIONARY.md` / `db/schema.sql` 確認欄位與 constraint（例如條碼唯一、同冊僅一筆未歸還借閱）。
4. 實作 API（Controller → Service → DB transaction）後，再實作 Web。
5. 每次改動同步更新 `docs/`（原因/取捨/擴充影響）。

## 參與貢獻（文件與程式）
- 參考 `AGENTS.md`（撰寫規範、命名、開發指令、文件同步原則）。
- `docs/reference-docs/` 內的「匯出完整版」可能含個資（如 `**User:**` 行）；若要公開倉庫，請先遮罩/移除。
