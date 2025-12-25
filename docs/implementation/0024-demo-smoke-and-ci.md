# 實作說明 0024：Demo smoke（E2E-ish）+ 一鍵 reset/seed + 最小 CI

本文件說明本輪新增的「可重現 demo / 自動化驗證」基礎設施，讓你可以：
- 一鍵把 demo 資料灌回到可預期狀態（避免 DB 被玩壞後很難回來）
- 自動跑一輪核心流程的 smoke（登入 / reports CSV / inventory diff / audit / OPAC account）
- 在 CI 先跑 `tsc` + smoke，避免回歸

> 重要：這些腳本是「開發/示範」用途，會使用 demo seed（含示範密碼），請勿指向正式環境。

---

## 1) 我們在解決什麼問題？

當專案功能逐步長出來後（loans/holds/reports/inventory/audit/auth…），最常見的痛點是：
1) **缺資料**：UI 頁面看起來像壞掉，其實只是沒有能顯示的資料。
2) **不可重現**：今天測得過，明天 DB 被測試操作改掉，就回不來。
3) **沒有自動驗證**：小改動一不小心就把 CSV/BOM、RBAC、或某個 report query 弄壞。

所以這一輪把「可測」當成 MVP 的一部分：
- `demo-db`：一鍵 reset/seed（重現資料）
- `demo-smoke`：E2E-ish 驗證（重現行為）
- CI：每次 push/PR 都跑一次（避免回歸）

---

## 2) 一鍵 reset/seed：`scripts/demo-db.mjs`

檔案：`scripts/demo-db.mjs`

它做的事（依序）：
1) `docker compose up -d postgres redis`（確保 DB 起來）
2) 等 Postgres ready（container 內跑 `pg_isready`）
3) 匯入 schema：`db/schema.sql`
4) 匯入 demo seed：`db/seed-demo.sql`

### 2.1 `seed` vs `reset`
- `seed`：不清空 volume，只做「up + 匯入 schema + 匯入 seed」
- `reset`：會先 `docker compose down -v` 清空 postgres volume，再重新匯入（回到乾淨狀態）

### 2.2 使用方式（建議用 npm scripts）
```bash
# 不清空，只確保有 schema + demo data
npm run demo:db:seed

# 清空重建（會刪 DB 資料）
npm run demo:db:reset
```

---

## 3) Demo smoke（E2E-ish）：`scripts/demo-smoke.mjs`

檔案：`scripts/demo-smoke.mjs`

它的設計取捨：
- 不引入 Playwright（不加新依賴）
- 改用「HTTP 層」驗證：後端回傳資料正確 → 前端頁面就能顯示/下載

### 3.1 預設行為（`npm run demo:smoke`）
1) DB：跑 `seed`（透過 `scripts/demo-db.mjs`）
2) 啟動 API（dev mode，注入 `DATABASE_URL`）
3) 啟動 Web（Next dev）
4) 透過 HTTP 驗證：
   - `/health`
   - 找到 demo org（用 `org.code=demo-lms-seed`）
   - staff login / patron login（demo1234）
   - open loans（含逾期 + 可續借）與 renew 成功
   - reports（overdue/ready-holds/top-circulation/circulation-summary/zero-circulation/inventory-diff）
     - 同時檢查 CSV 有 UTF-8 BOM（Excel 友善）
   - audit-events 有資料
   - `/me/*`（OPAC account）能取回本人 loans/holds
   - Web routes 基本可渲染（/orgs、/reports/overdue、/audit-events）

### 3.2 常見用法（只跑 API smoke，CI 也用這個）
```bash
node scripts/demo-smoke.mjs --web=skip
```

### 3.3 只跑 smoke（你已經手動啟動好 DB/API/Web）
```bash
node scripts/demo-smoke.mjs --db=skip --api=skip --web=skip
```

> 注意：`demo-smoke` 需要能打到 `http://localhost:3001`，所以你必須先讓 API 起來或讓腳本幫你起來。

---

## 4) 最小 CI：`.github/workflows/ci.yml`

我們加入了最小 CI（GitHub Actions）：
- 先跑 `tsc`（API + Web）
- 再跑 `demo-smoke`（只驗證 API + DB，不跑 Web）

檔案：`.github/workflows/ci.yml`

為什麼 CI 不跑 Web？
- smoke 的「資料正確性」與「CSV 匯出」主要靠 API 驗證
- Next dev 會多花時間且容易受環境影響
- 我們先把 CI 做到「穩定可回歸」，再逐步擴充到真正瀏覽器 E2E（若你需要）

---

## 5) 與既有文件/seed 的關係

- Demo 資料的內容與帳密請看：`docs/implementation/0023-demo-seed-and-navigation.md`
- demo seed 檔案：`db/seed-demo.sql`
- 一鍵匯入 schema/seed 的指令也同步更新在：`db/README.md`

