'use client';

/**
 * MarcFixedFieldEditor（Web）
 *
 * 你希望 MARC 006/008 這種「固定欄位」不要只靠一條字串硬背位置，
 * 而是提供「結構化」的編輯器（更人性化、也更不容易填錯長度）。
 *
 * MARC 固定欄位的本質：
 * - 它不是「子欄位」，而是「位置式（position-based）」編碼：用固定長度字串表示多個屬性。
 * - 因此 UI 的核心就是：把常用位置拆成表單欄位，並回寫到同一個 `value` 字串（單一真相來源）。
 *
 * v1（先落地最常用、可泛用的欄位）：
 * - 008（長度 40）：00-05, 06, 07-10, 11-14, 15-17, 35-37, 38, 39
 * - 006（長度 18）：00（Form of material）+ 01-17 raw（先不硬塞各 material 的細分規格）
 *
 * 重要取捨：
 * - 008/006 的完整規格會依 material type 變化（例如 books vs maps），完整落地會很大；
 *   v1 先做「校務圖書館最常用」且不容易引發誤導的欄位，並保留 raw 讓館員能輸入進階值。
 * - 我們永遠維持 exact_length：不足補空白、超過截斷；這能直接對齊 `MARC21_BIB_FIELDS` 的驗證規則。
 */

import { useMemo } from 'react';

type Props = {
  tag: '006' | '008';
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

function fixedLength(tag: Props['tag']) {
  return tag === '006' ? 18 : 40;
}

function normalizeFixedFieldValue(tag: Props['tag'], value: string) {
  // MARC 固定欄位的空白（blank）語意就是 space，因此我們用空白補齊。
  const len = fixedLength(tag);
  const v = String(value ?? '');
  if (v.length === len) return v;
  if (v.length > len) return v.slice(0, len);
  return v.padEnd(len, ' ');
}

function fitToLength(input: string, len: number) {
  const v = String(input ?? '');
  if (v.length === len) return v;
  if (v.length > len) return v.slice(0, len);
  return v.padEnd(len, ' ');
}

function replaceRange(source: string, start: number, len: number, replacement: string) {
  const left = source.slice(0, start);
  const right = source.slice(start + len);
  return left + fitToLength(replacement, len) + right;
}

function getRange(source: string, start: number, len: number) {
  return source.slice(start, start + len);
}

function getChar(source: string, index: number) {
  return source.slice(index, index + 1);
}

function setChar(source: string, index: number, ch: string) {
  const c = (ch ?? '').slice(0, 1);
  return replaceRange(source, index, 1, c || ' ');
}

// 008/06 Type of date/Publication status（常用）
// - v1 先放常見的幾個 code；仍允許 raw 直接改（避免誤擋）
const _008_DATE_TYPE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: ' ', label: '␠（未填）' },
  { code: 's', label: 's — Single known date/probable date（單一年份）' },
  { code: 'm', label: 'm — Multiple dates（多年間）' },
  { code: 'q', label: 'q — Questionable date（不確定）' },
  { code: 'n', label: 'n — Dates unknown（未知）' },
  { code: 'r', label: 'r — Reprint/reissue date and original date（重印/再版）' },
  { code: 't', label: 't — Publication date and copyright date（出版年+版權年）' },
  { code: 'p', label: 'p — Distribution/release/issue date（發行/上映/發表）' },
];

// 008/38 Modified record（常見）
const _008_MODIFIED_RECORD_OPTIONS: Array<{ code: string; label: string }> = [
  { code: ' ', label: '␠（未修改/未填）' },
  { code: 'd', label: 'd — Dashed on input（含破折號）' },
  { code: 'o', label: 'o — Completely romanized/printed cards romanized（羅馬化）' },
  { code: 's', label: 's — Shortened（縮短）' },
  { code: 'x', label: 'x — Missing characters（缺字）' },
];

// 008/39 Cataloging source（常見）
const _008_CATALOGING_SOURCE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: ' ', label: '␠（未填）' },
  { code: 'c', label: 'c — Cooperative cataloging（合作編目）' },
  { code: 'd', label: 'd — Other（其他）' },
  { code: 'u', label: 'u — Unknown（未知）' },
];

// 006/00 Form of material（常見）
const _006_FORM_OF_MATERIAL_OPTIONS: Array<{ code: string; label: string }> = [
  { code: ' ', label: '␠（未填）' },
  { code: 'a', label: 'a — Language material（語文資料/一般書）' },
  { code: 't', label: 't — Manuscript language material（手稿語文資料）' },
  { code: 'm', label: 'm — Computer file（電腦檔/數位資源）' },
  { code: 'e', label: 'e — Cartographic material（地圖）' },
  { code: 'g', label: 'g — Projected medium（影片/投影媒體）' },
  { code: 'i', label: 'i — Nonmusical sound recording（非音樂錄音）' },
  { code: 'j', label: 'j — Musical sound recording（音樂錄音）' },
  { code: 'c', label: 'c — Notated music（樂譜）' },
];

export function MarcFixedFieldEditor({ tag, value, onChange, disabled }: Props) {
  // normalized：永遠保持 exact_length（讓使用者看得到「空白」也占位）
  const normalized = useMemo(() => normalizeFixedFieldValue(tag, value), [tag, value]);

  function commit(next: string) {
    // commit：把任何變動都 normalize 後回寫（避免 UI 造成不合法長度）
    onChange(normalizeFixedFieldValue(tag, next));
  }

  function setRange(start: number, len: number, replacement: string) {
    commit(replaceRange(normalized, start, len, replacement));
  }

  function setAt(index: number, ch: string) {
    commit(setChar(normalized, index, ch));
  }

  const len = fixedLength(tag);

  // v1 validation（輕量但有感）：
  // - 目標不是「完整 MARC fixed field spec」，而是幫館員在輸入時立刻發現明顯錯誤（例如年份打成中文）
  // - 真正的保存驗證仍會在後端的 MARC field schema 進行（避免繞過 UI）
  const issues = useMemo(() => {
    const out: Array<{ level: 'warning' | 'error'; message: string }> = [];

    if (tag === '008') {
      const dateEntered = getRange(normalized, 0, 6);
      if (dateEntered.trim() && !/^[0-9]{6}$/.test(dateEntered)) {
        out.push({ level: 'warning', message: '008/00-05 應為 6 位數字（YYMMDD）；可留空白但不建議混入其他字元。' });
      }

      const date1 = getRange(normalized, 7, 4);
      if (date1.trim() && !/^[0-9u]{4}$/i.test(date1)) {
        out.push({ level: 'warning', message: '008/07-10 Date1 建議為 4 位（0-9 或 u），例如 2025 / 19uu。' });
      }

      const date2 = getRange(normalized, 11, 4);
      if (date2.trim() && !/^[0-9u]{4}$/i.test(date2)) {
        out.push({ level: 'warning', message: '008/11-14 Date2 建議為 4 位（0-9 或 u），例如 2026 / 19uu。' });
      }

      const lang = getRange(normalized, 35, 3);
      if (lang.trim() && !/^[a-z]{3}$/i.test(lang)) {
        out.push({ level: 'warning', message: '008/35-37 Language 建議為 3 字母 MARC language code，例如 chi / eng。' });
      }
    }

    // 006：v1 只做長度與常用 00 code（其餘 raw 先不硬塞規格）
    if (tag === '006') {
      const form = getChar(normalized, 0);
      if (form && form !== ' ' && !_006_FORM_OF_MATERIAL_OPTIONS.some((o) => o.code === form)) {
        out.push({ level: 'warning', message: '006/00 Form of material 不是常用代碼（仍可存，但建議確認）。' });
      }
    }

    // 保險：normalize 後永遠符合長度；若未來修改 normalize 邏輯，這個檢查能立即提醒
    if (normalized.length !== len) {
      out.push({ level: 'error', message: `fixed field 長度不正確（expect ${len}, got ${normalized.length}）` });
    }

    return out;
  }, [tag, normalized, len]);

  return (
    <div className="callout" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700 }}>Fixed field editor（{tag}）</div>
      <div className="muted" style={{ marginTop: 6 }}>
        這裡把常用位置拆成表單欄位；所有修改都會回寫到同一條 value 字串（長度固定 {len}）。空白以 <code>␠</code> 顯示。
      </div>

      {issues.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          {issues.some((i) => i.level === 'error') ? (
            <div className="error" style={{ whiteSpace: 'pre-wrap' }}>
              {issues
                .filter((i) => i.level === 'error')
                .map((i, idx) => (
                  <div key={idx}>- {i.message}</div>
                ))}
            </div>
          ) : null}
          {issues.some((i) => i.level === 'warning') ? (
            <div className="muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
              {issues
                .filter((i) => i.level === 'warning')
                .map((i, idx) => (
                  <div key={idx}>- {i.message}</div>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
        <div className="muted">normalized value（len={normalized.length}）：</div>
        <div style={{ marginTop: 6, wordBreak: 'break-all' }}>
          <code>{normalized.replaceAll(' ', '␠')}</code>
        </div>
      </div>

      {tag === '008' ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              00-05 Date entered on file（YYMMDD）
              <input
                value={getRange(normalized, 0, 6)}
                onChange={(e) => setRange(0, 6, e.target.value)}
                placeholder="例：251228"
                disabled={disabled}
                inputMode="numeric"
              />
            </label>
            <label>
              06 Type of date / Publication status
              <select
                value={getChar(normalized, 6) === ' ' ? ' ' : getChar(normalized, 6)}
                onChange={(e) => setAt(6, e.target.value)}
                disabled={disabled}
              >
                {_008_DATE_TYPE_OPTIONS.map((o) => (
                  <option key={o.code || 'blank'} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              07-10 Date 1（YYYY）
              <input
                value={getRange(normalized, 7, 4)}
                onChange={(e) => setRange(7, 4, e.target.value)}
                placeholder="例：2025"
                disabled={disabled}
                inputMode="numeric"
              />
            </label>
            <label>
              11-14 Date 2（YYYY）
              <input
                value={getRange(normalized, 11, 4)}
                onChange={(e) => setRange(11, 4, e.target.value)}
                placeholder="例：2026"
                disabled={disabled}
                inputMode="numeric"
              />
            </label>
            <label>
              15-17 Place of publication（3 chars）
              <input
                value={getRange(normalized, 15, 3)}
                onChange={(e) => setRange(15, 3, e.target.value)}
                placeholder="例：ch "
                disabled={disabled}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              35-37 Language（MARC code）
              <input
                value={getRange(normalized, 35, 3)}
                onChange={(e) => setRange(35, 3, e.target.value)}
                placeholder="例：chi"
                list="marc21-language-code-list"
                disabled={disabled}
              />
            </label>
            <label>
              38 Modified record
              <select value={getChar(normalized, 38)} onChange={(e) => setAt(38, e.target.value)} disabled={disabled}>
                {_008_MODIFIED_RECORD_OPTIONS.map((o) => (
                  <option key={o.code || 'blank'} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              39 Cataloging source
              <select value={getChar(normalized, 39)} onChange={(e) => setAt(39, e.target.value)} disabled={disabled}>
                {_008_CATALOGING_SOURCE_OPTIONS.map((o) => (
                  <option key={o.code || 'blank'} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label>
            00 Form of material
            <select value={getChar(normalized, 0)} onChange={(e) => setAt(0, e.target.value)} disabled={disabled}>
              {_006_FORM_OF_MATERIAL_OPTIONS.map((o) => (
                <option key={o.code || 'blank'} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            01-17 raw（依 material type 會有不同意義；v1 先保留 raw）
            <input
              value={getRange(normalized, 1, 17)}
              onChange={(e) => setRange(1, 17, e.target.value)}
              disabled={disabled}
              style={{ fontFamily: 'inherit' }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
