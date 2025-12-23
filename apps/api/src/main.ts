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

// NestJS 內部（以及 decorator metadata）會用到的反射能力。
import 'reflect-metadata';

// NestFactory：用來建立 NestJS 應用程式。
import { NestFactory } from '@nestjs/core';

// FastifyAdapter：把 NestJS 掛到 Fastify 上（效能好、插件生態完整）。
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

// CORS plugin：允許不同 origin（例如 localhost:3000）呼叫此 API。
import cors from '@fastify/cors';

// 我們在 `AppModule` 裡註冊了所有 Controller/Module。
import { AppModule } from './app.module';

async function bootstrap() {
  // 將 `.env` 讀入 `process.env`（例如 DATABASE_URL、API_PORT）。
  dotenv.config();

  // 建立 NestJS 應用程式，並指定使用 Fastify 作為 HTTP server。
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // 設定 CORS：
  // - `origin: true` 表示「反射」(reflect) 來自哪個 origin，就允許哪個 origin（適合開發環境）。
  // - 之後上 production 建議改成白名單。
  await app.register(cors, { origin: true });

  // API 監聽的 port：預設 3001，可由 `API_PORT` 覆蓋。
  const port = Number(process.env.API_PORT ?? 3001);

  // `0.0.0.0`：讓容器/區網也能連到；若只要本機，可改 `127.0.0.1`。
  await app.listen({ port, host: '0.0.0.0' });
}

// 立即啟動（`void` 只是明確表示「我知道這是一個 Promise，但我不在這裡 await」）。
void bootstrap();
