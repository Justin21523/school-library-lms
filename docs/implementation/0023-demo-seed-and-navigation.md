# 實作說明 0023：Demo organization + 假資料（seed）+ 前端入口（導航）

本文件的目的，是讓你在本機開發時「不用手動建一堆資料」就能立刻驗證我們已完成的所有面板（Web Console / OPAC / Reports / Maintenance / Audit）：
- 用 `db/seed-demo.sql` 建立 **1 個 demo organization** 與一整套關聯資料
- 補齊 Web Console 的導覽入口（側邊欄 + Dashboard 快速入口），確保每個面板都「點得到」
- 提供兩份可直接上傳的 CSV 樣本，方便測試匯入流程（US-010 / US-022）

> 重要：這些資料是「示範用」，包含可登入的 demo 密碼；請勿用在正式環境。

---

## 1) 為什麼需要 demo seed？

當功能逐步落地後（loans/holds/reports/inventory/audit/auth…），你會遇到一個現實問題：
- **沒有資料，就很難測 UI**（你得先建 org → locations → users → bibs → items → 再做借還/預約…）
- **沒有入口，就很難 demo**（功能藏在 URL，別人不知道去哪裡看）

因此這一輪把「可測」當成 MVP 的一部分：
1) 提供一個可重複執行的 seed（可快速建立可見資料）  
2) 把所有面板集中在 Web Console 的側邊欄與 Dashboard 快速入口  

---

## 2) 如何在本機建立 demo 資料（schema + seed）

前置：你需要 Docker Desktop（跑 PostgreSQL/Redis）。

### 2.1 啟動資料庫
```bash
docker compose up -d postgres redis
```

### 2.2 匯入 schema（第一次或你重置 DB 後）
```bash
docker compose exec -T postgres psql -U library -d library_system -f db/schema.sql
```

### 2.3 匯入 demo seed（建立 demo org + 假資料）
```bash
docker compose exec -T postgres psql -U library -d library_system -f db/seed-demo.sql
```

若你在 Windows / PowerShell：
```powershell
docker compose exec -T postgres psql -U library -d library_system -f db\schema.sql
docker compose exec -T postgres psql -U library -d library_system -f db\seed-demo.sql
```

> 若你之前已啟動過 postgres 且用 volume 保留資料：同一份 seed 可重複執行（idempotent），不會一直插重複列。

---

## 3) demo organization 與登入帳號（可直接用）

seed 會建立（或沿用）一個 organization：
- `organizations.code = demo-lms-seed`
- `organizations.name = 示範國小（Demo School）`

所有 demo 帳號共用密碼（方便測試）：
- 密碼：`demo1234`

### 3.1 Staff（Web Console / 後台）
- Admin：`A0001`
- Librarian：`L0001`

### 3.2 Patron（OPAC / 讀者端）
- Teacher：`T0001`
- Student（正常）：`S1130123`
- Student（逾期停權示範）：`S1130999`

---

## 4) seed 內容一覽：你可以用它測什麼

### 4.1 Loans / Renew（成功案例 + 停權案例）
- **可續借成功**：有一筆 open loan（不逾期），可在 Web Console → Loans 點「Renew」
  - item barcode：`DEMO-REN-0001`
- **逾期停權**：`S1130999` 有一筆逾期 open loan
  - item barcode：`DEMO-HP-0002`
  - 用途：測 Overdue Report + 借閱限制（checkout/renew/hold/fulfill 會被擋）

### 4.2 Holds / Ready Holds / Fulfill
- **ready hold（未過期）**：可測「取書架清單」與「Fulfill（掃冊條碼）」
  - item barcode：`DEMO-LP-0001`
- **ready hold（已過期）**：可測 Holds Maintenance 的 expire-ready preview/apply
  - item barcode：`DEMO-EXP-0001`

### 4.3 Inventory（盤點工作台 + 差異清單）
- 有一個已結束的 inventory session + 幾筆 scans  
  - 用途：讓 inventory diff 立刻看得到 missing/unexpected

### 4.4 Item exceptions（lost/repair/withdrawn）
- seed 直接放了多種 item status：
  - `lost`：`DEMO-LOST-0001`
  - `repair`：`DEMO-REP-0001`
  - `withdrawn`：`DEMO-WD-0001`

### 4.5 Reports（CSV）
seed 內建了：
- Overdue Report（由逾期 open loan 產生）
- Ready Holds Report（由 ready holds 產生）
- Top Circulation / Circulation Summary（由幾筆歷史 loans 產生）
- Zero Circulation（由「有 item 但刻意不建 loans」的書目產生）

---

## 5) Web Console：各面板入口在哪裡？

### 5.1 入口 1：從 `/orgs` 進入 demo org
1) 開啟 Web：`http://localhost:3000`
2) 進 Web Console：`/orgs`
3) 點選 `示範國小（Demo School）`

### 5.2 入口 2：Organization Dashboard 的「快速入口」
進入 `/orgs/:orgId` 後，你會看到：
- 快速入口（Web Console）
- 快速入口（Reports / Maintenance / Audit）
- 快速入口（OPAC / 讀者端）

### 5.3 入口 3：左側導覽（側邊欄）
在任何 `/orgs/:orgId/*` 子頁面，左側都有完整導覽（含 Users/Bibs/Items/Loans/Holds/Reports/Inventory/Audit…）。

---

## 6) 匯入流程測試：直接用我們附的 CSV 樣本

### 6.1 Users CSV Import（US-010）
樣本檔：`docs/samples/users-demo.csv`

操作建議：
1) 用 `L0001`（librarian）登入 Web Console
2) 進入：`/orgs/:orgId/users/import`
3) 先跑 `preview`（檢查 errors / summary）
4) 再跑 `apply`（會寫入 users + audit_events）

### 6.2 Catalog CSV Import（US-022）
樣本檔：`docs/samples/catalog-demo.csv`

操作建議：
1) 進入：`/orgs/:orgId/bibs/import`
2) 先 `preview`，確認 location_code（MAIN/BRANCH）能對上
3) 再 `apply`，匯入後可到 Bibs/Items 立即看到新增資料

---

## 7) 實作細節（你可以從程式學到的設計）

### 7.1 seed 為什麼用「org.code 定位」而不是寫死 orgId？
因為 `organizations.id` 是 DB 產生 UUID；如果寫死 id，你必須先確定 DB 沒資料、且每次都從乾淨狀態開始。

seed 的做法是：
- 先用 code 找 org
- 找不到才 insert

（節錄）`db/seed-demo.sql`：
```sql
SELECT id INTO v_org_id
FROM organizations
WHERE code = v_org_code;

IF v_org_id IS NULL THEN
  INSERT INTO organizations (name, code)
  VALUES (v_org_name, v_org_code)
  RETURNING id INTO v_org_id;
END IF;
```

### 7.2 前端入口為什麼要「側邊欄 + Dashboard 快速入口」兩層？
因為 demo/驗證時，最痛的是「找不到在哪」：
- 側邊欄：提供完整、可預期的資訊架構（IA）
- Dashboard 快速入口：把最常用/最常驗的面板集中，減少點擊成本

（節錄）`apps/web/app/orgs/[orgId]/layout.tsx`：
```ts
<Link href={`/orgs/${orgId}/reports/overdue`}>Overdue Report</Link>
<Link href={`/orgs/${orgId}/reports/top-circulation`}>Top Circulation</Link>
<Link href={`/orgs/${orgId}/audit-events`}>Audit Events</Link>
```

---

## 8) 常見問題（Troubleshooting）

### 8.1 我跑了 seed，但 `/orgs` 看不到示範國小？
請確認：
1) 你 seed 的 DB 與 API 連到的是同一個（同一個 docker compose）
2) API 已啟動：`npm run dev:api`
3) schema 有匯入成功（`db/schema.sql`）

### 8.2 我想重置成乾淨的 demo 環境
最直接的方式是清掉 docker volume（會刪 DB 資料）：
```bash
docker compose down -v
docker compose up -d postgres redis
docker compose exec -T postgres psql -U library -d library_system -f db/schema.sql
docker compose exec -T postgres psql -U library -d library_system -f db/seed-demo.sql
```

