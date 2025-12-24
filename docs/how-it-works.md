# 系統怎麼運作（從 0 到跑起來）

本文件用「新手視角」解釋這個倉庫的程式骨架如何運作，以及你接下來要怎麼把 `MVP-SPEC.md` 變成真正可用的系統。

## 1) 先講整體：三個主要部分
- **Web（前端）**：`apps/web/`（Next.js）  
  你在瀏覽器看到的管理後台與館藏查詢頁（OPAC）。
- **API（後端）**：`apps/api/`（NestJS）  
  提供 REST API 給前端呼叫，負責權限、規則、借還流程、寫入資料庫。
- **Database（資料庫）**：PostgreSQL（`docker-compose.yml`、`db/schema.sql`）  
  存放使用者、書目、冊、借閱、預約、政策、稽核等資料。

典型資料流：  
瀏覽器（Web）→ 呼叫 API → API 讀寫 PostgreSQL → 回傳結果 → Web 顯示。

## 2) 為什麼要用「Monorepo（單一倉庫多專案）」？
此倉庫用 npm workspaces，把多個子專案放在同一個 repo：
- `apps/api`（後端）
- `apps/web`（前端）
- `packages/shared`（共用型別/工具）

好處：
- **共用型別**：前後端都用 TypeScript，能共享資料結構（例如 `UserId`、`LoanId`），減少「前後端對欄位理解不一致」。
- **同步演進**：改 API 的同時就能改 Web；改資料結構也能同步更新文件與程式。
- **更好拆工**：雖然在同一 repo，仍可以用模組邊界（`catalog/circulation/...`）分工。

## 3) 目錄快速導覽（你應該知道的）
- `ARCHITECTURE.md`：技術選型與可擴充架構原則（為什麼選 TypeScript/Nest/Next/Postgres）。
- `MVP-SPEC.md`：MVP 需求、角色、流程、預設政策（我們已先定一版）。
- `USER-STORIES.md`：把需求拆成可實作的故事與驗收條件（方便排程與拆票）。
- `API-DRAFT.md`：API 端點草案（先對齊契約，再開始寫程式）。
- `DATA-DICTIONARY.md`：資料表/欄位定義（MVP 的「真相來源」之一）。
- `db/schema.sql`：PostgreSQL schema 草案（含 index/constraint 思路）。

## 4) 本機跑起來（最小步驟）
前置需求：
- Node.js 20+（執行 Web/API）
- Docker Desktop（跑 PostgreSQL/Redis）

步驟（在倉庫根目錄）：
1. 啟動資料庫  
   `docker compose up -d postgres redis`
2. 安裝依賴（第一次一定要做）  
   `npm install`
3. 啟動開發伺服器（同時跑 web 與 api）  
   `npm run dev`

你應該會看到：
- Web：`http://localhost:3000`（Console：`/orgs`）
- API 健康檢查：`http://localhost:3001/health` 回 `{ ok: true }`

> 目前已落地主檔/書目/冊/借還等核心 API，Web 也有最小可操作的 Console；後續功能仍建議依 `USER-STORIES.md` 逐步擴充。

## 5) 一個請求在後端發生了什麼（NestJS 觀念）
以 `GET /health` 為例：
1. 瀏覽器或前端發送 HTTP request。
2. NestJS 由 **Controller**（控制器）接到路由（`HealthController`）。
3. Controller 回傳資料（JSON），NestJS 幫你序列化成 HTTP response。

後續加功能時，你會用到：
- **Module**：把「一組相關功能」包成一個單位（例如 circulation 模組）。
- **Provider/Service**：放商業邏輯（例如「借出」要檢查狀態、政策、預約）。
- **DI（Dependency Injection）**：讓 Service 彼此以「注入」方式協作，減少耦合。

## 6) 為什麼 API 要用「動作端點」而不是直接 PATCH 狀態？
你會在 `API-DRAFT.md` 看到：
- 借出：`POST /circulation/checkout`
- 歸還：`POST /circulation/checkin`

原因：
- 借還不是單純改一個欄位，通常同時要改：
  - `loans`（新增/關閉借閱）
  - `item_copies.status`（available ↔ checked_out ↔ on_hold）
  - `holds`（可能要把下一位預約者改成 ready）
  - `audit_events`（稽核）
- 用「動作」能把流程集中在一個地方處理，避免前端或其他系統誤用 API 造成資料不一致。

## 7) Git 在這個專案的角色（你不用怕）
Git 是版本控制工具，會把每次改動記錄成可追溯的歷史。
- `git status`：看目前有哪些檔案改了
- `git add <file>`：把改動加入「準備提交」區
- `git commit -m "..."`：建立一個版本節點（commit）

你可以把它想成「可以回到任何時間點」的存檔系統；越早養成「小步提交」習慣，越不怕改壞。

## 8) 你下一步應該怎麼做（建議流程）
當你要實作一個功能（例如借出）：
1. 先從 `USER-STORIES.md` 找對應故事（如 US-040）。
2. 對照 `API-DRAFT.md` 補齊 request/response 欄位與錯誤碼。
3. 對照 `DATA-DICTIONARY.md` / `db/schema.sql` 確認資料欄位與 constraint（例如「同一冊只能有一筆未歸還借閱」）。
4. 再開始寫程式（API → DB → Web），每一步都寫清楚驗收條件怎麼測。
5. 寫完後回頭更新文件（讓文件永遠是最新的）。
