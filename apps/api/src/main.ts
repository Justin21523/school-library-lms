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
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../..', '.env'),
  ];

  // 去重：避免在 cwd=repo root 時讀同一個檔案兩次。
  const uniqueCandidates = [...new Set(candidates)];

  let loadedAny = false;
  for (const envPath of uniqueCandidates) {
    if (!fs.existsSync(envPath)) continue;
    const result = dotenv.config({ path: envPath });
    if (!result.error) loadedAny = true;
  }

  // 最後保底：仍呼叫一次預設行為（也能覆蓋「我們沒猜到的 cwd」情境）。
  // - 若 .env 不存在，dotenv 只會回傳 error，不會丟例外
  // - 若 env 本來就由 OS/容器注入，也不會被覆蓋
  if (!loadedAny) dotenv.config();
}

async function bootstrap() {
  // 將 `.env` 讀入 `process.env`（例如 DATABASE_URL、API_PORT）。
  loadEnv();

  // 建立 NestJS 應用程式，並指定使用 Fastify 作為 HTTP server。
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // 設定 CORS：
  // - 透過 Nest 的 `enableCors()`，由 platform-fastify 內部去掛對應版本的 cors plugin（避免 fastify/plugin 版本不相容）
  // - `origin: true` 表示「反射」(reflect) 來自哪個 origin，就允許哪個 origin（適合開發環境）。
  // - 之後上 production 建議改成白名單。
  app.enableCors({ origin: true });

  // API 監聽的 port：預設 3001，可由 `API_PORT` 覆蓋。
  const port = Number(process.env.API_PORT ?? 3001);

  // `0.0.0.0`：讓容器/區網也能連到；若只要本機，可改 `127.0.0.1`。
  await app.listen({ port, host: '0.0.0.0' });
}

// 立即啟動（`void` 只是明確表示「我知道這是一個 Promise，但我不在這裡 await」）。
void bootstrap();
