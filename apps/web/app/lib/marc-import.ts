/**
 * MARC Import（Web side）
 *
 * 目的：
 * - 在不引入重套件/不走 multipart upload 的前提下，讓前端能讀取：
 *   - ISO2709 `.mrc`（傳統交換格式）
 *   - MARCXML（MARC21 slim）
 *   - MARC-in-JSON（常見交換格式；另也支援本專案 JSON-friendly MarcRecord）
 * - 把 MARC record 映射成「本系統可治理的表單欄位」（title/creators/subjects/...）
 * - 並把「未對映欄位」保留到 `marc_extras`（避免資料匯入即丟失）
 *
 * 重要取捨（v0）：
 * - 我們只保留「未對映 tag」到 marc_extras（避免匯出時重複 245/100/650...）
 * - 對於已對映的 tag（例如 245），若原始資料有額外子欄位（$b/$c...），v0 會先忽略
 *   → 後續做 MARC 編輯器或擴充表單欄位時，再補「保留/合併子欄位」策略
 *
 * v1（本輪補齊）：
 * - 針對「部分對映」tags（245/264/650/700/100），改成 **也保留在 marc_extras**
 * - 由後端匯出時負責 merge（避免重複欄位，同時保留 `$x/$y/$z/$2`、`$e/$4` 等進階子欄位）
 * - 其餘 tags（246/250/300/490/830/505/520/655/更完整 6XX/7XX）本來就會保留在 marc_extras
 */

import type { MarcDataField, MarcField, MarcRecord } from './api';

function isMarcDataField(field: MarcField): field is MarcDataField {
  return (field as any)?.subfields !== undefined;
}

// ----------------------------
// 1) ISO2709 (.mrc) parser（支援多筆 record）
// ----------------------------

export function parseIso2709Records(bytes: ArrayBuffer): MarcRecord[] {
  const buf = new Uint8Array(bytes);
  const records: MarcRecord[] = [];

  let pos = 0;
  while (pos + 24 <= buf.length) {
    const leader = decodeUtf8(buf.subarray(pos, pos + 24));
    const recordLength = parseIntSafe(leader.slice(0, 5));

    // 若 recordLength 不合理，就停止（避免無限迴圈）
    if (!recordLength || recordLength < 25 || pos + recordLength > buf.length) break;

    const recordBytes = buf.subarray(pos, pos + recordLength);
    records.push(parseIso2709Record(recordBytes));
    pos += recordLength;
  }

  return records;
}

function parseIso2709Record(recordBytes: Uint8Array): MarcRecord {
  const leader = decodeUtf8(recordBytes.subarray(0, 24));

  // leader[9]：character coding scheme
  // - 'a' = UCS/Unicode（UTF-8）
  // - ' '（或其他）多數情況代表 MARC-8
  //
  // 本專案目前先不在前端做 MARC-8 轉碼，避免「匯入成功但內容亂碼」。
  const coding = leader[9] ?? ' ';
  if (coding !== 'a') {
    throw new Error(`偵測到非 UTF-8 的 MARC record（leader[9]="${coding}"，可能是 MARC-8）：請先轉成 UTF-8 再匯入`);
  }

  const baseAddress = parseIntSafe(leader.slice(12, 17));
  if (!baseAddress || baseAddress < 25 || baseAddress > recordBytes.length) {
    throw new Error('Invalid ISO2709 leader base address');
  }

  // directory：從 24 開始，遇到 0x1e（field terminator）結束
  const FT = 0x1e;
  const dirEnd = indexOfByte(recordBytes, FT, 24);
  if (dirEnd < 0) throw new Error('Invalid ISO2709: missing directory terminator');

  const directory = recordBytes.subarray(24, dirEnd);
  if (directory.length % 12 !== 0) {
    // 理論上應該是 12 的倍數；若不是，仍嘗試以 floor 解析（避免少數髒資料直接炸掉）
  }

  const fields: MarcField[] = [];
  for (let i = 0; i + 12 <= directory.length; i += 12) {
    const entry = directory.subarray(i, i + 12);
    const tag = decodeUtf8(entry.subarray(0, 3));
    const length = parseIntSafe(decodeUtf8(entry.subarray(3, 7)));
    const start = parseIntSafe(decodeUtf8(entry.subarray(7, 12)));
    if (!/^[0-9]{3}$/.test(tag) || !length || start === null || start === undefined) continue;

    const fieldStart = baseAddress + start;
    const fieldEnd = fieldStart + length;
    if (fieldStart < 0 || fieldEnd > recordBytes.length) continue;

    // 依 directory 定義，length 內含 field terminator（0x1e）；我們剔除尾端 terminator 再解析
    const raw = recordBytes.subarray(fieldStart, fieldEnd);
    const content = raw.length > 0 && raw[raw.length - 1] === FT ? raw.subarray(0, raw.length - 1) : raw;

    const tagNum = Number.parseInt(tag, 10);
    if (Number.isFinite(tagNum) && tagNum < 10) {
      // control field：直接是字串值
      fields.push({ tag, value: decodeUtf8(content) });
    } else {
      fields.push(parseIso2709DataField(tag, content));
    }
  }

  return { leader, fields };
}

function parseIso2709DataField(tag: string, content: Uint8Array): MarcField {
  // datafield 的前兩個 byte 是 ind1/ind2（可能是空白）
  const ind1 = content.length >= 1 ? decodeUtf8(content.subarray(0, 1)) : ' ';
  const ind2 = content.length >= 2 ? decodeUtf8(content.subarray(1, 2)) : ' ';

  const SF = 0x1f;
  const subfields: Array<{ code: string; value: string }> = [];

  // 其餘以 0x1f 分隔：0x1f + code(1 byte) + value(utf-8)
  let i = 2;
  while (i < content.length) {
    if (content[i] !== SF) {
      i += 1;
      continue;
    }

    const code = i + 1 < content.length ? decodeUtf8(content.subarray(i + 1, i + 2)) : '';
    const valueStart = i + 2;
    let j = valueStart;
    while (j < content.length && content[j] !== SF) j += 1;
    const value = decodeUtf8(content.subarray(valueStart, j));

    if (code && code.length === 1) subfields.push({ code, value });
    i = j;
  }

  // 若沒有任何 subfield，仍回傳一個空 subfields（避免 UI crash）；後端會拒絕不合法資料
  return { tag, ind1: ind1 || ' ', ind2: ind2 || ' ', subfields: subfields.length > 0 ? subfields : [{ code: 'a', value: '' }] };
}

function indexOfByte(buf: Uint8Array, value: number, from: number) {
  for (let i = Math.max(0, from); i < buf.length; i += 1) {
    if (buf[i] === value) return i;
  }
  return -1;
}

// TextDecoder 建議重用（避免每次 decode 都 new）
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function decodeUtf8(bytes: Uint8Array) {
  // ISO2709/MARC 常見為 UTF-8 或 MARC-8。
  //
  // v1 策略（先「偵測並拒絕」MARC-8，而不是吞掉亂碼）：
  // - 若來源是 MARC-8（leader[9] 不是 'a'），我們會在 parseIso2709Record 直接報錯
  // - 若 leader 宣告為 UTF-8 但實際 bytes 不是合法 UTF-8，TextDecoder(fatal=true) 會丟錯
  //
  // 取捨：
  // - 不在前端實作完整 MARC-8 → UTF-8 轉碼（ANSEL/escape sequences 很複雜，且容易踩到依賴/授權）
  // - 先要求使用者用外部工具轉碼成 UTF-8，再匯入（確保可重現、也避免「看似成功但其實內容已毀」）
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    throw new Error('Invalid UTF-8 bytes（檔案可能是 MARC-8；請先轉成 UTF-8 再匯入）');
  }
}

function parseIntSafe(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

// ----------------------------
// 2) MARCXML parser（支援 collection/record）
// ----------------------------

export function parseMarcXmlRecords(xmlText: string): MarcRecord[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  // 瀏覽器的 XML parse error 通常會產生 <parsererror> 節點
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error('Invalid XML: parsererror');
  }

  // namespace 可能存在也可能不存在（看來源），兩種都嘗試
  const ns = 'http://www.loc.gov/MARC21/slim';
  const byNs = Array.from(doc.getElementsByTagNameNS(ns, 'record'));
  const byTag = Array.from(doc.getElementsByTagName('record'));

  const recordEls = (byNs.length > 0 ? byNs : byTag) as Element[];
  if (recordEls.length === 0) throw new Error('Invalid MARCXML: no <record> found');

  return recordEls.map((el) => parseMarcXmlRecordElement(el));
}

function parseMarcXmlRecordElement(recordEl: Element): MarcRecord {
  let leader = ' '.repeat(24);
  const fields: MarcField[] = [];

  for (const child of Array.from(recordEl.children)) {
    const local = child.localName;

    if (local === 'leader') {
      leader = (child.textContent ?? '').trim() || leader;
      continue;
    }

    if (local === 'controlfield') {
      const tag = child.getAttribute('tag') ?? '';
      const value = child.textContent ?? '';
      if (/^[0-9]{3}$/.test(tag)) fields.push({ tag, value });
      continue;
    }

    if (local === 'datafield') {
      const tag = child.getAttribute('tag') ?? '';
      const ind1 = child.getAttribute('ind1') ?? ' ';
      const ind2 = child.getAttribute('ind2') ?? ' ';
      if (!/^[0-9]{3}$/.test(tag)) continue;

      const subfields: Array<{ code: string; value: string }> = [];
      for (const sf of Array.from(child.getElementsByTagName('subfield'))) {
        const code = sf.getAttribute('code') ?? '';
        const value = sf.textContent ?? '';
        if (code && code.length === 1) subfields.push({ code, value });
      }

      if (subfields.length > 0) fields.push({ tag, ind1: ind1.slice(0, 1) || ' ', ind2: ind2.slice(0, 1) || ' ', subfields });
      continue;
    }
  }

  return { leader, fields };
}

// ----------------------------
// 3) MARC-in-JSON parser（支援兩種形狀）
// ----------------------------

export function parseMarcJsonRecords(value: unknown): MarcRecord[] {
  // 允許最常見的幾種封裝：
  // - 單筆 MarcRecord
  // - MarcRecord[]
  // - { records: MarcRecord[] }（某些匯出器的 envelope）
  if (Array.isArray(value)) {
    return value.flatMap((v) => parseMarcJsonRecords(v));
  }

  if (!value || typeof value !== 'object') {
    throw new Error('Invalid MARC JSON: expected object/array');
  }

  const obj = value as any;

  if (Array.isArray(obj.records)) return parseMarcJsonRecords(obj.records);

  if (typeof obj.leader === 'string' && Array.isArray(obj.fields)) {
    return [normalizeMarcJsonRecord(obj)];
  }

  throw new Error('Invalid MARC JSON: missing leader/fields');
}

function normalizeMarcJsonRecord(obj: any): MarcRecord {
  const leader = typeof obj.leader === 'string' ? obj.leader : ' '.repeat(24);
  const rawFields = Array.isArray(obj.fields) ? obj.fields : [];

  // 1) 本專案 JSON-friendly 形狀：[{tag, value}|{tag, ind1, ind2, subfields}]
  if (rawFields.length === 0 || rawFields.every((f: any) => f && typeof f === 'object' && typeof f.tag === 'string')) {
    return { leader, fields: rawFields as MarcField[] };
  }

  // 2) 常見 MARC-in-JSON：[{ "001": "..." }, { "245": { ind1, ind2, subfields:[{"a":"..."}, ...] } }]
  const fields: MarcField[] = [];
  for (const entry of rawFields) {
    if (!entry || typeof entry !== 'object') continue;
    const keys = Object.keys(entry);
    if (keys.length !== 1) continue;
    const tag = keys[0] ?? '';
    if (!/^[0-9]{3}$/.test(tag)) continue;

    const v = (entry as any)[tag];
    if (typeof v === 'string') {
      fields.push({ tag, value: v });
      continue;
    }

    if (!v || typeof v !== 'object') continue;
    const ind1 = typeof v.ind1 === 'string' ? v.ind1.slice(0, 1) : ' ';
    const ind2 = typeof v.ind2 === 'string' ? v.ind2.slice(0, 1) : ' ';
    const subfields: Array<{ code: string; value: string }> = [];

    if (Array.isArray(v.subfields)) {
      for (const sf of v.subfields) {
        if (!sf || typeof sf !== 'object') continue;
        const sfKeys = Object.keys(sf);
        if (sfKeys.length !== 1) continue;
        const code = sfKeys[0] ?? '';
        const value = (sf as any)[code];
        if (typeof value !== 'string') continue;
        if (code && code.length === 1) subfields.push({ code, value });
      }
    }

    if (subfields.length > 0) fields.push({ tag, ind1: ind1 || ' ', ind2: ind2 || ' ', subfields });
  }

  return { leader, fields };
}

// ----------------------------
// 4) MARC → 表單欄位（bibs）+ marc_extras
// ----------------------------

export type DerivedBibInput = {
  title: string;
  creators?: string[];
  contributors?: string[];
  publisher?: string;
  published_year?: number;
  language?: string;
  subjects?: string[];
  geographics?: string[];
  genres?: string[];
  isbn?: string;
  classification?: string;
};

export function deriveBibFromMarcRecord(record: MarcRecord): { bib: DerivedBibInput; marc_extras: MarcField[] } {
  const title = deriveTitle(record) ?? '（未提供題名）';
  const creators = deriveNames(record, ['100', '110', '111']);
  const contributors = deriveNames(record, ['700', '710', '711']);
  // 650/651/655：在 MARC21 屬於 6XX（subjects/index terms），但在我們的資料模型中分開治理：
  // - 650：subject（bibliographic_subject_terms）
  // - 651：geographic（bibliographic_geographic_terms）
  // - 655：genre/form（bibliographic_genre_terms）
  const subjects = deriveSubjects(record, ['650']);
  const geographics = deriveSubjects(record, ['651']);
  const genres = deriveSubjects(record, ['655']);
  const publisher = derivePublisher(record);
  const published_year = derivePublishedYear(record);
  const language = deriveLanguage(record);
  const isbn = deriveIsbn(record);
  const classification = deriveClassification(record);

  // marc_extras：保留「我們沒有做成表單欄位」的 tag
  //
  // v1.1（本輪補齊）：
  // - 我們只排除「系統管理」欄位，避免使用者誤以為能覆蓋：
  //   - 000：leader（不是 field tag）
  //   - 001/005：控制號/時間戳（由後端產生）
  // - 其餘欄位都保留進 marc_extras（包含 020/041/082/084），原因：
  //   - 你要求「子欄位不丟」：例如 020$q、041$b、082$2、084$2…
  //   - 匯出時由後端負責 merge（核心 `$a` 仍以表單為準，但會保留 extras 的其他子欄位）
  const dropTags = new Set(['000', '001', '005']);
  const marc_extras = record.fields.filter((f) => !dropTags.has(f.tag));

  const bib: DerivedBibInput = {
    title,
    ...(creators.length > 0 ? { creators } : {}),
    ...(contributors.length > 0 ? { contributors } : {}),
    ...(publisher ? { publisher } : {}),
    ...(published_year ? { published_year } : {}),
    ...(language ? { language } : {}),
    ...(subjects.length > 0 ? { subjects } : {}),
    ...(geographics.length > 0 ? { geographics } : {}),
    ...(genres.length > 0 ? { genres } : {}),
    ...(isbn ? { isbn } : {}),
    ...(classification ? { classification } : {}),
  };

  return { bib, marc_extras };
}

function getDataFields(record: MarcRecord, tag: string) {
  return record.fields.filter((f) => f.tag === tag).filter(isMarcDataField);
}

function getControlFields(record: MarcRecord, tag: string) {
  return record.fields.filter((f) => f.tag === tag).filter((f) => !isMarcDataField(f)) as Array<{ tag: string; value: string }>;
}

function getSubfieldValues(field: MarcDataField, code: string) {
  return (field.subfields ?? [])
    .filter((sf) => sf.code === code)
    .map((sf) => (sf.value ?? '').trim())
    .filter(Boolean);
}

function trimTrailingPunctuation(value: string) {
  // 常見 MARC 子欄位會帶結尾標點（例如 "Title /"）
  return value.replace(/[\\s\\/:;,.]+$/g, '').trim();
}

function deriveTitle(record: MarcRecord) {
  const f245 = getDataFields(record, '245')[0];
  if (!f245) return null;

  const a = getSubfieldValues(f245, 'a')[0] ?? '';
  const b = getSubfieldValues(f245, 'b')[0] ?? '';
  const n = getSubfieldValues(f245, 'n')[0] ?? '';
  const p = getSubfieldValues(f245, 'p')[0] ?? '';

  const parts = [trimTrailingPunctuation(a)];
  if (b) parts.push(trimTrailingPunctuation(b));
  if (n) parts.push(trimTrailingPunctuation(n));
  if (p) parts.push(trimTrailingPunctuation(p));

  const joined = parts.filter(Boolean).join(' : ').trim();
  return joined || null;
}

function deriveNames(record: MarcRecord, tags: string[]) {
  const out: string[] = [];
  for (const tag of tags) {
    for (const f of getDataFields(record, tag)) {
      const names = getSubfieldValues(f, 'a');
      for (const n of names) {
        const cleaned = trimTrailingPunctuation(n);
        if (!cleaned) continue;
        if (!out.includes(cleaned)) out.push(cleaned);
      }
    }
  }
  return out;
}

function deriveSubjects(record: MarcRecord, tags: string[]) {
  const out: string[] = [];
  for (const tag of tags) {
    for (const f of getDataFields(record, tag)) {
      const terms = getSubfieldValues(f, 'a');
      for (const t of terms) {
        const cleaned = trimTrailingPunctuation(t);
        if (!cleaned) continue;
        if (!out.includes(cleaned)) out.push(cleaned);
      }
    }
  }
  return out;
}

function derivePublisher(record: MarcRecord) {
  // RDA 常見 264$b；AACR2 舊資料可能用 260$b
  const f264 = getDataFields(record, '264')[0];
  const f260 = getDataFields(record, '260')[0];
  const v = (f264 ? getSubfieldValues(f264, 'b')[0] : null) ?? (f260 ? getSubfieldValues(f260, 'b')[0] : null);
  return v ? trimTrailingPunctuation(v) : null;
}

function derivePublishedYear(record: MarcRecord) {
  const f264 = getDataFields(record, '264')[0];
  const f260 = getDataFields(record, '260')[0];
  const raw = (f264 ? getSubfieldValues(f264, 'c')[0] : null) ?? (f260 ? getSubfieldValues(f260, 'c')[0] : null);
  if (!raw) return null;
  const m = raw.match(/(\\d{4})/);
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

function deriveLanguage(record: MarcRecord) {
  const f041 = getDataFields(record, '041')[0];
  const v041 = f041 ? getSubfieldValues(f041, 'a')[0] : null;
  if (v041) return v041.trim();

  // 008/35-37：language code（3 chars）
  const f008 = getControlFields(record, '008')[0];
  const v008 = f008?.value ?? '';
  if (v008.length >= 38) {
    const code = v008.slice(35, 38).trim();
    if (code) return code;
  }

  return null;
}

function deriveIsbn(record: MarcRecord) {
  const f020 = getDataFields(record, '020')[0];
  if (!f020) return null;
  const raw = getSubfieldValues(f020, 'a')[0];
  if (!raw) return null;

  // 常見格式："9789573317248 (pbk.)" / "978-957-33-1724-8"
  const m = raw.match(/([0-9Xx-]{10,20})/);
  const token = (m?.[1] ?? raw).trim();
  const cleaned = token.replaceAll('x', 'X');
  return cleaned || null;
}

function deriveClassification(record: MarcRecord) {
  // v0：優先取 082$a（DDC），其次 084$a（其他 scheme）
  const f082 = getDataFields(record, '082')[0];
  const f084 = getDataFields(record, '084')[0];
  const v = (f082 ? getSubfieldValues(f082, 'a')[0] : null) ?? (f084 ? getSubfieldValues(f084, 'a')[0] : null);
  return v ? trimTrailingPunctuation(v) : null;
}
