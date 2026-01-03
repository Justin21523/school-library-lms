/**
 * Playwright JSON 報告 → QA Summary（Markdown）
 *
 * 目的：
 * - Playwright 的 HTML report 很適合人工點開看，但不利於「快速掃描整體健康度」
 * - JSON report 是機器可讀的，但人眼不友善
 *
 * 因此這支腳本把 JSON report 彙整成：
 * - test-results/playwright/qa-summary.md
 *
 * 內容會包含：
 * - 環境/目標（orgCode/orgId/baseUrl）
 * - 通過/失敗統計
 * - 每個測試的狀態與耗時
 * - 若失敗：錯誤訊息（精簡）
 * - diagnostics（console/page/request failures 的摘要；用於 UX/穩定性追查）
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const reportJsonPath = path.resolve('test-results/playwright/report.json');
const contextJsonPath = path.resolve('test-results/playwright/run-context.json');
const outputMdPath = path.resolve('test-results/playwright/qa-summary.md');

function formatMs(ms) {
  if (!Number.isFinite(ms)) return 'n/a';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function safeOneLine(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function stripAnsi(s) {
  // 讓 summary 檔案更可讀：
  // - Playwright 的 error.message 可能含 ANSI 色碼（\u001b[...m）
  // - 這些在 Markdown 內只會變成雜訊
  return String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

function decodeAttachmentBody(att) {
  // Playwright JSON reporter 的 attachments.body 依規格是 base64；我們在此統一解碼。
  // - 若 body 不是字串或 decode 後為空，回傳 null。
  const body = att?.body;
  if (typeof body !== 'string' || !body) return null;
  try {
    const decoded = Buffer.from(body, 'base64').toString('utf-8');
    return decoded?.trim() ? decoded : null;
  } catch {
    return null;
  }
}

function pickErrorMessage(result) {
  // Playwright JSON 結構可能會有 errors 陣列；我們只取第一個。
  const err = result?.errors?.[0] ?? null;
  if (!err) return null;

  // err.message 有時會很長（含 stack / call log / snippet）；
  // summary 只要「可快速判斷根因」即可，避免整段錯誤把檔案撐爆。
  const raw = stripAnsi(err.message || err.value || err.error || '');

  // 1) 先砍掉常見的冗長區段（Call log / snippet / stack）
  const cutMarkers = ['Call log:', '    at ', 'at /workspace/', 'Attachment #', '==='];
  let clipped = raw;
  for (const m of cutMarkers) {
    const idx = clipped.indexOf(m);
    if (idx >= 0) clipped = clipped.slice(0, idx);
  }

  // 2) 保留前幾行（避免 strict mode violation 的「200 elements」列到爆）
  const lines = clipped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const head = lines.slice(0, 12).join(' ');

  // 3) 最後做一次單行化與長度限制
  const msg = safeOneLine(head);
  const maxLen = 420;
  if (!msg) return null;
  return msg.length > maxLen ? `${msg.slice(0, maxLen)}…` : msg;
}

function normalizeSuiteTitleForPath(suite) {
  // Playwright JSON 的最外層 suite.title 通常等於檔名（例如 10-xxx.spec.ts），
  // 但我們在表格裡已經有 file 欄位，title path 再加檔名會顯得重複。
  //
  // 因此：若 suite.title === basename(suite.file) → 不納入 title path。
  const title = safeOneLine(suite?.title);
  if (!title) return null;

  const file = safeOneLine(suite?.file);
  if (file && title === path.basename(file)) return null;
  return title;
}

function extractDiagnosticsFromAttachments(attachments) {
  const diag = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };

  for (const att of attachments ?? []) {
    // 我們在 fixtures.ts/page.ts 中 attach 的命名是固定的。
    const text = decodeAttachmentBody(att);
    if (!text) continue;

    if (att.name === 'console-errors.txt') {
      // 我們 attach 時用 \n\n 分隔；這裡用空行切回「多筆訊息」
      diag.consoleErrors.push(...text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean));
    }
    if (att.name === 'page-errors.txt') {
      diag.pageErrors.push(...text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean));
    }
    if (att.name === 'request-failures.txt') {
      diag.requestFailures.push(...text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
    }
    if (att.name === 'http-errors.json') {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) diag.httpErrors.push(...parsed);
      } catch {
        // ignore：壞掉的 json 不影響 summary 主體
      }
    }
  }

  return diag;
}

function normalizeUrlPath(rawUrl) {
  // 讓 http errors 更「可分組」：
  // - API 路徑內通常會帶 orgId / bibId / holdId（UUID）
  // - 若不做正規化，summary 會被「每個 id 都不一樣」撕裂成很多行，反而看不出主要問題在哪
  try {
    const u = new URL(String(rawUrl));
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const segs = u.pathname.split('/').map((s) => (uuidRe.test(s) ? ':id' : s));
    return segs.join('/');
  } catch {
    return safeOneLine(rawUrl);
  }
}

function walkSuite(suite, rows, prefixTitles) {
  const suiteTitle = normalizeSuiteTitleForPath(suite);
  const nextPrefix = suiteTitle ? [...prefixTitles, suiteTitle] : prefixTitles;

  // Playwright JSON reporter 結構：
  // - suite.specs[].tests[].results[]
  // - suite.suites[]（describe block）可能還會繼續有 specs/suites
  for (const spec of suite.specs ?? []) {
    const specTitle = safeOneLine(spec?.title);
    const titlePath = [...nextPrefix, specTitle].filter(Boolean).join(' > ');

    for (const t of spec.tests ?? []) {
      const results = Array.isArray(t.results) ? t.results : [];
      const last = results.length ? results[results.length - 1] : null;

      const status = last?.status ?? t.outcome ?? (spec.ok ? 'passed' : 'failed') ?? 'unknown';
      const duration = last?.duration ?? 0;
      const file = spec.file ?? suite.file ?? '(unknown)';
      const error = pickErrorMessage(last);
      const project = t.projectName ?? t.projectId ?? null;
      const diag = extractDiagnosticsFromAttachments(last?.attachments ?? []);

      rows.push({ file, title: titlePath, status, duration, error, project, diag });
    }
  }

  for (const child of suite.suites ?? []) {
    walkSuite(child, rows, nextPrefix);
  }
}

async function main() {
  const reportRaw = await fs.readFile(reportJsonPath, 'utf-8');
  const report = JSON.parse(reportRaw);

  let context = null;
  try {
    context = JSON.parse(await fs.readFile(contextJsonPath, 'utf-8'));
  } catch {
    // context 是輔助資訊，沒有也能產出 summary
  }

  const rows = [];
  for (const s of report.suites ?? []) walkSuite(s, rows, []);

  const stats = report.stats ?? {};
  const startedAt = stats.startTime ? new Date(stats.startTime) : null;

  const total = rows.length;
  const passed = rows.filter((r) => r.status === 'passed').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const skipped = rows.filter((r) => r.status === 'skipped').length;
  const flaky = rows.filter((r) => r.status === 'flaky').length;

  // diagnostics：跨測試彙整（方便看「一堆頁面都在噴同一個錯」）
  const allConsoleErrors = rows.flatMap((r) => r.diag?.consoleErrors ?? []);
  const allPageErrors = rows.flatMap((r) => r.diag?.pageErrors ?? []);
  const allRequestFailures = rows.flatMap((r) => r.diag?.requestFailures ?? []);
  const allHttpErrors = rows.flatMap((r) => r.diag?.httpErrors ?? []);

  const abortedRequestFailures = allRequestFailures.filter((l) => /ERR_ABORTED|NS_BINDING_ABORTED/i.test(l));
  const nonAbortedRequestFailures = allRequestFailures.filter((l) => !/ERR_ABORTED|NS_BINDING_ABORTED/i.test(l));

  const lines = [];
  lines.push('# QA Summary（Playwright）');
  lines.push('');
  lines.push(`- 產生時間：${new Date().toISOString()}`);
  if (startedAt) lines.push(`- 測試開始：${startedAt.toISOString()}`);
  if (Number.isFinite(stats.duration)) lines.push(`- 總耗時：${formatMs(stats.duration)}`);
  lines.push(`- 結果：passed=${passed}, failed=${failed}, flaky=${flaky}, skipped=${skipped}, total=${total}`);
  lines.push('');

  if (context) {
    lines.push('## Run Context');
    lines.push('');
    lines.push(`- org：${context?.org?.name ?? '(unknown)'} (${context?.org?.code ?? '(no code)'})`);
    lines.push(`- orgId：${context?.org?.id ?? '(unknown)'}`);
    lines.push(`- web_base_url：${context?.web_base_url ?? '(unknown)'}`);
    lines.push(`- api_base_url：${context?.api_base_url ?? '(unknown)'}`);
    lines.push(`- api_proxy_target：${context?.api_proxy_target ?? '(none)'}`);
    lines.push('');
  }

  lines.push('## Tests');
  lines.push('');
  lines.push('| Status | Duration | Title | File |');
  lines.push('|---|---:|---|---|');
  for (const r of rows) {
    const title = r.project ? `${safeOneLine(r.title)} (${r.project})` : safeOneLine(r.title);
    lines.push(`| ${r.status} | ${formatMs(r.duration)} | ${title} | ${safeOneLine(r.file)} |`);
  }
  lines.push('');

  // 慢測試：在 UI E2E 世界，慢往往代表：
  // - DB 查詢沒走 index / join 太重
  // - 前端一次渲染太多（或資料列太胖）
  // - API N+1 / 缺 pagination
  //
  // 把最慢的幾筆列出來，方便你優先抓「最該優化」的路徑。
  const slowest = rows
    .slice()
    .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
    .slice(0, 8);

  lines.push('## Slowest Tests（Top）');
  lines.push('');
  lines.push('| Duration | Status | Title | File |');
  lines.push('|---:|---|---|---|');
  for (const r of slowest) {
    lines.push(`| ${formatMs(r.duration)} | ${r.status} | ${safeOneLine(r.title)} | ${safeOneLine(r.file)} |`);
  }
  lines.push('');

  if (failed) {
    lines.push('## Failures');
    lines.push('');
    for (const r of rows.filter((x) => x.status === 'failed')) {
      lines.push(`- ${safeOneLine(r.title)} — ${r.error ?? '(no error message)'}`);
    }
    lines.push('');
    lines.push('提示：詳細錯誤/截圖/trace 請開啟 `playwright-report/index.html`。');
    lines.push('');
  }

  // diagnostics：即使測試全過，也可能有 console errors / 非預期 request failures；
  // 這些通常是「體驗不佳」或「未來會變成 flaky」的先兆，值得先記錄下來。
  lines.push('## Diagnostics');
  lines.push('');
  lines.push(`- console_errors：${allConsoleErrors.length}`);
  lines.push(`- page_errors：${allPageErrors.length}`);
  lines.push(
    `- request_failures：total=${allRequestFailures.length}, aborted=${abortedRequestFailures.length}, non_aborted=${nonAbortedRequestFailures.length}`,
  );
  lines.push(
    `- http_errors：total=${allHttpErrors.length}, 4xx=${allHttpErrors.filter((e) => Number(e?.status ?? 0) >= 400 && Number(e?.status ?? 0) < 500).length}, 5xx=${allHttpErrors.filter((e) => Number(e?.status ?? 0) >= 500).length}`,
  );
  lines.push('');

  if (allConsoleErrors.length) {
    const byMsg = new Map();
    for (const msg of allConsoleErrors) byMsg.set(msg, (byMsg.get(msg) ?? 0) + 1);
    const top = [...byMsg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

    lines.push('### Console Errors（Top）');
    lines.push('');
    for (const [msg, count] of top) {
      lines.push(`- (${count}x) ${safeOneLine(msg)}`);
    }
    lines.push('');
  }

  if (allPageErrors.length) {
    const byMsg = new Map();
    for (const msg of allPageErrors) byMsg.set(msg, (byMsg.get(msg) ?? 0) + 1);
    const top = [...byMsg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

    lines.push('### Page Errors（Top）');
    lines.push('');
    for (const [msg, count] of top) {
      lines.push(`- (${count}x) ${safeOneLine(msg)}`);
    }
    lines.push('');
  }

  if (nonAbortedRequestFailures.length) {
    // 把 request failures 以 errorText 分組；URL 每次都不同，直接用整行會太發散。
    const byError = new Map();
    for (const line of nonAbortedRequestFailures) {
      const m = line.match(/^\S+\s+\S+\s+(.*)$/);
      const errorText = safeOneLine(m?.[1] ?? '(unknown error)');
      const entry = byError.get(errorText) ?? { count: 0, example: line };
      entry.count += 1;
      if (!entry.example) entry.example = line;
      byError.set(errorText, entry);
    }
    const top = [...byError.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 30);

    lines.push('### Request Failures（Non-aborted, Top）');
    lines.push('');
    for (const [errorText, v] of top) {
      lines.push(`- (${v.count}x) ${errorText} — 例：${safeOneLine(v.example)}`);
    }
    lines.push('');
  }

  if (abortedRequestFailures.length) {
    // Next.js（尤其是 App Router / RSC）常見的「預抓/導航取消」會出現 net::ERR_ABORTED；
    // 這不一定是 bug，但如果你發現畫面偶發空白，仍可回頭比對 aborted 的 URL/時序。
    lines.push('### Request Failures（Aborted, Count）');
    lines.push('');
    lines.push(
      `- aborted_total=${abortedRequestFailures.length}（多半是頁面切換/預抓被取消；通常不影響功能，但可用於追查偶發空白）`,
    );
    lines.push('');
  }

  if (allHttpErrors.length) {
    // 以「status + method + normalizedPath」分組，避免 UUID 導致每筆都不一樣
    const byKey = new Map();
    for (const e of allHttpErrors) {
      const status = Number(e?.status ?? 0) || 0;
      const method = safeOneLine(e?.method ?? 'GET') || 'GET';
      const path = normalizeUrlPath(e?.url ?? '');
      const key = `${status} ${method} ${path}`;
      const entry = byKey.get(key) ?? { count: 0, example: e };
      entry.count += 1;
      if (!entry.example) entry.example = e;
      byKey.set(key, entry);
    }

    const top = [...byKey.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 30);
    lines.push('### HTTP Errors（API status >= 400, Top）');
    lines.push('');
    for (const [key, v] of top) {
      const snippet = safeOneLine(v?.example?.bodySnippet ?? '') || '';
      lines.push(`- (${v.count}x) ${key}${snippet ? ` — ${snippet}` : ''}`);
    }
    lines.push('');
  }

  await fs.writeFile(outputMdPath, lines.join('\n'), 'utf-8');
  console.log(`[qa] wrote ${path.relative(process.cwd(), outputMdPath)}`);
}

await main();
