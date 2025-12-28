# 中小學雲端圖書館系統（Library System）

**繁體中文** | [English](README.en.md)

本專案目標是打造一套適合台灣中小學、在**人力不足**與**預算有限**情境下可快速導入的雲端圖書館管理系統（LMS）。此倉庫同時包含：
- **領域知識與參考資料**（A–J 章：編目、分類、主題分析、Metadata、檢索、館藏管理、流通、使用者、資訊行為、倫理政策）
- **可直接落地的 MVP 規格**（user stories、API 草案、資料字典、DB schema）
- **可跑起來的程式骨架**（TypeScript monorepo：NestJS API + Next.js Web）

> 如果你不熟 TypeScript/Next.js/NestJS，先從 `docs/README.md` 開始讀。

## 專案現況（目前做到了哪裡）
- 文件已整理成「可開發」：`MVP-SPEC.md`、`USER-STORIES.md`、`API-DRAFT.md`、`DATA-DICTIONARY.md`、`db/schema.sql`
- 程式已能端到端操作（MVP 版本）：`apps/api` 已落地主檔/使用者名冊匯入（CSV）/書目/冊/書目冊匯入（US-022）/借還/續借/借閱查詢/預約（holds）/預約到期處理（holds expire-ready maintenance）/取書架清單（ready holds report + CSV/列印）/逾期報表（overdue report）/熱門書與借閱量報表（US-050）/稽核查詢（audit events）/冊異常狀態（lost/repair/withdrawn）/盤點（Inventory sessions + 差異清單 + CSV）/逾期停權（policy enforcement）/Staff Auth（館員登入）+ Patron Auth（OPAC 登入）API（另有 `/health`），`apps/web` 已提供 Web Console（`/orgs`）與 OPAC（`/opac`）
- 架構決策已記錄（含擴充路線）：`ARCHITECTURE.md`、`docs/design-rationale.md`

## MVP 功能範圍（你可以期待什麼）
以「能在學校現場真的用起來」為目標，MVP 先把核心流程做對：
- 使用者名冊匯入（CSV）：學生/教師、班級、停用（畢業/離校）
- 書目（Bibliographic）與冊（Item/Copy）管理：多冊、條碼、索書號、位置、狀態
- 檢索（OPAC）：關鍵字 + 欄位查詢（書名/作者/ISBN/主題）與基本容錯
- 流通：借出、歸還、續借、預約、逾期清單（以停權/提醒取代罰款）
- 盤點：盤點 session + 掃碼工作台 + 差異清單（missing/unexpected）+ CSV
- 報表（CSV）：熱門書、借閱量、逾期清單（先做可匯出，避免被系統鎖死）
- 稽核：借還/匯入/狀態異動的 audit events（可追溯）
- OPAC Account：讀者登入（student/teacher）+ 我的借閱/我的預約（/me）

MVP 預設政策已定案（可調）：請見 `MVP-SPEC.md`。

## 技術選型（為什麼這樣選，與未來怎麼擴充）
這裡的核心策略是「**模組化單體（Modular Monolith）**」：先用最少的部署/維運成本把系統做出來，但保留清楚邊界，未來需要時再拆分。

- 語言：TypeScript（前後端共用型別，降低契約不一致）
- 後端：NestJS（模組化、DI、可測試、適合逐步擴充）
- 前端：Next.js（可做管理後台 + OPAC，也適合 PWA/行動裝置）
- DB：PostgreSQL（交易一致性、constraint、可做 FTS；未來可擴到搜尋引擎）

完整理由與替代方案取捨：`docs/design-rationale.md`、`ARCHITECTURE.md`。

## 倉庫結構
```
.
├─ apps/
│  ├─ api/          # NestJS API（org/location/user/policy/bib/item/circulation）
│  └─ web/          # Next.js Web Console（/orgs）
├─ packages/
│  └─ shared/       # 共用型別/工具（預留）
├─ db/
│  ├─ schema.sql       # PostgreSQL schema 草案
│  ├─ seed-demo.sql    # 本機 demo 假資料（可重複執行）
│  └─ README.md        # DB 說明
└─ docs/            # 新手友善：運作方式、入門、設計取捨
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

## 如何把文件變成程式（建議工作流）
1. 從 `USER-STORIES.md` 選一個故事（例如 US-040 借出）。
2. 對照 `API-DRAFT.md` 補齊 request/response 與錯誤碼。
3. 對照 `DATA-DICTIONARY.md` / `db/schema.sql` 確認欄位與 constraint（例如條碼唯一、同冊僅一筆未歸還借閱）。
4. 實作 API（Controller → Service → DB transaction）後，再實作 Web。
5. 每次改動同步更新 `docs/`（原因/取捨/擴充影響）。

## 參與貢獻（文件與程式）
- 參考 `AGENTS.md`（撰寫規範、命名、開發指令、文件同步原則）。
- `docs/reference-docs/` 內的「匯出完整版」可能含個資（如 `**User:**` 行）；若要公開倉庫，請先遮罩/移除。
