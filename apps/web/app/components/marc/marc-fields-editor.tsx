'use client';

/**
 * MarcFieldsEditor（Web）
 *
 * 你希望「MARC21 所有欄位/子欄位都能操作」，但又不想把前端綁死在某套重型 cataloging UI。
 * 因此這個元件做兩件事：
 * 1) 提供一個通用的「欄位/指標/子欄位」編輯器（不只支援我們目前映射的 245/650…，也支援 5XX/6XX/7XX/9XX）
 * 2) 在不引入外部套件的前提下，做最小但關鍵的結構約束，避免把明顯不合法的形狀送進 API：
 *    - tag 必須是 3 位數字，且不能是 000/001/005（系統管理）
 *    - 00X（001..009）必須是 control field（{tag,value}）
 *    - 010 之後必須是 data field（{tag,ind1,ind2,subfields}）
 *
 * v1.1（本輪補齊）：
 * - 引入「常用 MARC21（BIB）欄位字典」：
 *   - tag 下拉（含 label）
 *   - 指標 ind1/ind2 下拉（或 datalist）
 *   - 子欄位 code 下拉（含子欄位 label）
 *   - per-tag 最小驗證（值型別/必填子欄位/指標合法值）
 */

import { useMemo, useState } from 'react';

import {
  applyMarcIndicatorsForVocabulary,
  formatAuthorityControlNumber,
  getMarcAuthorityLinkingRuleByTag,
} from '@library-system/shared';

import type { AuthorityTerm, MarcDataField, MarcField, MarcSubfield } from '../../lib/api';
import { suggestAuthorityTerms } from '../../lib/api';
import { MarcFixedFieldEditor } from './marc-fixed-field-editor';
import {
  createEmptyFieldFromSpec,
  getMarc21FieldSpec,
  getSubfieldSpec,
  isSystemManagedTag,
  listMarc21FieldSpecs,
  normalizeIndicator,
  validateMarcFieldWithDictionary,
  type Marc21DataFieldSpec,
} from '../../lib/marc21';
import { formatErrorMessage } from '../../lib/error';

// relator（700$e / 700$4）常用值（datalist 建議；仍允許輸入其他值）
// - 你之後若要做成「DB 驅動的 controlled vocab」，可以把這份清單搬到 authority_terms（kind=relator）再由 API 提供。
const MARC_RELATOR_CODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'aut', label: 'aut — Author（作者/著者）' },
  { value: 'trl', label: 'trl — Translator（譯者）' },
  { value: 'ill', label: 'ill — Illustrator（插畫者）' },
  { value: 'edt', label: 'edt — Editor（編者）' },
  { value: 'ctb', label: 'ctb — Contributor（貢獻者）' },
  { value: 'cmp', label: 'cmp — Composer（作曲者）' },
  { value: 'drt', label: 'drt — Director（導演）' },
  { value: 'nrt', label: 'nrt — Narrator（旁白）' },
];

const MARC_RELATOR_TERM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '著者', label: '著者' },
  { value: '作者', label: '作者' },
  { value: '譯者', label: '譯者' },
  { value: '編者', label: '編者' },
  { value: '插畫者', label: '插畫者' },
  { value: '導演', label: '導演' },
  { value: '旁白', label: '旁白' },
];

// language code：常用 MARC language codes（041$a 等）
// - 這份清單只做「常用提示」，不做完整 ISO639/MARC 全表（太大，建議之後改成資料表或外部檔案 seed）
const MARC_LANGUAGE_CODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'chi', label: 'chi — Chinese（中文）' },
  { value: 'zho', label: 'zho — Chinese（中文；ISO639-2）' },
  { value: 'eng', label: 'eng — English（英文）' },
  { value: 'jpn', label: 'jpn — Japanese（日文）' },
  { value: 'kor', label: 'kor — Korean（韓文）' },
  { value: 'fre', label: 'fre — French（法文；bibliographic）' },
  { value: 'fra', label: 'fra — French（法文；terminologic）' },
  { value: 'ger', label: 'ger — German（德文；bibliographic）' },
  { value: 'deu', label: 'deu — German（德文；terminologic）' },
  { value: 'spa', label: 'spa — Spanish（西班牙文）' },
  { value: 'rus', label: 'rus — Russian（俄文）' },
  { value: 'ara', label: 'ara — Arabic（阿拉伯文）' },
  { value: 'vie', label: 'vie — Vietnamese（越南文）' },
  { value: 'tha', label: 'tha — Thai（泰文）' },
  { value: 'mul', label: 'mul — Multiple languages（多語）' },
  { value: 'und', label: 'und — Undetermined（未定）' },
];

// 常用 tag 快捷新增（讓館員不用記 3 位數字也能快速開始）
// - v1：先放「書目編目最常用」的欄位（你之後可依校內實務再擴充）
// - 注意：這只影響「新增 UI」，不影響你仍可自由輸入其他 tag（MARC 是開放集合）
const COMMON_MARC_TAGS = ['245', '264', '300', '336', '337', '338', '490', '500', '520', '650', '651', '655', '700', '830', '856'] as const;

function getSubfieldValueDatalistId(tag: string, subfieldCode: string) {
  // 100/700/710/711/720：常見使用 relator 的欄位
  const relatorTags = new Set(['100', '700', '710', '711', '720']);
  if (relatorTags.has(tag)) {
    if (subfieldCode === '4') return 'marc21-relator-code-list';
    if (subfieldCode === 'e') return 'marc21-relator-term-list';
  }

  // 041$a：language code（也常出現在 040$b）
  if (tag === '041') {
    const langSubfields = new Set(['a', 'b', 'd', 'e', 'f', 'g', 'h', 'j']);
    if (langSubfields.has(subfieldCode)) return 'marc21-language-code-list';
  }
  if (tag === '040' && subfieldCode === 'b') return 'marc21-language-code-list';

  return undefined;
}

function isMarcDataField(field: MarcField): field is MarcDataField {
  return (field as any)?.subfields !== undefined;
}

function normalizeTagForEdit(input: string) {
  // 編輯時不做 padding（避免使用者還沒輸入完就被強制補 0），只保留數字並截到 3 位。
  return input.replaceAll(/[^0-9]/g, '').slice(0, 3);
}

function normalizeTagForAdd(input: string) {
  // 新增欄位時做 padding（例如輸入 20 → 020；輸入 8 → 008）
  const digits = input.replaceAll(/[^0-9]/g, '').slice(0, 3);
  if (!digits) return '';
  return digits.padStart(3, '0');
}

function isControlTag(tag: string) {
  // MARC 21：001..009 是 control fields；010 之後才有 indicators/subfields
  if (!/^[0-9]{3}$/.test(tag)) return false;
  const n = Number.parseInt(tag, 10);
  return Number.isFinite(n) && n < 10;
}

function normalizeSubfieldCode(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? '' : trimmed.slice(0, 1);
}

function getAuthorityKindForMarcTag(tag: string): AuthorityTerm['kind'] | null {
  // 重要：authority helper 只在「真的做 term_id linking」的欄位出現。
  // - 我們用 shared mapping 判斷（避免 Web/API 各自寫一套規則）
  // - 若某 tag 沒有 authority_control_number_subfield_code（例如 041），就不顯示 helper（避免誤導）
  const rule = getMarcAuthorityLinkingRuleByTag(String(tag ?? '').trim());
  if (!rule) return null;
  if (!rule.authority_control_number_subfield_code) return null;
  return rule.kind as AuthorityTerm['kind'];
}

function findFirstSubfieldValue(field: MarcDataField, code: string) {
  const c = String(code ?? '').trim();
  const sf = (field.subfields ?? []).find((x) => String((x as any)?.code ?? '').trim() === c);
  const v = sf ? String((sf as any)?.value ?? '').trim() : '';
  return v || null;
}

function applyAuthorityTermToMarcDataField(field: MarcDataField, term: AuthorityTerm): MarcDataField {
  // 目前支援：
  // - 650/651/655：subject/geographic/genre → `$a/$0/$2`（且依 tag 套用指標規則）
  // - 100/700/710/711/720：name → `$a/$0`（不使用 $2；name 欄位通常不靠 $2 表達來源）
  // - $a：heading/term（用 preferred_label）
  // - $0：authority term id（urn:uuid:<uuid>）
  // - $2：vocabulary_code（並把 indicator 設為 7）
  //   - 650/651：ind2=7（Source specified in $2）
  //   - 655：ind1=7（Source specified in $2）
  //
  // 其他子欄位（$x/$y/$z/$v/$6/$8...）保留，讓館員能補進階細節。
  const tag = String((field as any)?.tag ?? '').trim();
  const vocab = String(term.vocabulary_code ?? '').trim();

  // 指標規則（單一真相來源）：由 shared mapping 決定
  // - 650/651：ind2=7 當且僅當 $2 有值；否則回到 4
  // - 655：ind1=7 當且僅當 $2 有值；否則回到 0
  const nextIndicators = applyMarcIndicatorsForVocabulary(tag, { ind1: field.ind1 ?? ' ', ind2: field.ind2 ?? ' ' }, vocab);

  const nextSubfields = (field.subfields ?? []).slice();

  // $a：若已存在就覆蓋第一筆；否則插在最前面（讓 merge/顯示更一致）
  const aIndex = nextSubfields.findIndex((sf) => String((sf as any)?.code ?? '').trim() === 'a');
  if (aIndex >= 0) {
    nextSubfields[aIndex] = { ...nextSubfields[aIndex]!, value: term.preferred_label };
  } else {
    nextSubfields.unshift({ code: 'a', value: term.preferred_label });
  }

  // $0：只替換「本系統的 urn:uuid」；外部 $0 URI/control number 保留
  const urn = formatAuthorityControlNumber(term.id);
  const existingUrn0Index = nextSubfields.findIndex((sf) => {
    if (String((sf as any)?.code ?? '').trim() !== '0') return false;
    const v = String((sf as any)?.value ?? '').trim();
    return /^urn:uuid:/i.test(v);
  });
  if (existingUrn0Index >= 0) {
    nextSubfields[existingUrn0Index] = { ...nextSubfields[existingUrn0Index]!, value: urn };
  } else {
    nextSubfields.push({ code: '0', value: urn });
  }

  // $2：只在 6XX（650/651/655）使用；name 欄位不自動填 $2
  const is6xx = tag === '650' || tag === '651' || tag === '655';
  if (is6xx) {
    if (vocab) {
      const index2 = nextSubfields.findIndex((sf) => String((sf as any)?.code ?? '').trim() === '2');
      if (index2 >= 0) nextSubfields[index2] = { ...nextSubfields[index2]!, value: vocab };
      else nextSubfields.push({ code: '2', value: vocab });
    }
  }

  return { ...field, ind1: nextIndicators.ind1, ind2: nextIndicators.ind2, subfields: nextSubfields };
}

type Props = {
  // orgId：若提供，MARC 編輯器可啟用「authority term 查詢/連結」輔助
  // - 因為 suggest API 是 multi-tenant（必須知道 orgId）
  orgId?: string;
  value: MarcField[];
  onChange: (next: MarcField[]) => void;
  disabled?: boolean;
};

type AuthorityPickerState = {
  fieldIndex: number;
  tag: string;
  kind: AuthorityTerm['kind'];
  q: string;
  vocabularyCode: string;
  suggesting: boolean;
  suggestions: AuthorityTerm[] | null;
  error: string | null;
};

function pickNextSubfieldCode(spec: Marc21DataFieldSpec | null, existing: MarcSubfield[]) {
  if (!spec) return 'a';

  const existingCodes = new Set(existing.map((sf) => (sf.code ?? '').trim()).filter(Boolean));
  const repeatableByCode = new Map(spec.subfields.map((s) => [s.code, s.repeatable !== false]));

  const orderedCandidates = ['a', ...spec.subfields.map((s) => s.code).filter((c) => c !== 'a')];
  for (const code of orderedCandidates) {
    if (!code) continue;
    const repeatable = repeatableByCode.get(code);
    if (repeatable === false && existingCodes.has(code)) continue;
    return code;
  }

  return 'a';
}

export function MarcFieldsEditor({ orgId, value, onChange, disabled }: Props) {
  // 新增欄位：讓使用者可直接輸入 tag（例如 245/650/520），再按新增。
  const [newTag, setNewTag] = useState('');

  // authority helper：只有在提供 orgId 時才啟用（因為 suggest API 是 multi-tenant）
  const authorityEnabled = Boolean((orgId ?? '').trim());
  const [authorityPicker, setAuthorityPicker] = useState<AuthorityPickerState | null>(null);

  function toggleAuthorityPicker(fieldIndex: number, tag: string) {
    if (!authorityEnabled) return;
    const kind = getAuthorityKindForMarcTag(tag);
    if (!kind) return;

    setAuthorityPicker((prev) => {
      // 同一個 field 再按一次 → close（避免 UI 佔空間）
      if (prev && prev.fieldIndex === fieldIndex) return null;

      return {
        fieldIndex,
        tag,
        kind,
        q: '',
        vocabularyCode: '',
        suggesting: false,
        suggestions: null,
        error: null,
      };
    });
  }

  async function runAuthoritySuggest() {
    if (!authorityEnabled) return;
    if (!authorityPicker) return;

    const q = authorityPicker.q.trim();
    if (!q) return;

    setAuthorityPicker((prev) => (prev ? { ...prev, suggesting: true, error: null } : prev));
    try {
      const result = await suggestAuthorityTerms((orgId ?? '').trim(), {
        kind: authorityPicker.kind,
        q,
        ...(authorityPicker.vocabularyCode.trim() ? { vocabulary_code: authorityPicker.vocabularyCode.trim() } : {}),
        limit: 20,
      });
      setAuthorityPicker((prev) => (prev ? { ...prev, suggesting: false, suggestions: result } : prev));
    } catch (e) {
      setAuthorityPicker((prev) => (prev ? { ...prev, suggesting: false, suggestions: null, error: formatErrorMessage(e) } : prev));
    }
  }

  // 先算一次 validation（避免每次 render 都重跑多次）
  const fieldIssues = useMemo(() => {
    const perField = value.map((f) => validateMarcFieldWithDictionary(f));

    // repeatable=false（字典級）：同 tag 在 marc_extras 內不可重複
    // - 這可避免匯出時產生不必要的重複欄位（例如 245/100）
    const indexesByTag = new Map<string, number[]>();
    value.forEach((f, idx) => {
      const tag = String((f as any)?.tag ?? '').trim();
      if (!tag) return;
      const arr = indexesByTag.get(tag);
      if (arr) arr.push(idx);
      else indexesByTag.set(tag, [idx]);
    });

    for (const [tag, idxs] of indexesByTag.entries()) {
      const spec = getMarc21FieldSpec(tag);
      if (!spec) continue;
      if (spec.repeatable !== false) continue;
      if (idxs.length <= 1) continue;

      for (const dupIndex of idxs.slice(1)) {
        perField[dupIndex]?.push({
          level: 'error',
          path: ['tag'],
          message: `tag ${tag} 在字典中標記為不可重複（repeatable=false）`,
        });
      }
    }

    return perField;
  }, [value]);
  const hasAnyError = fieldIssues.some((issues) => issues.some((i) => i.level === 'error'));
  const hasAnyWarning = fieldIssues.some((issues) => issues.some((i) => i.level === 'warning'));

  function setAt(index: number, next: MarcField) {
    const out = value.slice();
    out[index] = next;
    onChange(out);
  }

  function applyAuthorityTermToActiveField(term: AuthorityTerm) {
    if (!authorityPicker) return;
    const idx = authorityPicker.fieldIndex;
    const current = value[idx];
    if (!current || !isMarcDataField(current)) return;

    const tag = String((current as any)?.tag ?? '').trim();
    if (authorityPicker.tag !== tag) {
      setAuthorityPicker((prev) => (prev ? { ...prev, error: '此欄位已變更 tag/順序（請重新開啟 authority helper）' } : prev));
      return;
    }
    const kind = getAuthorityKindForMarcTag(tag);
    if (!kind) {
      setAuthorityPicker((prev) => (prev ? { ...prev, error: `tag ${tag} 目前未啟用 authority linking helper` } : prev));
      return;
    }
    if (term.kind !== kind) {
      setAuthorityPicker((prev) =>
        prev
          ? { ...prev, error: `選到的 term.kind=${term.kind} 與 tag ${tag} 對映 kind=${kind} 不一致（請改用正確的詞彙庫）` }
          : prev,
      );
      return;
    }

    setAt(idx, applyAuthorityTermToMarcDataField(current, term));
  }

  function removeAt(index: number) {
    const out = value.slice();
    out.splice(index, 1);
    onChange(out);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const out = value.slice();
    const tmp = out[index]!;
    out[index] = out[target]!;
    out[target] = tmp;
    onChange(out);
  }

  function duplicateAt(index: number) {
    const out = value.slice();
    out.splice(index + 1, 0, JSON.parse(JSON.stringify(value[index]!)));
    onChange(out);
  }

  function coerceFieldShapeByTag(prev: MarcField, tag: string): MarcField {
    // 只有在 tag 已經是完整 3 位數字時才做形狀轉換；未完成輸入時保持原形狀，避免 UX 太跳。
    if (!/^[0-9]{3}$/.test(tag) || tag === '000') return { ...(prev as any), tag } as MarcField;

    const spec = getMarc21FieldSpec(tag);
    const shouldBeControl = spec ? spec.kind === 'control' : isControlTag(tag);
    if (shouldBeControl) {
      // data → control：會丟掉 indicators/subfields（因為控制欄位語意不同）
      // - 但若字典有定 exact_length（例如 006/008），我們希望直接補滿空白，讓它立刻符合驗證規則。
      return createEmptyFieldFromSpec(tag) as MarcField;
    }

    // control → data：補上 ind/subfields（至少一個 $a）
    if (!isMarcDataField(prev)) return createEmptyFieldFromSpec(tag) as MarcField;

    // data → data：只改 tag，其他保留
    return { ...prev, tag };
  }

  function onAddField() {
    const tag = normalizeTagForAdd(newTag);
    if (!tag) return;
    if (!/^[0-9]{3}$/.test(tag) || tag === '000') return;
    if (isSystemManagedTag(tag)) return;

    const nextField: MarcField = createEmptyFieldFromSpec(tag);
    onChange([...value, nextField]);
    setNewTag('');
  }

  function addFieldByTag(tag: string) {
    // 與 onAddField 相同的保護（避免新增後「儲存才失敗」）
    if (!/^[0-9]{3}$/.test(tag) || tag === '000') return;
    if (isSystemManagedTag(tag)) return;
    onChange([...value, createEmptyFieldFromSpec(tag)]);
  }

  return (
    <div className="stack">
      <div className={hasAnyError || hasAnyWarning ? 'callout warn' : 'callout'}>
        <div className="muted">
          編輯的是 <code>marc_extras</code>（保留/編輯「表單未覆蓋」的 MARC 欄位）。<code>001</code>/<code>005</code> 由系統產生，
          不會也不應該在 <code>marc_extras</code> 內覆蓋。
        </div>
        {hasAnyError ? <div className="error" style={{ marginTop: 6 }}>目前有欄位結構不合法；後端儲存時會拒絕。</div> : null}
        {!hasAnyError && hasAnyWarning ? <div className="muted" style={{ marginTop: 6 }}>目前有一些警告（仍可儲存），但可能影響交換/匯出一致性。</div> : null}
      </div>

      {value.length === 0 ? <div className="muted">目前 marc_extras 是空的（[]）。</div> : null}

      {value.map((field, index) => {
        const tag = (field as any)?.tag ?? '';
        const issues = fieldIssues[index] ?? [];
        const errors = issues.filter((i) => i.level === 'error');
        const warnings = issues.filter((i) => i.level === 'warning');
        const isData = isMarcDataField(field);
        const spec = getMarc21FieldSpec(String(tag));
        const dataSpec = spec?.kind === 'data' ? (spec as Marc21DataFieldSpec) : null;

        return (
          <div key={`${index}-${tag}`} className="callout">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ width: 140 }}>
                tag
                <input
                  value={tag}
                  onChange={(e) => {
                    const nextTag = normalizeTagForEdit(e.target.value);
                    setAt(index, coerceFieldShapeByTag(field, nextTag));
                  }}
                  placeholder="例：245"
                  list="marc21-tag-list"
                  disabled={disabled}
                />
              </label>

              {isData ? (
                <>
                  <label style={{ width: 90 }}>
                    ind1
                    {dataSpec && !dataSpec.indicators[0].allow_other ? (
                      <select
                        value={normalizeIndicator(field.ind1 ?? '')}
                        onChange={(e) => setAt(index, { ...field, ind1: e.target.value ? e.target.value : ' ' })}
                        disabled={disabled}
                      >
                        {(() => {
                          const current = normalizeIndicator(field.ind1 ?? '');
                          const allowed = new Set(dataSpec.indicators[0].options.map((o) => o.code));
                          const out: Array<{ value: string; label: string }> = [];
                          if (current && !allowed.has(current)) out.push({ value: current, label: `（不合法）${current}` });
                          if (current === '' && !allowed.has('')) out.push({ value: '', label: '（不合法）␠' });
                          for (const opt of dataSpec.indicators[0].options) out.push({ value: opt.code, label: opt.label });
                          return out;
                        })().map((opt) => (
                          <option key={opt.value || 'blank'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                        ) : (
                          <>
                            <input
                              value={normalizeIndicator(field.ind1 ?? '')}
                              onChange={(e) => {
                                const v = e.target.value.slice(0, 1);
                                setAt(index, { ...field, ind1: v ? v : ' ' });
                              }}
                              placeholder=" "
                              list={dataSpec ? `marc21-${index}-${tag}-ind1` : undefined}
                              disabled={disabled}
                            />
                            {dataSpec ? (
                              <datalist id={`marc21-${index}-${tag}-ind1`}>
                                {dataSpec.indicators[0].options.map((o) => (
                                  <option key={o.code || 'blank'} value={o.code}>
                                    {o.label}
                                  </option>
                                ))}
                              </datalist>
                        ) : null}
                      </>
                    )}
                  </label>
                  <label style={{ width: 90 }}>
                    ind2
                    {dataSpec && !dataSpec.indicators[1].allow_other ? (
                      <select
                        value={normalizeIndicator(field.ind2 ?? '')}
                        onChange={(e) => setAt(index, { ...field, ind2: e.target.value ? e.target.value : ' ' })}
                        disabled={disabled}
                      >
                        {(() => {
                          const current = normalizeIndicator(field.ind2 ?? '');
                          const allowed = new Set(dataSpec.indicators[1].options.map((o) => o.code));
                          const out: Array<{ value: string; label: string }> = [];
                          if (current && !allowed.has(current)) out.push({ value: current, label: `（不合法）${current}` });
                          if (current === '' && !allowed.has('')) out.push({ value: '', label: '（不合法）␠' });
                          for (const opt of dataSpec.indicators[1].options) out.push({ value: opt.code, label: opt.label });
                          return out;
                        })().map((opt) => (
                          <option key={opt.value || 'blank'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                        ) : (
                          <>
                            <input
                              value={normalizeIndicator(field.ind2 ?? '')}
                              onChange={(e) => {
                                const v = e.target.value.slice(0, 1);
                                setAt(index, { ...field, ind2: v ? v : ' ' });
                              }}
                              placeholder=" "
                              list={dataSpec ? `marc21-${index}-${tag}-ind2` : undefined}
                              disabled={disabled}
                            />
                            {dataSpec ? (
                              <datalist id={`marc21-${index}-${tag}-ind2`}>
                                {dataSpec.indicators[1].options.map((o) => (
                                  <option key={o.code || 'blank'} value={o.code}>
                                    {o.label}
                                  </option>
                                ))}
                              </datalist>
                        ) : null}
                      </>
                    )}
                  </label>
                </>
              ) : (
                <div className="muted">{spec ? spec.label : 'control field'}</div>
              )}

              {isData && spec ? <div className="muted">{spec.label}</div> : null}

              <div style={{ flex: 1 }} />

              <button type="button" onClick={() => move(index, -1)} disabled={disabled || index === 0}>
                ↑
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={disabled || index === value.length - 1}>
                ↓
              </button>
              <button type="button" onClick={() => duplicateAt(index)} disabled={disabled}>
                複製
              </button>
              <button type="button" onClick={() => removeAt(index)} disabled={disabled}>
                刪除
              </button>
            </div>

            {/* authority linking helper：把 650/651/655 做成真正的 term-based（$0=urn:uuid + $2 + 650/651:ind2=7; 655:ind1=7） */}
            {(() => {
              if (!authorityEnabled) return null;
              if (!isData) return null;

              const authorityKind = getAuthorityKindForMarcTag(String(tag));
              if (!authorityKind) return null;

              const internalUrn0 =
                (field.subfields ?? [])
                  .filter((sf) => String((sf as any)?.code ?? '').trim() === '0')
                  .map((sf) => String((sf as any)?.value ?? '').trim())
                  .find((v) => /^urn:uuid:/i.test(v)) ?? null;
              const current2 = findFirstSubfieldValue(field, '2');

              const isOpen = authorityPicker?.fieldIndex === index && authorityPicker?.tag === String(tag);
              const state = isOpen ? authorityPicker : null;

              return (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(0,0,0,0.15)' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="muted">
                      authority linking：<code>{authorityKind}</code>
                    </div>
                    <div className="muted">
                      $0：{internalUrn0 ? <code>{internalUrn0}</code> : <span>（未連結）</span>}
                    </div>
                    {current2 ? (
                      <div className="muted">
                        $2：<code>{current2}</code>
                      </div>
                    ) : null}
                    <button type="button" onClick={() => toggleAuthorityPicker(index, String(tag))} disabled={disabled}>
                      {isOpen ? '關閉' : '搜尋/連結'}
                    </button>
                  </div>

                  {isOpen && state ? (
                    <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          value={state.q}
                          onChange={(e) => setAuthorityPicker((prev) => (prev ? { ...prev, q: e.target.value } : prev))}
                          placeholder="輸入關鍵字（例：汰舊 / 台灣 / 少年小說）"
                          disabled={disabled}
                          style={{ minWidth: 240 }}
                        />
                        <input
                          value={state.vocabularyCode}
                          onChange={(e) =>
                            setAuthorityPicker((prev) => (prev ? { ...prev, vocabularyCode: e.target.value } : prev))
                          }
                          placeholder="vocabulary_code（選填；例：local / builtin-zh）"
                          disabled={disabled}
                          style={{ minWidth: 220 }}
                        />
                        <button
                          type="button"
                          onClick={() => void runAuthoritySuggest()}
                          disabled={disabled || state.suggesting || !state.q.trim()}
                        >
                          {state.suggesting ? '查詢中…' : '查詢'}
                        </button>
                      </div>

                      {state.error ? <div className="error">錯誤：{state.error}</div> : null}

                      {state.suggestions ? (
                        state.suggestions.length === 0 ? (
                          <div className="muted">找不到結果（可嘗試縮短關鍵字或換 vocabulary_code）。</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 6 }}>
                            {state.suggestions.map((t) => (
                              <div
                                key={t.id}
                                style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
                              >
                                <button type="button" onClick={() => applyAuthorityTermToActiveField(t)} disabled={disabled}>
                                  套用
                                </button>
                                <div>
                                  {t.preferred_label}{' '}
                                  <span className="muted">
                                    （{t.vocabulary_code} / {t.status}）
                                  </span>
                                </div>
                                <div className="muted">
                                  $0：<code>{formatAuthorityControlNumber(t.id)}</code>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="muted">尚未查詢。</div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {!isData ? (
              <div style={{ marginTop: 12 }}>
                {/* 006/008：固定欄位（position-based）→ 先提供結構化 editor，並保留 raw textarea 作為 fallback */}
                {tag === '006' || tag === '008' ? (
                  <MarcFixedFieldEditor
                    tag={tag}
                    value={(field as any).value ?? ''}
                    onChange={(next) => setAt(index, { tag: String(tag), value: next })}
                    disabled={disabled}
                  />
                ) : null}

                <label style={{ marginTop: 12 }}>
                  value（raw）
                  <textarea
                    value={(field as any).value ?? ''}
                    onChange={(e) => setAt(index, { tag: String(tag), value: e.target.value })}
                    rows={2}
                    disabled={disabled}
                  />
                </label>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ marginBottom: 8 }}>
                  subfields（可重複；順序會影響輸出）
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {(field.subfields ?? []).map((sf: MarcSubfield, sfIndex: number) => (
                    <div key={`${sfIndex}-${sf.code}`} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 8 }}>
                      {/*
                        subfield code UI：
                        - strict（subfields_allow_other=false）→ select（選項含 label）
                        - lax（允許其他 code）→ input + datalist（仍提供常用下拉）
                        - 為了提升可理解性，我們也加上 title tooltip（hover 可看該 code 的意義）
                       */}
                      {dataSpec && dataSpec.subfields_allow_other === false ? (
                        <select
                          value={sf.code}
                          onChange={(e) => {
                            const nextCode = normalizeSubfieldCode(e.target.value);
                            const out = field.subfields.slice();
                            out[sfIndex] = { ...sf, code: nextCode };
                            setAt(index, { ...field, subfields: out });
                          }}
                          title={(() => {
                            const s = dataSpec ? getSubfieldSpec(dataSpec, sf.code) : null;
                            return s ? `$${sf.code} — ${s.label}` : '';
                          })()}
                          disabled={disabled}
                        >
                          {(() => {
                            const allowed = new Set(dataSpec.subfields.map((s) => s.code));
                            const opts: Array<{ code: string; label: string }> = [];
                            if (sf.code && !allowed.has(sf.code)) opts.push({ code: sf.code, label: `（不在字典）$${sf.code}` });
                            for (const s of dataSpec.subfields) opts.push({ code: s.code, label: `${s.code} — ${s.label}${s.managed_by_form ? '（表單治理）' : ''}` });
                            return opts;
                          })().map((o) => (
                            <option key={o.code || 'blank'} value={o.code}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            value={sf.code}
                            onChange={(e) => {
                              const nextCode = normalizeSubfieldCode(e.target.value);
                              const out = field.subfields.slice();
                              out[sfIndex] = { ...sf, code: nextCode };
                              setAt(index, { ...field, subfields: out });
                            }}
                            placeholder="a"
                            list={dataSpec ? `marc21-${index}-${tag}-subfields-${sfIndex}` : undefined}
                            title={(() => {
                              const s = dataSpec ? getSubfieldSpec(dataSpec, sf.code) : null;
                              return s ? `$${sf.code} — ${s.label}` : '';
                            })()}
                            disabled={disabled}
                          />
                          {dataSpec ? (
                            <datalist id={`marc21-${index}-${tag}-subfields-${sfIndex}`}>
                              {dataSpec.subfields.map((s) => (
                                <option
                                  key={s.code}
                                  value={s.code}
                                  label={`${s.code} — ${s.label}${s.managed_by_form ? '（表單治理）' : ''}`}
                                />
                              ))}
                            </datalist>
                          ) : null}
                        </>
                      )}

                      {(() => {
                        const sfSpec = dataSpec ? getSubfieldSpec(dataSpec, sf.code) : null;
                        const placeholder =
                          sfSpec?.value_kind === 'url'
                            ? 'https://...'
                            : sfSpec?.value_kind === 'issn'
                              ? '####-####'
                            : sfSpec?.value_kind === 'year'
                              ? 'YYYY'
                              : 'value';

                        return (
                          <input
                            value={sf.value}
                            onChange={(e) => {
                              const out = field.subfields.slice();
                              out[sfIndex] = { ...sf, value: e.target.value };
                              setAt(index, { ...field, subfields: out });
                            }}
                            placeholder={placeholder}
                            list={getSubfieldValueDatalistId(String(tag), String(sf.code ?? ''))}
                            title={sfSpec ? `${sfSpec.label}${sfSpec.managed_by_form ? '（表單治理會覆蓋）' : ''}` : ''}
                            disabled={disabled}
                          />
                        );
                      })()}

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const target = sfIndex - 1;
                            if (target < 0) return;
                            const out = field.subfields.slice();
                            const tmp = out[sfIndex]!;
                            out[sfIndex] = out[target]!;
                            out[target] = tmp;
                            setAt(index, { ...field, subfields: out });
                          }}
                          disabled={disabled || sfIndex === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = sfIndex + 1;
                            if (target >= field.subfields.length) return;
                            const out = field.subfields.slice();
                            const tmp = out[sfIndex]!;
                            out[sfIndex] = out[target]!;
                            out[target] = tmp;
                            setAt(index, { ...field, subfields: out });
                          }}
                          disabled={disabled || sfIndex === field.subfields.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // 複製：常見於 $a/$x/$y/$z 多段補充時（比手動新增再 copy value 快）
                            const out = field.subfields.slice();
                            out.splice(sfIndex + 1, 0, { ...sf });
                            setAt(index, { ...field, subfields: out });
                          }}
                          disabled={disabled}
                        >
                          複
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const out = field.subfields.slice();
                            out.splice(sfIndex, 1);

                            // 若刪到 0 個 subfields：補一個空 $a（避免 data field 變成不合法形狀）
                            if (out.length === 0) out.push({ code: 'a', value: '' });
                            setAt(index, { ...field, subfields: out });
                          }}
                          disabled={disabled}
                        >
                          刪
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const nextCode = pickNextSubfieldCode(dataSpec, field.subfields);
                      setAt(index, { ...field, subfields: [...field.subfields, { code: nextCode, value: '' }] });
                    }}
                    disabled={disabled}
                  >
                    新增 subfield
                  </button>
                </div>
              </div>
            )}

            {errors.length > 0 ? (
              <div className="error" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                {errors.map((issue, i) => (
                  <div key={i}>
                    - {issue.path.length > 0 ? `${issue.path.join('.')}：` : ''}
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="muted" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                {warnings.map((issue, i) => (
                  <div key={i}>
                    - {issue.path.length > 0 ? `${issue.path.join('.')}：` : ''}
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="callout">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ width: 180 }}>
            新增欄位（tag）
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="例：520 / 650 / 008"
              list="marc21-tag-list"
              disabled={disabled}
            />
          </label>

          <button type="button" onClick={onAddField} disabled={disabled || !normalizeTagForAdd(newTag)}>
            新增
          </button>

          <div className="muted">
            小技巧：輸入 <code>8</code> 會自動變成 <code>008</code>；輸入 <code>20</code> → <code>020</code>。
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <div className="muted" style={{ alignSelf: 'center' }}>
            常用快速新增：
          </div>
          {COMMON_MARC_TAGS.map((t) => {
            const spec = getMarc21FieldSpec(t);
            const label = spec ? spec.label : t;
            return (
              <button key={t} type="button" onClick={() => addFieldByTag(t)} disabled={disabled} title={label} className="btnSmall">
                {t}
              </button>
            );
          })}
        </div>

        {/* 讓使用者立即知道哪些 tag 不能加（避免「新增了但儲存失敗」） */}
        {(() => {
          const tag = normalizeTagForAdd(newTag);
          if (!tag) return null;
          if (!/^[0-9]{3}$/.test(tag) || tag === '000') return <div className="error" style={{ marginTop: 8 }}>tag 必須是 3 位數字，且不能是 000。</div>;
          if (isSystemManagedTag(tag)) return <div className="error" style={{ marginTop: 8 }}>000/001/005 為系統管理欄位，不可新增。</div>;
          return null;
        })()}
      </div>

      {/* tag 下拉選單（datalist）：讓使用者能快速選擇常用 MARC 欄位 */}
      <datalist id="marc21-tag-list">
        {listMarc21FieldSpecs().map((s) => (
          <option key={s.tag} value={s.tag}>
            {s.label}
          </option>
        ))}
      </datalist>

      {/* relator codes/terms：提供 datalist（下拉建議），但仍允許輸入其他值 */}
      <datalist id="marc21-relator-code-list">
        {MARC_RELATOR_CODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} label={o.label} />
        ))}
      </datalist>
      <datalist id="marc21-relator-term-list">
        {MARC_RELATOR_TERM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} label={o.label} />
        ))}
      </datalist>

      {/* language codes：041$a 等常用值（datalist 建議；仍允許輸入其他 code） */}
      <datalist id="marc21-language-code-list">
        {MARC_LANGUAGE_CODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} label={o.label} />
        ))}
      </datalist>
    </div>
  );
}
