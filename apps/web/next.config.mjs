import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * Next.js（web workspace）env 載入（monorepo 友善版）
 *
 * 為什麼要做？
 * - monorepo 下跑 `next dev` 的專案根目錄是 `apps/web`
 * - 但我們多數環境變數（例如 NEXT_PUBLIC_API_BASE_URL）是放在 repo root 的 `.env`
 * - 若不特別處理，前端 build-time 會吃不到 `.env`，造成「整站大量 NETWORK」且不易定位
 *
 * 注意：
 * - 只載入 repo root 的 `.env`（不自動載 `.env.example`），避免把範本值打包進 production
 * - `override: false`：不覆蓋已由 OS/CI 注入的 env（production 正確做法）
 */
function loadRepoRootEnvForNext() {
  const require = createRequire(import.meta.url);

  // `dotenv` 是 API workspace 的 dependency，npm workspaces 會 hoist 到 repo root。
  // 若未安裝（極少數情境），就跳過（仍可用 OS env）。
  let dotenv = null;
  try {
    dotenv = require('dotenv');
  } catch {
    dotenv = null;
  }

  if (!dotenv) return;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRootEnvPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(repoRootEnvPath)) return;

  dotenv.config({ path: repoRootEnvPath, override: false });
}

loadRepoRootEnvForNext();

/**
 * Security headers（最小可用版）
 *
 * 背景：
 * - 目前 staff auth token 存在 localStorage（apps/web/app/lib/staff-session.ts）
 * - localStorage 的主要風險是 XSS：一旦有 script injection，token 會被讀走
 *
 * 因此我們先做「不改 auth 架構、但能立刻降低風險」的防線：
 * - 基本安全標頭：nosniff、frame deny、referrer policy、permissions policy
 * - CSP（production-only）：避免 dev/HMR 被 CSP 擋住；同時限制 connect-src 等來源
 *
 * 重要提醒：
 * - CSP 若要「真正防 XSS 讀 localStorage」，理想解是：
 *   - 改用 HttpOnly cookie（token 不可被 JS 讀取）+ CSRF 防護
 *   - CSP 用 nonce/hash（移除 'unsafe-inline'）
 * - 這裡先採「不破壞功能」的務實版本，作為 P2 的起點。
 */
function normalizeOrigin(maybeUrl) {
  try {
    return new URL(String(maybeUrl)).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy() {
  // 讓 web 可以連到 API（通常是 http://localhost:3001）
  const apiOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_API_BASE_URL);
  const dockerApiOrigin = normalizeOrigin('http://api:3001');

  // 本 repo 的常見部署/測試情境：
  // - Host 開發：Web=http://localhost:3000 → API=http://localhost:3001
  // - Docker network（E2E/QA）：Web=http://web:3000 → API=http://api:3001
  //
  // 我們把 CSP 的 connect-src 做成「最小但可用」：
  // - 正式環境：應把 NEXT_PUBLIC_API_BASE_URL 設成你的真實 API domain（這裡就會自動放進 CSP）
  // - 本機/QA：若 NEXT_PUBLIC_API_BASE_URL 指向 localhost，仍額外允許 docker 的 api:3001（避免 E2E 被 CSP 擋住）
  const extraConnectSrc = new Set();
  if (apiOrigin) extraConnectSrc.add(apiOrigin);
  const localOrigins = new Set(['http://localhost:3001', 'http://127.0.0.1:3001', 'http://[::1]:3001']);
  if ((!apiOrigin || localOrigins.has(apiOrigin)) && dockerApiOrigin) extraConnectSrc.add(dockerApiOrigin);

  // 注意：Next.js（app router）會注入 inline script 來 bootstrap RSC/flight data；
  // 若沒有 nonce/hash 的配套，這裡必須先保留 'unsafe-inline'，否則會直接白畫面。
  //
  // 即使如此，CSP 仍有價值：
  // - 限制外部 script/style/img/font/connect 的來源範圍
  // - 配合 frame-ancestors/object-src/base-uri 等指令，縮小攻擊面
  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    // connect-src：XHR/fetch/WebSocket（這裡至少要允許 API origin）
    `connect-src 'self'${extraConnectSrc.size ? ` ${Array.from(extraConnectSrc).join(' ')}` : ''}`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
  ];

  return directives.join('; ');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * 內建「API reverse proxy fallback」
   *
   * 背景：
   * - 你目前的上線環境是 NAT + 供應商代管的 reverse proxy（OpenResty）
   * - 供應商若只把整個 domain 轉發到 web:3000，而沒做 `/api/v1/* -> api:3001` 的 path routing，
   *   瀏覽器打 `https://<domain>/api/v1/...` 會落到 Next.js → 變成 404 或回 HTML（看起來像 NETWORK）
   *
   * 解法（不依賴供應商立即調整）：
   * - 讓 Next.js server 在「收到 /api/v1/*」時，直接把 request 反向代理到 docker compose 的 `api` service。
   *
   * 注意：
   * - 這是 fallback；理想解仍是讓反向代理層做 path routing（效能/可觀測性較好）
   * - 若反向代理已正確把 /api/v1 轉到 API，這段 rewrites 不會被觸發（不會造成衝突）
   */
  async rewrites() {
    // docker compose network 內：api service 的 DNS name 就是 `api`
    // - 不能用 localhost:3001（那是 web container 自己，不是 API）
    const internalApiBase = 'http://api:3001';

    return [
      // API v1：保留原始路徑（不要 strip /api/v1）
      { source: '/api/v1/:path*', destination: `${internalApiBase}/api/v1/:path*` },

      // optional：讓 /health 在同一個 domain 下也能通（方便反向代理/監控）
      { source: '/health', destination: `${internalApiBase}/health` },
    ];
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';

    const headers = [
      // 基本硬化（幾乎不會破壞功能）
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: [
          'camera=()',
          'microphone=()',
          'geolocation=()',
          'payment=()',
          'usb=()',
        ].join(', '),
      },
      // COOP/CORP：降低 cross-origin window 互動帶來的風險（不啟用 COEP，避免把資源載入搞得太嚴格）
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
    ];

    if (isProd) {
      headers.push({ key: 'Content-Security-Policy', value: buildContentSecurityPolicy() });
      // HSTS 只有在 HTTPS 下才會生效；我們只在 production build 開啟，避免影響本機 http 開發。
      headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    }

    return [{ source: '/:path*', headers }];
  },
};

export default nextConfig;
