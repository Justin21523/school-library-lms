/**
 * QA：MARC roundtrip / correctness（不依賴測試框架）
 *
 * 為什麼要這支腳本？
 * - 本專案目前沒有 Jest/Vitest；但你要求「ISO2709/MARCXML/JSON 互轉一致性」的自動驗證
 * - 因此我們用一支 Node 腳本做 smoke-level assertions：
 *   1) `buildMarcRecordFromBibliographic` 的 merge 規則（245/264/650/700）不會丟子欄位
 *   2) `serializeIso2709` / `serializeMarcXml` 輸出可以被 parse 回來且 fields 不變
 *
 * 執行方式：
 * - 先 build API（產生 dist/）
 * - 再執行本腳本
 *
 *   npm run qa:marc
 */

/* eslint-disable no-console */

const assert = require('assert');
const path = require('path');

// 這支腳本直接吃「編譯後」的 API common module（apps/api 是 CommonJS）
const marcModulePath = path.join(__dirname, '..', 'apps', 'api', 'dist', 'common', 'marc.js');

let marc;
try {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  marc = require(marcModulePath);
} catch (error) {
  console.error(`找不到已編譯的 MARC 模組：${marcModulePath}`);
  console.error('請先執行：npm run build -w @library-system/api');
  process.exit(1);
}

const { buildMarcRecordFromBibliographic, serializeIso2709, serializeMarcXml } = marc;

// ----------------------------
// 1) Minimal parsers（只用於驗證「自家輸出」）
// ----------------------------

function parseIso2709(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length < 25) throw new Error('Invalid ISO2709: too short');

  const leader = bytes.toString('utf8', 0, 24);
  const baseAddress = parseIntSafe(leader.slice(12, 17));
  if (!baseAddress || baseAddress < 25 || baseAddress > bytes.length) {
    throw new Error('Invalid ISO2709: leader base address');
  }

  const FT = 0x1e;
  const dirEnd = bytes.indexOf(FT, 24);
  if (dirEnd < 0) throw new Error('Invalid ISO2709: missing directory terminator');

  const directory = bytes.subarray(24, dirEnd);
  const fields = [];

  for (let i = 0; i + 12 <= directory.length; i += 12) {
    const entry = directory.subarray(i, i + 12);
    const tag = entry.toString('utf8', 0, 3);
    const length = parseIntSafe(entry.toString('utf8', 3, 7));
    const start = parseIntSafe(entry.toString('utf8', 7, 12));
    if (!/^[0-9]{3}$/.test(tag) || !length || start === null) continue;

    const fieldStart = baseAddress + start;
    const fieldEnd = fieldStart + length;
    if (fieldStart < 0 || fieldEnd > bytes.length) continue;

    const raw = bytes.subarray(fieldStart, fieldEnd);
    const content = raw.length > 0 && raw[raw.length - 1] === FT ? raw.subarray(0, raw.length - 1) : raw;

    const tagNum = Number.parseInt(tag, 10);
    if (Number.isFinite(tagNum) && tagNum < 10) {
      fields.push({ tag, value: content.toString('utf8') });
      continue;
    }

    fields.push(parseIso2709DataField(tag, content));
  }

  return { leader, fields };
}

function parseIso2709DataField(tag, content) {
  // 前兩個 byte 是 ind1/ind2
  const ind1 = content.length >= 1 ? content.toString('utf8', 0, 1) : ' ';
  const ind2 = content.length >= 2 ? content.toString('utf8', 1, 2) : ' ';

  const SF = 0x1f;
  const subfields = [];

  let i = 2;
  while (i < content.length) {
    if (content[i] !== SF) {
      i += 1;
      continue;
    }

    const code = i + 1 < content.length ? content.toString('utf8', i + 1, i + 2) : '';
    const valueStart = i + 2;
    let j = valueStart;
    while (j < content.length && content[j] !== SF) j += 1;
    const value = content.toString('utf8', valueStart, j);

    if (code && code.length === 1) subfields.push({ code, value });
    i = j;
  }

  if (subfields.length === 0) throw new Error(`Invalid ISO2709: datafield ${tag} missing subfields`);
  return { tag, ind1: ind1 || ' ', ind2: ind2 || ' ', subfields };
}

function parseMarcXml(xml) {
  // 注意：這不是通用 XML parser，只保證能 parse `serializeMarcXml()` 的輸出。
  const leaderMatch = xml.match(/<leader>([\s\S]*?)<\/leader>/);
  const leader = leaderMatch ? unescapeXml(leaderMatch[1]) : ' '.repeat(24);

  const fields = [];

  // controlfield
  for (const m of xml.matchAll(/<controlfield\s+tag="([0-9]{3})">([\s\S]*?)<\/controlfield>/g)) {
    fields.push({ tag: m[1], value: unescapeXml(m[2] ?? '') });
  }

  // datafield + nested subfield
  for (const m of xml.matchAll(/<datafield\s+tag="([0-9]{3})"\s+ind1="([^"]*)"\s+ind2="([^"]*)">([\s\S]*?)<\/datafield>/g)) {
    const tag = m[1];
    const ind1 = (m[2] ?? ' ').slice(0, 1) || ' ';
    const ind2 = (m[3] ?? ' ').slice(0, 1) || ' ';
    const inner = m[4] ?? '';

    const subfields = [];
    for (const sf of inner.matchAll(/<subfield\s+code="([^"]*)">([\s\S]*?)<\/subfield>/g)) {
      const code = (sf[1] ?? '').slice(0, 1);
      const value = unescapeXml(sf[2] ?? '');
      if (code && code.length === 1) subfields.push({ code, value });
    }

    fields.push({ tag, ind1, ind2, subfields });
  }

  return { leader, fields };
}

function unescapeXml(value) {
  // 反向對應 apps/api/src/common/marc.ts 的 escapeXml（&amp; 必須最後處理，避免把 &amp;lt; 誤還原成 <）
  return String(value)
    .replaceAll('&apos;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

function parseIntSafe(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

// ----------------------------
// 2) Normalization for compare
// ----------------------------

function normalizeRecord(record) {
  // roundtrip 驗證的目標是「欄位/子欄位不丟失」；leader 的 record length/base address 會因序列化而改變
  // → 因此比較時忽略 leader
  return {
    fields: (record.fields ?? []).map(normalizeField),
  };
}

function normalizeField(field) {
  if (field && typeof field === 'object' && typeof field.value === 'string') {
    return { tag: field.tag, value: field.value };
  }
  return {
    tag: field.tag,
    ind1: (field.ind1 ?? ' ').slice(0, 1) || ' ',
    ind2: (field.ind2 ?? ' ').slice(0, 1) || ' ',
    subfields: (field.subfields ?? []).map((sf) => ({ code: sf.code, value: sf.value })),
  };
}

function findFirstDataField(record, tag) {
  return (record.fields ?? []).find((f) => f && f.tag === tag && Array.isArray(f.subfields));
}

function getSubfield(field, code) {
  const sf = (field.subfields ?? []).find((s) => s.code === code);
  return sf ? sf.value : null;
}

function hasSubfield(field, code) {
  return (field.subfields ?? []).some((s) => s.code === code);
}

// ----------------------------
// 3) Test cases
// ----------------------------

function run() {
  // 模擬「匯入後」的狀態：
  // - 表單欄位（title/creators/subjects/...）是可治理真相來源
  // - 進階子欄位/未覆蓋欄位落在 marc_extras（245$c、264$a、650$x、700$e/$4、020$q、041$b、082$2、084$2...）
  const baseBib = {
    id: '11111111-1111-1111-1111-111111111111',
    title: '主標題 : 副標題',
    creators: ['張三'],
    contributors: ['李四'],
    publisher: '測試出版社',
    published_year: 2025,
    subjects: ['魔法'],
    isbn: '9789573317248',
  };

  const subjectVocabularyByLabel = {
    魔法: 'builtin-zh',
    // 也放一份 normalize key（後端會做 trim/lower；這裡示意）
    ['魔法'.toLowerCase()]: 'builtin-zh',
  };

  function assertRoundtrips(record, label) {
    // ISO2709 roundtrip：serialize → parse 不丟 fields/subfields
    const isoBytes = serializeIso2709(record);
    const isoParsed = parseIso2709(isoBytes);
    assert.deepStrictEqual(normalizeRecord(isoParsed), normalizeRecord(record), `ISO2709 roundtrip mismatch (${label})`);

    // MARCXML roundtrip：serialize → parse 不丟 fields/subfields
    const xml = serializeMarcXml(record);
    const xmlParsed = parseMarcXml(xml);
    assert.deepStrictEqual(normalizeRecord(xmlParsed), normalizeRecord(record), `MARCXML roundtrip mismatch (${label})`);

    // JSON roundtrip：純 JSON 結構應可序列化/反序列化不丟
    const jsonParsed = JSON.parse(JSON.stringify(record));
    assert.deepStrictEqual(normalizeRecord(jsonParsed), normalizeRecord(record), `JSON roundtrip mismatch (${label})`);
  }

  // ----------------------------
  // Case A：非英文 → 084；同時驗證 020/041/084 merge
  // ----------------------------

  const bibZh = {
    ...baseBib,
    language: 'zh',
    classification: '823.914',
    marc_extras: [
      // 245：保留 non-filing ind2 與 statement of responsibility
      { tag: '245', ind1: '1', ind2: '4', subfields: [{ code: 'b', value: '副標題' }, { code: 'c', value: '張三著' }] },

      // 264：保留 place（$a）；$b/$c 會由表單覆蓋
      { tag: '264', ind1: ' ', ind2: '1', subfields: [{ code: 'a', value: '臺北市' }, { code: 'b', value: '舊出版社' }, { code: 'c', value: '1999' }] },

      // 020：保留 $q/$c（qualifying info / terms of availability）
      { tag: '020', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '9789573317248 (pbk.)' }, { code: 'q', value: 'pbk.' }, { code: 'c', value: 'NT$300' }] },

      // 041：保留其他語言/子欄位（例：原文/翻譯語言）
      { tag: '041', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'chi' }, { code: 'b', value: 'eng' }] },

      // 084：保留 $2（source）；測試「匯入資料優先」避免被 MVP 預設 ccl 覆蓋
      { tag: '084', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'OLD' }, { code: '2', value: 'local-scheme' }, { code: 'b', value: 'copy1' }] },

      // 650：保留 subdivisions + authority id；$2 會優先用 subjectVocabularyByLabel 推導
      { tag: '650', ind1: ' ', ind2: '7', subfields: [{ code: 'a', value: '魔法' }, { code: 'x', value: '研究' }, { code: 'z', value: '臺灣' }, { code: '2', value: 'local' }, { code: '0', value: '(id)123' }] },

      // 700：保留 relator（$e/$4）
      { tag: '700', ind1: '1', ind2: ' ', subfields: [{ code: 'a', value: '李四' }, { code: 'e', value: '譯者' }, { code: '4', value: 'trl' }] },

      // 其他常見未覆蓋 tags（要求覆蓋度不再不足）
      { tag: '246', ind1: '3', ind2: ' ', subfields: [{ code: 'a', value: '另題名' }] },
      { tag: '250', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '二版' }] },
      { tag: '300', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '123頁' }] },
      { tag: '505', ind1: '0', ind2: ' ', subfields: [{ code: 'a', value: '內容提要' }] },
      { tag: '520', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '摘要內容' }] },
      { tag: '655', ind1: ' ', ind2: '7', subfields: [{ code: 'a', value: '小說' }, { code: '2', value: 'lcgft' }] },
    ],
  };

  const recordZh = buildMarcRecordFromBibliographic(bibZh, { subjectVocabularyByLabel });

  // merge rules：欄位與子欄位都要存在
  const f245 = findFirstDataField(recordZh, '245');
  assert.ok(f245, 'missing 245');
  assert.strictEqual(f245.ind2, '4', '245 ind2 should preserve extras non-filing');
  assert.strictEqual(getSubfield(f245, 'a'), '主標題', '245$a should come from form title (split)');
  assert.strictEqual(getSubfield(f245, 'b'), '副標題', '245$b should come from form title (split)');
  assert.strictEqual(getSubfield(f245, 'c'), '張三著', '245$c should be preserved from extras');

  const f264 = findFirstDataField(recordZh, '264');
  assert.ok(f264, 'missing 264');
  assert.strictEqual(getSubfield(f264, 'a'), '臺北市', '264$a should be preserved from extras');
  assert.strictEqual(getSubfield(f264, 'b'), '測試出版社', '264$b should come from form publisher');
  assert.strictEqual(getSubfield(f264, 'c'), '2025', '264$c should come from form published_year');

  const f041 = findFirstDataField(recordZh, '041');
  assert.ok(f041, 'missing 041');
  assert.strictEqual(getSubfield(f041, 'a'), 'zh', '041$a should come from form language');
  assert.ok(hasSubfield(f041, 'b'), '041$b should be preserved from extras');

  const f020 = findFirstDataField(recordZh, '020');
  assert.ok(f020, 'missing 020');
  assert.strictEqual(getSubfield(f020, 'a'), '9789573317248', '020$a should come from form isbn');
  assert.ok(hasSubfield(f020, 'q'), '020$q should be preserved from extras');
  assert.ok(hasSubfield(f020, 'c'), '020$c should be preserved from extras');

  const f084 = findFirstDataField(recordZh, '084');
  assert.ok(f084, 'missing 084');
  assert.strictEqual(getSubfield(f084, 'a'), '823.914', '084$a should come from form classification');
  assert.strictEqual(getSubfield(f084, '2'), 'local-scheme', '084$2 should prefer extras (source)');
  assert.ok(hasSubfield(f084, 'b'), '084$b should be preserved from extras');

  const f650 = findFirstDataField(recordZh, '650');
  assert.ok(f650, 'missing 650');
  assert.strictEqual(getSubfield(f650, 'a'), '魔法', '650$a should come from form subjects');
  assert.ok(hasSubfield(f650, 'x'), '650$x should be preserved from extras');
  assert.ok(hasSubfield(f650, 'z'), '650$z should be preserved from extras');
  assert.ok(hasSubfield(f650, '0'), '650$0 should be preserved from extras');
  assert.strictEqual(getSubfield(f650, '2'), 'builtin-zh', '650$2 should prefer authority-derived vocabulary_code');

  const f700 = (recordZh.fields ?? []).find((f) => f && f.tag === '700' && Array.isArray(f.subfields) && getSubfield(f, 'a') === '李四');
  assert.ok(f700, 'missing 700 for 李四');
  assert.strictEqual(getSubfield(f700, 'e'), '譯者', '700$e (relator) should be preserved');
  assert.strictEqual(getSubfield(f700, '4'), 'trl', '700$4 (relator code) should be preserved');

  assertRoundtrips(recordZh, 'zh/084');

  // ----------------------------
  // Case B：英文 → 082；驗證 082 merge
  // ----------------------------

  const bibEn = {
    ...baseBib,
    language: 'en',
    classification: '123.45',
    marc_extras: [
      // 082：保留 edition（$2）與其他子欄位
      { tag: '082', ind1: '0', ind2: '4', subfields: [{ code: 'a', value: 'OLD' }, { code: '2', value: '23' }, { code: 'b', value: 'C' }] },
    ],
  };

  const recordEn = buildMarcRecordFromBibliographic(bibEn, { subjectVocabularyByLabel });

  const en082 = findFirstDataField(recordEn, '082');
  assert.ok(en082, 'missing 082');
  assert.strictEqual(getSubfield(en082, 'a'), '123.45', '082$a should come from form classification');
  assert.strictEqual(getSubfield(en082, '2'), '23', '082$2 should be preserved from extras');
  assert.ok(hasSubfield(en082, 'b'), '082$b should be preserved from extras');

  assertRoundtrips(recordEn, 'en/082');

  console.log('PASS: MARC roundtrip + merge rules (incl. 020/041/082/084)');
}

run();
