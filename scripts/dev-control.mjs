/**
 * dev-control（本機 DX：殺 port / 重啟前的清場）
 *
 * 你回報的典型問題：
 * - `listen EADDRINUSE: address already in use 0.0.0.0:3001`
 * - Web/API 看似起了，但其實是「舊的 dev server」卡著 port
 *
 * 這支腳本的目標：
 * - 提供一個「可重複執行」的 stop 指令：針對 WEB_PORT/API_PORT（預設 3000/3001）把 LISTEN process 停掉
 * - 不依賴額外 npm 依賴（只用 node + lsof）
 *
 * 用法（建議用 npm script）：
 * - `npm run dev:stop`
 * - `npm run dev:restart`（= stop + dev）
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const command = (process.argv[2] ?? '').trim() || 'stop';
if (command !== 'stop') {
  console.error('用法：node scripts/dev-control.mjs stop');
  process.exit(1);
}

const webPort = toPort(process.env.WEB_PORT ?? process.env.WEB_HOST_PORT ?? '3000') ?? 3000;
const apiPort = toPort(process.env.API_PORT ?? process.env.API_HOST_PORT ?? '3001') ?? 3001;
const ports = [webPort, apiPort];

let killed = 0;

// 0) 若存在 pid 檔：優先停掉（避免在某些 sandbox/權限限制下 lsof 看不到）
// - 這也能避免「用 port 停掉」誤殺到無關的 process
const pidFiles = [
  { label: 'web', file: path.resolve('.logs', 'dev-web.pid') },
  { label: 'api', file: path.resolve('.logs', 'dev-api.pid') },
];
for (const entry of pidFiles) {
  const pid = readPid(entry.file);
  if (!pid) continue;
  if (!isAlive(pid)) continue;
  console.log(`[dev-control] pidfile ${entry.label}: ${pid}`);
  if (stopPid(pid)) killed += 1;
}

for (const port of ports) {
  const pids = findListeningPids(port);
  if (pids.length === 0) continue;

  console.log(`[dev-control] port ${port}: found ${pids.join(', ')}`);
  for (const pid of pids) {
    if (stopPid(pid)) killed += 1;
  }
}

console.log(`[dev-control] ✅ done (stopped=${killed})`);

function toPort(value) {
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function readPid(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const pid = Number.parseInt(raw, 10);
    if (!Number.isFinite(pid) || pid <= 0) return null;
    return pid;
  } catch {
    return null;
  }
}

function findListeningPids(port) {
  // lsof: -t 只輸出 PID；-iTCP:PORT + -sTCP:LISTEN 限定 LISTEN socket
  // - 這樣可以避免誤殺「只是連線到該 port」的 client process
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number.parseInt(x, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

function stopPid(pid) {
  try {
    // 先溫柔關閉，避免留下壞狀態（Next/Nest watch mode 通常能正常結束）
    process.kill(pid, 'SIGTERM');
  } catch {
    return false;
  }

  // 短暫等待後還活著 → 強制結束
  const startedAt = Date.now();
  while (Date.now() - startedAt < 800) {
    if (!isAlive(pid)) return true;
  }

  try {
    process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return isAlive(pid) ? false : true;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
