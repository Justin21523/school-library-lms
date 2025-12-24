# 中小學雲端圖書館系統（Library System）

**繁體中文** | [English](README.en.md)

本專案目標是打造一套適合台灣中小學、在**人力不足**與**預算有限**情境下可快速導入的雲端圖書館管理系統（LMS）。此倉庫同時包含：
- **領域知識與參考資料**（A–J 章：編目、分類、主題分析、Metadata、檢索、館藏管理、流通、使用者、資訊行為、倫理政策）
- **可直接落地的 MVP 規格**（user stories、API 草案、資料字典、DB schema）
- **可跑起來的程式骨架**（TypeScript monorepo：NestJS API + Next.js Web）

> 如果你不熟 TypeScript/Next.js/NestJS，先從 `docs/README.md` 開始讀。

## 專案現況（目前做到了哪裡）
- 文件已整理成「可開發」：`MVP-SPEC.md`、`USER-STORIES.md`、`API-DRAFT.md`、`DATA-DICTIONARY.md`、`db/schema.sql`
- 程式已能端到端操作（MVP 版本）：`apps/api` 已落地主檔/使用者名冊匯入（CSV）/書目/冊/借還/續借/借閱查詢/預約（holds）/預約到期處理（holds expire-ready maintenance）/取書架清單（ready holds report + CSV/列印）/逾期報表（overdue report）/熱門書與借閱量報表（US-050）/稽核查詢（audit events）/冊異常狀態（lost/repair/withdrawn）API（另有 `/health`），`apps/web` 已提供 Web Console（`/orgs`）並逐步補齊 OPAC
- 架構決策已記錄（含擴充路線）：`ARCHITECTURE.md`、`docs/design-rationale.md`

## MVP 功能範圍（你可以期待什麼）
以「能在學校現場真的用起來」為目標，MVP 先把核心流程做對：
- 使用者名冊匯入（CSV）：學生/教師、班級、停用（畢業/離校）
- 書目（Bibliographic）與冊（Item/Copy）管理：多冊、條碼、索書號、位置、狀態
- 檢索（OPAC）：關鍵字 + 欄位查詢（書名/作者/ISBN/主題）與基本容錯
- 流通：借出、歸還、續借、預約、逾期清單（以停權/提醒取代罰款）
- 報表（CSV）：熱門書、借閱量、逾期清單（先做可匯出，避免被系統鎖死）
- 稽核：借還/匯入/狀態異動的 audit events（可追溯）

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
│  ├─ schema.sql    # PostgreSQL schema 草案
│  └─ README.md     # DB 說明
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
- 實作說明（每次實作都會補）：`docs/implementation/0001-api-foundation-and-core-master-data.md`
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

### 4) 啟動開發伺服器（同時跑 web + api）
```bash
npm run dev
```

檢查：
- Web：`http://localhost:3000`（Console：`/orgs`）
- API：`http://localhost:3001/health`

## 如何把文件變成程式（建議工作流）
1. 從 `USER-STORIES.md` 選一個故事（例如 US-040 借出）。
2. 對照 `API-DRAFT.md` 補齊 request/response 與錯誤碼。
3. 對照 `DATA-DICTIONARY.md` / `db/schema.sql` 確認欄位與 constraint（例如條碼唯一、同冊僅一筆未歸還借閱）。
4. 實作 API（Controller → Service → DB transaction）後，再實作 Web。
5. 每次改動同步更新 `docs/`（原因/取捨/擴充影響）。

## 參與貢獻（文件與程式）
- 參考 `AGENTS.md`（撰寫規範、命名、開發指令、文件同步原則）。
- `docs/reference-docs/` 內的「匯出完整版」可能含個資（如 `**User:**` 行）；若要公開倉庫，請先遮罩/移除。
