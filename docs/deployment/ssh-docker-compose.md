# SSH 部署（Docker Compose）

本文件提供一個「最小可用」的雲端 SSH 部署流程：把本 repo 用 Docker Compose 跑起來（postgres/redis/api/web），並用 `.env` 管理正式環境設定。

> 注意：你尚未提供主機/網域/反向代理資訊；因此本文件先以「直接開 port」為預設。若你要走 HTTPS + 單一網域，我可以再依你的架構補 Nginx/Caddy/Traefik 範本與設定。

## 0) 你需要先提供的資訊（我才能幫你一鍵化）
- SSH：`host`、`port`、`user`（不要貼私鑰；用 ssh-agent 或現有 key path）
- 網域（可選）：`console.domain`、`api.domain`（或是否共用同一個 domain）
- 是否使用反向代理（Nginx/Caddy/Traefik），以及要不要上 HTTPS
- 目標部署路徑：例如 `/opt/school-library-lms`

## 1) 遠端主機前置條件
- 安裝 Docker + Docker Compose plugin（`docker compose version`）
- 開放 port（最小版）：
  - Web：`3000/tcp`
  - API：`3001/tcp`
  - （不建議公開）Postgres/Redis：不要對外開放

## 2) 正式環境 `.env` 必填（APP_ENV=production）
API 端在 `APP_ENV=production` 會做 fail-fast 檢查（避免弱 secret 或 CORS 太寬）。

至少需要：
- `APP_ENV=production`
- `AUTH_TOKEN_SECRET=<強隨機長字串>`（不可用 `dev-insecure-secret`）
- `CORS_ORIGINS=<白名單>`（逗號分隔，必須包含 Web 的 origin）
  - 若你直接開 port：`CORS_ORIGINS=http://<你的主機或網域>:3000`
- `NEXT_PUBLIC_API_BASE_URL=<Web 要打到的 API base>`
  - 若你直接開 port：`NEXT_PUBLIC_API_BASE_URL=http://<你的主機或網域>:3001`

建議另外設定（依你的環境調整）：
- `POSTGRES_PASSWORD=<強密碼>`（不要用預設 `library`）
- `POSTGRES_PORT` / `API_HOST_PORT` / `WEB_HOST_PORT`（若要改對外 port）

## 3) 部署流程（最小版：直接用 docker compose build）
1) SSH 到遠端：
```bash
ssh <user>@<host>
```

2) 把 repo 放到遠端（擇一）：
- A) 你在遠端直接 `git clone`（遠端需能存取 repo）
- B) 你在本機用 `scp/rsync` 上傳（推薦排除 `node_modules/`）

3) 在遠端 repo root 準備 `.env`（不要 commit）：
```bash
cp .env.example .env
vim .env
```

4) 啟動（會 build images）：
```bash
docker compose up -d --build postgres redis api web
```

5) 初始化資料（可選）：
- demo seed：
```bash
docker compose --profile demo run --rm seed
```
- 大量資料（僅建議 staging/QA；會刪掉同 org_code 再重建）：
```bash
docker compose --profile scale run --rm seed-scale
```

6) 健康檢查：
```bash
curl -sS http://localhost:3001/health
curl -sS http://localhost:3000/ >/dev/null && echo OK
```

## 4) 常見問題
### 4.1 Web 顯示 NETWORK / 打不到 API
- 確認 `NEXT_PUBLIC_API_BASE_URL` 指向「瀏覽器實際可達」的 API origin（例如 `http://<host>:3001`）
- 變更 `NEXT_PUBLIC_API_BASE_URL` 後要重建 web image：
```bash
docker compose up -d --build web
```

### 4.2 CORS 擋住（瀏覽器顯示像 NETWORK）
- 確認 `CORS_ORIGINS` 包含 Web 的 origin（scheme+host+port）
  - 例：`http://<host>:3000`
- 修改後重啟 api：
```bash
docker compose up -d --build api
```

### 4.3 供應商 reverse proxy 沒做 `/api/v1/* -> api` 的 path routing（會看到 404/HTML）
如果你的上線環境是「供應商代管 OpenResty/Nginx + SSL」，但他們只把整個網域轉發到 Web（3000），
沒有把 `/api/v1/*` 轉到 API（3001），你會看到：
- 打 `https://<domain>/` 正常
- 但打 `https://<domain>/api/v1/orgs` 回 Next.js 的 404/HTML（前端看起來像 NETWORK）

解法有兩種（推薦 A）：
- A) 讓反向代理層做 path routing（最佳）  
  - `/` → `web:3000`
  - `/api/v1/*` → `api:3001`（不要改寫路徑）
- B) 本 repo 已在 Web 端內建 fallback（Next rewrites）  
  - 若 `/api/v1/*` 落到 web:3000，Next 會把它反向代理到 docker compose 的 `api:3001`
  - 這能避免你卡在「等供應商調整 proxy」才能登入/操作

## 5) 下一步（你提供資訊後我可以補上）
- 以單一網域上線（HTTPS）：`/` → web、`/api/*` → api（同源避免 CORS）
- 產出 `production` compose override（不對外暴露 postgres/redis）
- 加上備份/更新策略（DB backup、rolling update、監控/告警）
