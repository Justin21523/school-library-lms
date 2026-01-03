/* eslint-disable no-console */

/**
 * 為 `dist/esm` 補上 `package.json`（type=module）
 *
 * 背景：
 * - `packages/shared/package.json` 目前是 `"type": "commonjs"`（讓 API 可以 require）
 * - 但 Web（Next.js / webpack）會走 exports 的 `"import"` 入口：`dist/esm/index.js`（包含 `export ...`）
 * - 若沒有在 `dist/esm` 宣告 `"type": "module"`，某些 loader 會把 `.js` 當成 script/CJS 解析
 *   → 造成 `export` 解析失敗（"import/export may appear only with sourceType: module"）
 *
 * 解法：
 * - 在 `dist/esm/package.json` 放一個 `"type": "module"`，讓解析器正確把 `dist/esm/*.js` 視為 ESM。
 */

const fs = require('node:fs');
const path = require('node:path');

const outPath = path.resolve(__dirname, '..', 'dist', 'esm', 'package.json');
const outDir = path.dirname(outPath);

fs.mkdirSync(outDir, { recursive: true });

const payload = { type: 'module' };
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

if (process.env.DEBUG) {
  console.log(`[shared] wrote ${outPath}`);
}

