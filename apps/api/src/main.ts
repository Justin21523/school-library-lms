/**
 * API 入口（NestJS + Fastify）
 *
 * 這支檔案負責「啟動」後端伺服器：
 * - 載入環境變數（dotenv）
 * - 建立 NestJS 應用程式（以 Fastify 作為底層 HTTP server）
 * - 註冊 CORS（讓 Web:3000 能呼叫 API:3001）
 * - 開始 listen 指定 port
 */

// 讀取 `.env` 檔案（如果存在），把內容放進 `process.env`。
import * as dotenv from 'dotenv';

// Node 內建：用於組合/檢查「可能的 .env 位置」（monorepo workspace 常見坑）。
import * as fs from 'node:fs';
import * as path from 'node:path';

// NestJS 內部（以及 decorator metadata）會用到的反射能力。
import 'reflect-metadata';

// NestFactory：用來建立 NestJS 應用程式。
import { NestFactory } from '@nestjs/core';

// FastifyAdapter：把 NestJS 掛到 Fastify 上（效能好、插件生態完整）。
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

// 我們在 `AppModule` 裡註冊了所有 Controller/Module。
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

/**
 * 載入 `.env`（monorepo/workspaces 友善版）
 *
 * 為什麼要特別做？
 * - `npm run dev -w @library-system/api` 這種 workspace 指令，`process.cwd()` 通常會是 `apps/api`
 * - `dotenv.config()` 預設只會找「cwd 的 `.env`」，因此你把 `.env` 放在 repo root 時會讀不到
 * - 結果就是：DbService 會在啟動時噴 `Missing required env var: DATABASE_URL`
 *
 * 我們的策略：
 * 1) 先讀「package 目錄」的 `.env`（cwd/.env）→ 讓 app-specific 設定優先
 * 2) 再讀「repo root」的 `.env`（apps/api/src 或 apps/api/dist 往上 3 層）→ 補齊缺漏的共用設定
 * 3) 如果兩者都不存在，就保持不動（讓使用者用 shell/容器注入 env）
 *
 * 注意：
 * - `dotenv` 預設不會覆蓋已存在的 `process.env`（override=false）
 *   → 這就是我們能「先讀 cwd，再讀 repo root」而不會被後者覆蓋的原因
 */
function loadEnv() {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../..', '.env'),
  ];

  // 去重：避免在 cwd=repo root 時讀同一個檔案兩次。
  const uniqueEnvCandidates = [...new Set(envCandidates)];

  let loadedAny = false;
  for (const envPath of uniqueEnvCandidates) {
    if (!fs.existsSync(envPath)) continue;
    const result = dotenv.config({ path: envPath });
    if (!result.error) loadedAny = true;
  }

  // 最後保底：仍呼叫一次預設行為（也能覆蓋「我們沒猜到的 cwd」情境）。
  // - 若 .env 不存在，dotenv 只會回傳 error，不會丟例外
  // - 若 env 本來就由 OS/容器注入，也不會被覆蓋
  if (!loadedAny) dotenv.config();

  // DX：若仍缺關鍵 env（最常見是忘了複製 `.env.example -> .env`），在 dev/test 自動讀範本一次。
  // - production 一律不讀 `.env.example`（避免把範本值當成正式設定）
  // - `override=false`：不覆蓋 OS/容器注入的 env
  const isProduction = process.env.NODE_ENV === 'production';
  const needsDatabaseUrl = !process.env.DATABASE_URL;
  if (!isProduction && needsDatabaseUrl) {
    const exampleCandidates = [
      path.resolve(process.cwd(), '.env.example'),
      path.resolve(__dirname, '../../..', '.env.example'),
    ];
    const uniqueExampleCandidates = [...new Set(exampleCandidates)];
    for (const envPath of uniqueExampleCandidates) {
      if (!fs.existsSync(envPath)) continue;
      dotenv.config({ path: envPath, override: false });
    }
  }
}

/**
 * 讀取 APP_ENV（環境分類）
 *
 * 為什麼不用 NODE_ENV？
 * - NODE_ENV 在本 repo 的 Docker runtime 會被固定設成 production（效能/最佳化）
 * - 但那不等於「你真的要上線到正式環境」
 * - 我們用 APP_ENV 來表示「部署語意」：development / production
 *
 * 來源：
 * - repo root `.env.example` 已提供 APP_ENV=development
 * - docker compose / CI / K8s 可以覆蓋成 production
 */
function getAppEnv(): 'development' | 'production' {
  const raw = process.env.APP_ENV?.trim().toLowerCase();
  if (raw === 'production') return 'production';
  return 'development';
}

/**
 * production 前置檢查（fail-fast）
 *
 * 目標：
 * - 避免「用範本/弱 secret 上線」造成 token 可被偽造
 * - 避免 CORS 放太寬，讓任意網站能在使用者瀏覽器裡打你的 API
 *
 * 注意：
 * - 我們以 APP_ENV=production 作為「正式環境」判定（不要用 NODE_ENV）
 */
function assertProductionConfig() {
  if (getAppEnv() !== 'production') return;

  const tokenSecret = process.env.AUTH_TOKEN_SECRET?.trim() || '';
  if (!tokenSecret || tokenSecret === 'dev-insecure-secret') {
    throw new Error(
      'APP_ENV=production 時必須設定強隨機的 AUTH_TOKEN_SECRET（不可留空或使用 dev-insecure-secret）。',
    );
  }

  const corsOrigins = process.env.CORS_ORIGINS?.trim() || '';
  if (!corsOrigins) {
    throw new Error(
      'APP_ENV=production 時必須設定 CORS_ORIGINS（逗號分隔，例如：https://console.example.com,https://opac.example.com）。',
    );
  }
}

function normalizeOrigin(value: string) {
  // origin 的比對應以「scheme://host:port」為準（不含 path/query）。
  // - URL() 會自動標準化大小寫與尾斜線
  const url = new URL(value);
  return `${url.protocol}//${url.host}`;
}

function parseCorsOrigins(value: string) {
  const out: string[] = [];
  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  for (const raw of parts) {
    try {
      out.push(normalizeOrigin(raw));
    } catch {
      // DX：把錯誤留到啟動期就爆出來（不要默默忽略）
      throw new Error(`CORS_ORIGINS 含不合法 URL：${raw}`);
    }
  }
  return [...new Set(out)];
}

function resolveCorsOriginOption(): any {
  // 注意：這裡回傳的型別對齊 Nest enableCors() 的 origin 參數（可為 boolean | string[] | function）
  // - 開發環境：允許 reflect origin（origin: true）提高 DX（LAN / devcontainer / 反向代理不會卡）
  // - 正式環境：要求明確白名單（CORS_ORIGINS）
  const raw = process.env.CORS_ORIGINS?.trim() || '';
  if (!raw) {
    return getAppEnv() === 'production' ? [] : true;
  }

  const allowed = new Set(parseCorsOrigins(raw));

  return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    // 沒有 Origin header：通常是 curl / server-to-server，不需要 CORS 限制
    if (!origin) return cb(null, true);

    let normalized: string;
    try {
      normalized = normalizeOrigin(origin);
    } catch {
      return cb(null, false);
    }

    return cb(null, allowed.has(normalized));
  };
}

function resolveBodyLimitBytes() {
  // Fastify 預設 bodyLimit 約 1MB；但我們的 CSV import schema 允許：
  // - users/bibs: 5MB
  // - authority relations: 20MB
  // 因此需要把 bodyLimit 拉高，否則會在進 controller 前就 413。
  const raw = process.env.API_BODY_LIMIT_BYTES?.trim();
  if (!raw) return 30_000_000; // 30MB：留一些 JSON overhead 空間

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`API_BODY_LIMIT_BYTES 必須是正整數（bytes），收到：${raw}`);
  }
  return Math.floor(value);
}

async function bootstrap() {
  // 將 `.env` 讀入 `process.env`（例如 DATABASE_URL、API_PORT）。
  loadEnv();
  assertProductionConfig();

  const bodyLimit = resolveBodyLimitBytes();

  // 建立 NestJS 應用程式，並指定使用 Fastify 作為 HTTP server。
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit }),
  );

  // 全域錯誤格式：把「非預期錯誤」也包成 `{ error: { code, message, details? } }`
  // - 這能讓前端穩定顯示錯誤（避免 HTML/純文字 500 造成 JSON parse fail）
  // - 也能把 DB schema 缺漏（undefined_table/undefined_column）轉成可操作的提示
  app.useGlobalFilters(new ApiExceptionFilter());

  // 設定 CORS：
  // - 透過 Nest 的 `enableCors()`，由 platform-fastify 內部去掛對應版本的 cors plugin（避免 fastify/plugin 版本不相容）
  // - `origin: true` 表示「反射」(reflect) 來自哪個 origin，就允許哪個 origin（適合開發環境）。
  // - 之後上 production 建議改成白名單。
  app.enableCors({
    origin: resolveCorsOriginOption(),
    // 重要：Web 端用 Bearer token（Authorization header），因此必須允許 preflight 通過。
    allowedHeaders: ['content-type', 'authorization', 'accept'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    // 下載檔案（MARC/XML/MRC）時常會帶 Content-Disposition；若未來前端要讀這個 header，就需要 exposed。
    exposedHeaders: ['content-disposition'],
  });

  // API 監聽的 port：預設 3001，可由 `API_PORT` 覆蓋。
  const port = Number(process.env.API_PORT ?? 3001);

  // `0.0.0.0`：讓容器/區網也能連到；若只要本機，可改 `127.0.0.1`。
  await app.listen({ port, host: '0.0.0.0' });
}

// 立即啟動（`void` 只是明確表示「我知道這是一個 Promise，但我不在這裡 await」）。
void bootstrap();
