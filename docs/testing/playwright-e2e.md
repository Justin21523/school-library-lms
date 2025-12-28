# Playwright E2E（真瀏覽器 UI 自動化）

本文件說明本 repo 的 UI 自動化測試（Playwright）如何運作、如何執行、以及產出物怎麼用來改善功能與體驗。

## 目標（你會得到什麼）
- 用真瀏覽器跑過 Web Console / OPAC 的主要 routes（不是只打 API）
- 在「Docker + Scale seed（大量假資料）」下做 UI 完整性檢查
- 產出可追溯紀錄：
  - `playwright-report/index.html`（HTML 報告）
  - `test-results/playwright/report.json`（機器可讀）
  - `test-results/playwright/qa-summary.md`（人眼可掃描）
  - 失敗時的 trace / screenshot / logs（在 report 中可點開）

## 一鍵執行（推薦）
```bash
npm run qa:e2e
```

這會依序：
1) `docker compose up -d --build postgres redis api web`
2) `docker compose --profile scale run --rm seed-scale`
3) `docker compose --profile e2e run --rm e2e`
4) `node scripts/qa-summarize-playwright.mjs`

## 只跑 E2E（假設你已經準備好資料）
```bash
npm run docker:e2e
```

## 重要概念：docker network 內的 localhost 問題
目前 Web 的 API base 是 `NEXT_PUBLIC_API_BASE_URL`（預設 `http://localhost:3001`），這在「host 瀏覽器操作 docker compose」時是正確的（走 port mapping）。

但 Playwright 若也跑在 docker network 內，瀏覽器的 `localhost:3001` 會指向 Playwright 容器本身，因此會打不到 API。

本 repo 的解法是測試端做 request rewrite：
- 由 `E2E_API_PROXY_TARGET` 控制（在 compose e2e service 內預設設為 `http://api:3001`）
- Playwright 會把瀏覽器發出的 `http://localhost:3001/*` 重寫到 `E2E_API_PROXY_TARGET`

## 覆蓋範圍（目前）
### Web Console（Staff）
- `/orgs`（org 列表）
- `/orgs/:orgId`（Dashboard）
- `/orgs/:orgId/login`（由 global-setup 建 session）
- `/orgs/:orgId/users` / `bibs` / `items` / `loans` / `holds`
- 報表：`reports/overdue` / `ready-holds` / `top-circulation` / `circulation-summary` / `zero-circulation`
- `inventory` / `audit-events`

### OPAC（Patron）
- `/opac/orgs/:orgId/login`（由 global-setup 建 session）
- `/opac/orgs/:orgId`（搜尋 + 取書地點）
- `/opac/orgs/:orgId/loans` / `holds`（/me/*）

## 產出物怎麼用（改善流程）
- 先看 `test-results/playwright/qa-summary.md`：快速知道哪一頁壞、耗時是否異常
  - 目前 `qa-summary.md` 也會附上 diagnostics 摘要（console/page/request failures 統計與 Top 分組），用來更快定位「體驗不佳」或「未來會變成 flaky」的徵兆
- 再打開 `playwright-report/index.html`：看失敗那筆的 trace / screenshot / console errors
- 若看到：
  - `page-errors.txt`：代表前端有未捕捉的 runtime error（優先修）
  - `request-failures.txt`：多半是 API 打不到 / CORS / 網路 DNS 問題（先查環境/URL）
  - `console-errors.txt`：通常代表 UI 有潛在問題或錯誤處理不足（可視嚴重性決定是否要讓測試 fail）

補充：若 diagnostics 裡 request failures 主要是 `net::ERR_ABORTED`，通常是 Next.js 頁面切換/預抓被取消造成，未必是 bug；但若出現 `ERR_CONNECTION_REFUSED`、`ERR_NAME_NOT_RESOLVED`、`Failed to fetch` 等，就應優先排查 API base / Docker network / proxy rewrite 設定。

## 常見調整
- 想改測試目標 org：改 `.env` 的 `E2E_ORG_CODE`
- 想改登入帳密：改 `.env` 的 `E2E_*_EXTERNAL_ID / E2E_*_PASSWORD`
- 想擴充覆蓋：新增 `tests/e2e/*.spec.ts`
