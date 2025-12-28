/**
 * MARC21 ↔ Authority Linking（shared, executable rules）
 *
 * 你要求「MARC 與 controlled vocabulary 的對應規則要定死」，且不能只停在文件：
 * - 文件（`docs/marc21-controlled-vocab-mapping.md`）是給人看的
 * - 本檔是給程式跑的（Web / API 共用），避免：
 *   - Web 的指標規則跟 API 不一致
 *   - $0/$2 的格式在不同地方各寫一套，久了就漂移
 *
 * 本檔的責任範圍（刻意保持小而精準）：
 * - 定義「哪些 MARC tag 對應哪一種 authority kind」
 * - 定義「當使用 $2 指定來源時，哪個指標要設為 7」
 * - 定義「本系統 term_id 放在 $0 的固定格式：urn:uuid:<uuid>」
 *
 * 不在本檔做的事（避免過度膨脹）：
 * - 不嘗試覆蓋完整 MARC21 欄位字典（那是另一份大字典：tags/子欄位/可重複性/值型別）
 * - 不做 DB 查詢與驗證（例如 term_id 是否存在、UUID 格式是否正確）
 *   - 這些是 API（service）層的責任；shared 只做「規則 + 小工具」。
 */

export type AuthorityKind = 'subject' | 'geographic' | 'genre' | 'name' | 'language' | 'relator';

export type MarcIndicatorPosition = 1 | 2;

export type MarcSourceSpecifiedRule = {
  // position：哪一個指標代表「source specified in $2」
  // - 650/651：ind2=7
  // - 655：ind1=7
  position: MarcIndicatorPosition;

  // when_vocab_present：當（且僅當）$2 有值時，要設的指標值（MARC21 慣例是 7）
  when_vocab_present: string;

  // when_vocab_missing：當 $2 沒有值時，要回到的保守預設
  // - 650/651：常用 4（source not specified）
  // - 655：常用 0（basic）
  when_vocab_missing: string;
};

export type MarcAuthorityLinkingRule = {
  // kind：本系統 controlled vocab 類型（authority_terms.kind）
  kind: AuthorityKind;

  // tags：哪些 MARC tag 使用同一套 linking 規則（例如 name：100/700/710/711/720）
  tags: string[];

  // heading_subfield_code：我們把「正規化標目」放在哪個子欄位
  // - v1：先統一用 $a（最常見）
  heading_subfield_code: string | null;

  // authority_control_number_subfield_code：把本系統 term_id 放在哪個子欄位（通常是 $0）
  authority_control_number_subfield_code: string | null;

  // vocabulary_code_subfield_code：把 vocabulary_code 放在哪個子欄位（通常是 $2）
  vocabulary_code_subfield_code: string | null;

  // source_specified_in_indicator：若這個欄位使用 $2，哪個指標要同步成 7
  source_specified_in_indicator: MarcSourceSpecifiedRule | null;
};

// 這份表就是「可執行的規則總表」（對齊 docs/marc21-controlled-vocab-mapping.md）
export const MARC_AUTHORITY_LINKING_RULES: MarcAuthorityLinkingRule[] = [
  {
    kind: 'subject',
    tags: ['650'],
    heading_subfield_code: 'a',
    authority_control_number_subfield_code: '0',
    vocabulary_code_subfield_code: '2',
    source_specified_in_indicator: { position: 2, when_vocab_present: '7', when_vocab_missing: '4' },
  },
  {
    kind: 'geographic',
    tags: ['651'],
    heading_subfield_code: 'a',
    authority_control_number_subfield_code: '0',
    vocabulary_code_subfield_code: '2',
    source_specified_in_indicator: { position: 2, when_vocab_present: '7', when_vocab_missing: '4' },
  },
  {
    kind: 'genre',
    tags: ['655'],
    heading_subfield_code: 'a',
    authority_control_number_subfield_code: '0',
    vocabulary_code_subfield_code: '2',
    source_specified_in_indicator: { position: 1, when_vocab_present: '7', when_vocab_missing: '0' },
  },
  {
    // name：本系統 v1 先做最常用的「個人名」映射（100/700）
    // - 但在 marc_extras editor 為了實務，我們也允許 710/711/720 走同一套「$0=urn:uuid」連結規則
    kind: 'name',
    tags: ['100', '700', '710', '711', '720'],
    heading_subfield_code: 'a',
    authority_control_number_subfield_code: '0',
    vocabulary_code_subfield_code: null,
    source_specified_in_indicator: null,
  },
  {
    // language：v1 仍以「code（041$a / 008/35-37）」為主，不強制 term_id linking
    // - 若你未來把 language 也做成 authority_terms.kind=language，可再把 $0 納入這份規則
    kind: 'language',
    tags: ['041'],
    heading_subfield_code: 'a',
    authority_control_number_subfield_code: null,
    vocabulary_code_subfield_code: '2',
    source_specified_in_indicator: { position: 2, when_vocab_present: '7', when_vocab_missing: ' ' },
  },
];

function normalizeMarcTag(tag: string): string | null {
  const t = String(tag ?? '').trim();
  if (!/^[0-9]{3}$/.test(t)) return null;
  return t;
}

function normalizeIndicatorChar(value: string) {
  // MARC 指標一定是 1 字元；空白指標用 ' ' 表達。
  const v = String(value ?? '');
  if (!v) return ' ';
  return v.slice(0, 1) || ' ';
}

export function getMarcAuthorityLinkingRuleByTag(tag: string): MarcAuthorityLinkingRule | null {
  const t = normalizeMarcTag(tag);
  if (!t) return null;
  return MARC_AUTHORITY_LINKING_RULES.find((r) => r.tags.includes(t)) ?? null;
}

export function getAuthorityKindForMarcTag(tag: string): AuthorityKind | null {
  return getMarcAuthorityLinkingRuleByTag(tag)?.kind ?? null;
}

export function applyMarcIndicatorsForVocabulary(
  tag: string,
  indicators: { ind1: string; ind2: string },
  vocabularyCode?: string | null,
): { ind1: string; ind2: string } {
  const rule = getMarcAuthorityLinkingRuleByTag(tag);
  const ind1 = normalizeIndicatorChar(indicators.ind1);
  const ind2 = normalizeIndicatorChar(indicators.ind2);

  // 沒有規則（或此 tag 不使用 $2/指標同步）→ 原樣回傳
  if (!rule?.source_specified_in_indicator) return { ind1, ind2 };

  const vocab = String(vocabularyCode ?? '').trim();
  const desired = vocab ? rule.source_specified_in_indicator.when_vocab_present : rule.source_specified_in_indicator.when_vocab_missing;

  if (rule.source_specified_in_indicator.position === 1) return { ind1: desired, ind2 };
  return { ind1, ind2: desired };
}

export function formatAuthorityControlNumber(uuidOrUrn: string) {
  // $0（Authority record control number）在 MARC 實務上可能是：
  // - 外部系統的 control number（例如某館/LC 的編號）
  // - URI（例如 id.loc.gov/...）
  //
  // 本專案的 v1 規則：只要是「本系統 term_id」，就一律用：
  // - urn:uuid:<uuid>
  //
  // 好處：
  // - 一眼看得出這是 UUID（不是其他系統號碼）
  // - roundtrip（匯出→匯入→比對）更穩定
  const raw = String(uuidOrUrn ?? '').trim();
  if (!raw) return '';
  if (/^urn:uuid:/i.test(raw)) return `urn:uuid:${raw.replace(/^urn:uuid:/i, '').trim()}`;
  return `urn:uuid:${raw}`;
}

export function parseAuthorityControlNumberUrnUuid(value: string): string | null {
  // 只解析「本系統格式」：urn:uuid:<uuid>
  // - 若是外部 URI/control number（不是 urn:uuid），回傳 null（交給呼叫端決定怎麼處理）
  const raw = String(value ?? '').trim();
  if (!/^urn:uuid:/i.test(raw)) return null;
  const id = raw.replace(/^urn:uuid:/i, '').trim();
  return id || null;
}

