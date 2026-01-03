/**
 * MARC21 Field Dictionary（shared, SSOT）
 *
 * 目的：
 * - 提供「常用 MARC21（BIB）」欄位字典，讓 Web 與 API 都能一致地：
 *   - 顯示 tag/indicator/subfield 的 label
 *   - 產生空白欄位（createEmptyFieldFromSpec）
 *   - 對 `marc_extras` 做欄位級驗證（validateMarcFieldWithDictionary）
 *
 * 為什麼要抽到 shared？
 * - 原本 Web 與 API 各有一份字典，長期會出現規格/驗證/顯示漂移（drift）。
 * - 這份檔案是「單一真相來源（SSOT）」，避免：
 *   - Web 顯示可用的子欄位，但 API 端驗證拒絕
 *   - API 允許的欄位，在 Web 下拉/字典頁看不到
 *
 * 設計取捨：
 * - 完整 MARC21 規格非常大；本檔先落地「常用欄位」並允許擴充。
 * - 未列入字典的 tag：後端仍允許存入（只做通用 shape 檢查），避免擋住地方欄位/進階用法。
 */

// 注意：這裡刻意只定義「字典/驗證需要的最小 MARC 形狀」，避免 shared 被完整 MARC 序列化/解析邏輯綁住。
// - Web 與 API 兩邊原本就有等價的 MarcField 型別；TS 會用「結構相容」讓它們能互相傳遞。
type MarcSubfield = { code: string; value: string };
type MarcControlField = { tag: string; value: string };
type MarcDataField = { tag: string; ind1: string; ind2: string; subfields: MarcSubfield[] };
type MarcField = MarcControlField | MarcDataField;

export type Marc21IndicatorOption = {
  // code：1 字元；空白指標用空字串 '' 表示（UI 友善，送到 API 也合法）
  code: string;
  label: string;
};

export type Marc21IndicatorSpec = {
  label: string;
  options: Marc21IndicatorOption[];

  // allow_other：
  // - true：允許非 options 的值（常見於我們尚未完整列出規格、或 local practice 允許的情境）
  // - false：嚴格限制只能用 options
  allow_other?: boolean;

  // default：新增欄位時的預設值（若沒給，就用 options[0]）
  default?: string;
};

export type Marc21SubfieldValueKind =
  | 'text'
  | 'isbn'
  | 'issn'
  | 'year'
  | 'url'
  | 'classification'
  | 'code';

export type Marc21SubfieldSpec = {
  code: string; // 1 字元（a/b/0/2/6/8…）
  label: string;

  // repeatable/required：先做「最小可用」的約束；更細的 per-tag 規格可逐步補
  repeatable?: boolean;
  required?: boolean;

  // value_kind：用於 UI placeholder 與最小驗證（例如 URL/年份）
  value_kind?: Marc21SubfieldValueKind;
  pattern?: RegExp;
  max_length?: number;

  // managed_by_form：代表這個子欄位在「匯出」時會被表單欄位覆蓋（核心治理）
  // - 我們不阻止你在 marc_extras 編輯它（匯入資料可能仍有），但 UI 會提示避免誤會
  managed_by_form?: boolean;
};

export type Marc21FieldBase = {
  tag: string;
  label: string;
  repeatable: boolean;
};

export type Marc21ControlFieldSpec = Marc21FieldBase & {
  kind: 'control';
  value: {
    exact_length?: number;
    min_length?: number;
    max_length?: number;
    pattern?: RegExp;
  };
};

export type Marc21DataFieldSpec = Marc21FieldBase & {
  kind: 'data';
  indicators: [Marc21IndicatorSpec, Marc21IndicatorSpec];
  subfields: Marc21SubfieldSpec[];

  // subfields_allow_other：
  // - true（預設）：允許未列在 subfields 內的 code（不阻擋進階/地方欄位用法；仍可做值型別驗證於已知 code）
  // - false：嚴格限制只能用字典列出的 code
  subfields_allow_other?: boolean;
};

export type Marc21FieldSpec = Marc21ControlFieldSpec | Marc21DataFieldSpec;

export type Marc21Issue = {
  level: 'error' | 'warning';
  path: Array<string | number>;
  message: string;
};

function isMarcDataField(field: MarcField): field is MarcDataField {
  return (field as any)?.subfields !== undefined;
}

export function normalizeIndicator(value: string) {
  // 後端允許 '' 代表空白指標；DB/匯入資料也可能是 ' '。
  // 這裡統一把空白視為 ''，讓 UI/驗證更一致。
  return value === ' ' ? '' : (value ?? '');
}

function isControlTag(tag: string) {
  if (!/^[0-9]{3}$/.test(tag)) return false;
  const n = Number.parseInt(tag, 10);
  return Number.isFinite(n) && n < 10;
}

export function isSystemManagedTag(tag: string) {
  // 000：leader；001/005：控制號/時間戳（由系統產生）
  return tag === '000' || tag === '001' || tag === '005';
}

function blankOnlyIndicator(label: string): Marc21IndicatorSpec {
  return { label, options: [{ code: '', label: '（空白）' }], allow_other: false, default: '' };
}

function digits0to9(label: string, defaultValue: string = '0'): Marc21IndicatorSpec {
  return {
    label,
    options: Array.from({ length: 10 }, (_, i) => ({ code: String(i), label: String(i) })),
    allow_other: false,
    default: defaultValue,
  };
}

function option(code: string, label: string): Marc21IndicatorOption {
  return { code, label };
}

function thesaurusIndicator(label: string = 'ind2（Thesaurus）', defaultValue: string = '4'): Marc21IndicatorSpec {
  // 6XX 常見的 ind2（主題詞彙表/標目表來源）
  // - 我們先提供常見值（含 7：$2 指定），並 allow_other=true 避免誤擋地方實務/舊資料。
  return {
    label,
    options: [
      option('0', '0：LCSH'),
      option('1', "1：LC subject headings for children's literature"),
      option('2', '2：MeSH'),
      option('3', '3：NAL'),
      option('4', '4：Source not specified'),
      option('5', '5：Canadian'),
      option('6', '6：RVM'),
      option('7', '7：Source specified in $2'),
    ],
    allow_other: true,
    default: defaultValue,
  };
}

function commonLinkingSubfields(): Marc21SubfieldSpec[] {
  // 這些子欄位出現在大量欄位中（authority linking / source / linkage）
  return [
    { code: '0', label: 'Authority record control number（$0）', value_kind: 'code', repeatable: true },
    { code: '2', label: 'Source of heading or term（$2）', value_kind: 'code', repeatable: false },
    { code: '3', label: 'Materials specified（$3）', value_kind: 'text', repeatable: false },
    { code: '5', label: 'Institution to which field applies（$5）', value_kind: 'code', repeatable: false },
    { code: '6', label: 'Linkage（$6）', value_kind: 'code', repeatable: false },
    { code: '8', label: 'Field link and sequence number（$8）', value_kind: 'code', repeatable: false },
  ];
}

// ----------------------------
// Dictionary：常用 BIB 欄位（可逐步擴充）
// ----------------------------

export const MARC21_BIB_FIELDS: Record<string, Marc21FieldSpec> = {
  // 00X：control fields（固定/半固定長度）
  '003': {
    kind: 'control',
    tag: '003',
    label: '003 — Control Number Identifier',
    repeatable: false,
    // 003 的內容通常是機構/系統代碼（長度不一）；先做保守上限避免超長垃圾值
    value: { min_length: 1, max_length: 64 },
  },
  '006': {
    kind: 'control',
    tag: '006',
    label: '006 — Additional Material Characteristics',
    repeatable: true,
    value: { exact_length: 18 },
  },
  '007': {
    kind: 'control',
    tag: '007',
    label: '007 — Physical Description Fixed Field',
    repeatable: true,
    // 007 長度依類型而異，先做保守限制避免過長
    value: { min_length: 2, max_length: 64 },
  },
  '008': {
    kind: 'control',
    tag: '008',
    label: '008 — Fixed-Length Data Elements',
    repeatable: false,
    value: { exact_length: 40 },
  },

  // 01X-09X：numbers/codes
  '010': {
    kind: 'data',
    tag: '010',
    label: '010 — LC Control Number (LCCN)',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'LC control number（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'NUCMC control number（$b）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Canceled/invalid LC control number（$z）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '015': {
    kind: 'data',
    tag: '015',
    label: '015 — National Bibliography Number',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'National bibliography number（$a）', value_kind: 'text', repeatable: true },
      { code: 'q', label: 'Qualifying information（$q）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Canceled/invalid number（$z）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '016': {
    kind: 'data',
    tag: '016',
    label: '016 — National Bibliographic Agency Control Number',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Record control number（$a）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Canceled/invalid number（$z）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '017': {
    kind: 'data',
    tag: '017',
    label: '017 — Copyright or Legal Deposit Number',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Copyright/Legal deposit number（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Assigning agency（$b）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Date（$d）', value_kind: 'text', repeatable: true },
      { code: 'i', label: 'Display text（$i）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Canceled/invalid number（$z）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '020': {
    kind: 'data',
    tag: '020',
    label: '020 — ISBN',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      {
        code: 'a',
        label: 'ISBN（$a）',
        value_kind: 'isbn',
        // ISBN 允許破折號與附註；因此只做「保守」的最大長度限制
        max_length: 64,
        repeatable: true,
        managed_by_form: true,
      },
      { code: 'q', label: 'Qualifying information（$q）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Terms of availability（$c）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Canceled/invalid ISBN（$z）', value_kind: 'isbn', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '022': {
    kind: 'data',
    tag: '022',
    label: '022 — ISSN',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'ISSN（$a）', value_kind: 'issn', repeatable: true },
      { code: 'l', label: 'ISSN-L（$l）', value_kind: 'issn', repeatable: false },
      { code: 'm', label: 'Canceled ISSN-L（$m）', value_kind: 'issn', repeatable: true },
      { code: 'y', label: 'Incorrect ISSN（$y）', value_kind: 'issn', repeatable: true },
      { code: 'z', label: 'Canceled ISSN（$z）', value_kind: 'issn', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '024': {
    kind: 'data',
    tag: '024',
    label: '024 — Other Standard Identifier',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of standard number or code）',
        options: [
          option('', '（空白）未指明'),
          option('0', '0：ISRC'),
          option('1', '1：UPC'),
          option('2', '2：ISMN'),
          option('3', '3：EAN'),
          option('4', '4：SICI'),
          option('7', '7：Source specified in $2'),
          option('8', '8：Unspecified type'),
        ],
        allow_other: true,
        default: '',
      },
      {
        label: 'ind2（Difference indicator）',
        options: [option('0', '0：No difference'), option('1', '1：Difference')],
        allow_other: true,
        default: '0',
      },
    ],
    subfields: [
      { code: 'a', label: 'Standard number or code（$a）', value_kind: 'code', repeatable: true },
      { code: 'c', label: 'Terms of availability（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Additional codes following $a（$d）', value_kind: 'code', repeatable: true },
      { code: 'q', label: 'Qualifying information（$q）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Canceled/invalid number（$z）', value_kind: 'code', repeatable: true },
      { code: '2', label: 'Source of number or code（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '028': {
    kind: 'data',
    tag: '028',
    label: '028 — Publisher or Distributor Number',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of number）',
        options: [
          option('', '（空白）未指明'),
          option('0', '0：Issue number'),
          option('1', '1：Matrix number'),
          option('2', '2：Plate number'),
          option('3', '3：Other music number'),
          option('4', '4：Video recording number'),
          option('5', '5：Other publisher number'),
          option('6', '6：Distributor number'),
        ],
        allow_other: true,
        default: '',
      },
      {
        label: 'ind2（Note/added entry controller）',
        options: [
          option('0', '0：No note, no added entry'),
          option('1', '1：Note, added entry'),
          option('2', '2：No note, added entry'),
          option('3', '3：Note, no added entry'),
        ],
        allow_other: true,
        default: '0',
      },
    ],
    subfields: [
      { code: 'a', label: 'Publisher/distributor number（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Source（$b）', value_kind: 'text', repeatable: true },
      { code: 'q', label: 'Qualifying information（$q）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '035': {
    kind: 'data',
    tag: '035',
    label: '035 — System Control Number',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'System control number（$a）', value_kind: 'code', repeatable: true },
      { code: 'z', label: 'Canceled/invalid control number（$z）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '037': {
    kind: 'data',
    tag: '037',
    label: '037 — Source of Acquisition',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Stock number（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Source of stock number/acquisition（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Terms of availability（$c）', value_kind: 'text', repeatable: true },
      { code: 'f', label: 'Form of issue（$f）', value_kind: 'text', repeatable: true },
      { code: 'n', label: 'Note（$n）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source of stock number（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '040': {
    kind: 'data',
    tag: '040',
    label: '040 — Cataloging Source',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Original cataloging agency（$a）', value_kind: 'code', repeatable: true },
      { code: 'b', label: 'Language of cataloging（$b）', value_kind: 'code', repeatable: false },
      { code: 'c', label: 'Transcribing agency（$c）', value_kind: 'code', repeatable: true },
      { code: 'd', label: 'Modifying agency（$d）', value_kind: 'code', repeatable: true },
      { code: 'e', label: 'Description conventions（$e）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '041': {
    kind: 'data',
    tag: '041',
    label: '041 — Language Code',
    repeatable: true,
    // 實務上 041 指標很少用到；我們提供常見值，但仍允許其他（避免擋掉舊資料）
    indicators: [
      {
        label: 'ind1（Translation indication）',
        options: [
          option('', '（空白）未指明'),
          option('0', '0：Not a translation'),
          option('1', '1：Is a translation'),
        ],
        allow_other: true,
        default: '',
      },
      {
        label: 'ind2（Source of code）',
        options: [option('', '（空白）MARC language code'), option('7', '7：Source specified in $2')],
        allow_other: true,
        default: '',
      },
    ],
    subfields: [
      {
        code: 'a',
        label: 'Language code of text/sound track（$a）',
        value_kind: 'code',
        max_length: 16,
        repeatable: true,
        managed_by_form: true,
      },
      { code: 'b', label: 'Language code of summary/abstract（$b）', value_kind: 'code', repeatable: true },
      { code: 'd', label: 'Language code of sung/spoken text（$d）', value_kind: 'code', repeatable: true },
      { code: 'e', label: 'Language code of librettos（$e）', value_kind: 'code', repeatable: true },
      { code: 'f', label: 'Language code of table of contents（$f）', value_kind: 'code', repeatable: true },
      { code: 'g', label: 'Language code of accompanying material（$g）', value_kind: 'code', repeatable: true },
      { code: 'h', label: 'Language code of original（$h）', value_kind: 'code', repeatable: true },
      { code: 'j', label: 'Language code of subtitles/captions（$j）', value_kind: 'code', repeatable: true },
      { code: '2', label: 'Source of code（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '042': {
    kind: 'data',
    tag: '042',
    label: '042 — Authentication Code',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Authentication code（$a）', value_kind: 'code', repeatable: true }, ...commonLinkingSubfields()],
  },
  '043': {
    kind: 'data',
    tag: '043',
    label: '043 — Geographic Area Code',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Geographic area code（$a）', value_kind: 'code', repeatable: true },
      { code: 'b', label: 'Local GAC code（$b）', value_kind: 'code', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '044': {
    kind: 'data',
    tag: '044',
    label: '044 — Country of Publishing/Producing Entity Code',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Country code（$a）', value_kind: 'code', repeatable: true },
      { code: 'b', label: 'Local subentity code（$b）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '050': {
    kind: 'data',
    tag: '050',
    label: '050 — Library of Congress Call Number',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Existence in LC collection）',
        options: [option('', '（空白）未指明'), option('0', '0：Item is in LC'), option('1', '1：Item is not in LC')],
        allow_other: true,
        default: '',
      },
      {
        label: 'ind2（Source of call number）',
        options: [option('0', '0：Assigned by LC'), option('4', '4：Assigned by other agency')],
        allow_other: true,
        default: '4',
      },
    ],
    subfields: [
      { code: 'a', label: 'Classification number（$a）', value_kind: 'classification', max_length: 64, repeatable: true },
      { code: 'b', label: 'Item number（$b）', value_kind: 'text', repeatable: true },
      { code: '3', label: 'Materials specified（$3）', value_kind: 'text', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '080': {
    kind: 'data',
    tag: '080',
    label: '080 — Universal Decimal Classification Number',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'UDC number（$a）', value_kind: 'classification', max_length: 64, repeatable: true },
      { code: 'b', label: 'Item number（$b）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'Common auxiliary subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Edition identifier（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '082': {
    kind: 'data',
    tag: '082',
    label: '082 — Dewey Decimal Classification Number',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of edition）',
        options: [option('0', '0：Full edition'), option('1', '1：Abridged edition')],
        allow_other: true,
        default: '0',
      },
      {
        label: 'ind2（Source of classification number）',
        options: [option('0', '0：Assigned by LC'), option('4', '4：Assigned by other agency')],
        allow_other: true,
        default: '4',
      },
    ],
    subfields: [
      {
        code: 'a',
        label: 'Classification number（$a）',
        value_kind: 'classification',
        max_length: 64,
        repeatable: true,
        managed_by_form: true,
      },
      { code: 'b', label: 'Item number（$b）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Edition number（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '084': {
    kind: 'data',
    tag: '084',
    label: '084 — Other Classification Number',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      {
        code: 'a',
        label: 'Classification number（$a）',
        value_kind: 'classification',
        max_length: 64,
        repeatable: true,
        managed_by_form: true,
      },
      { code: 'b', label: 'Item number（$b）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source of classification number（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '090': {
    kind: 'data',
    tag: '090',
    label: '090 — Local Call Number',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Local call number（$a）', value_kind: 'classification', max_length: 64, repeatable: true },
      { code: 'b', label: 'Item number（$b）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },

  // 1XX：main entries
  '100': {
    kind: 'data',
    tag: '100',
    label: '100 — Main Entry—Personal Name',
    repeatable: false,
    indicators: [
      {
        label: 'ind1（Type of personal name entry element）',
        options: [option('0', '0：Forename'), option('1', '1：Surname'), option('3', '3：Family name')],
        allow_other: true,
        default: '1',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Personal name（$a）', value_kind: 'text', repeatable: false, managed_by_form: true },
      { code: 'b', label: 'Numeration（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Titles and other words associated with a name（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Dates associated with a name（$d）', value_kind: 'text', repeatable: false },
      { code: 'e', label: 'Relator term（$e）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '110': {
    kind: 'data',
    tag: '110',
    label: '110 — Main Entry—Corporate Name',
    repeatable: false,
    indicators: [
      {
        label: 'ind1（Type of corporate name entry element）',
        options: [
          option('0', '0：Inverted name'),
          option('1', '1：Jurisdiction name'),
          option('2', '2：Name in direct order'),
        ],
        allow_other: true,
        default: '2',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Corporate name（$a）', value_kind: 'text', repeatable: false },
      { code: 'b', label: 'Subordinate unit（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Location of meeting（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Date of meeting（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Relator term（$e）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '111': {
    kind: 'data',
    tag: '111',
    label: '111 — Main Entry—Meeting Name',
    repeatable: false,
    indicators: [
      {
        label: 'ind1（Type of meeting name entry element）',
        options: [
          option('0', '0：Inverted name'),
          option('1', '1：Jurisdiction name'),
          option('2', '2：Name in direct order'),
        ],
        allow_other: true,
        default: '2',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Meeting name（$a）', value_kind: 'text', repeatable: false },
      { code: 'c', label: 'Location of meeting（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Date of meeting（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Subordinate unit（$e）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '130': {
    kind: 'data',
    tag: '130',
    label: '130 — Main Entry—Uniform Title',
    repeatable: false,
    indicators: [digits0to9('ind1（Nonfiling characters）', '0'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Uniform title（$a）', value_kind: 'text', repeatable: false },
      { code: 'f', label: 'Date of a work（$f）', value_kind: 'text', repeatable: false },
      { code: 'g', label: 'Miscellaneous information（$g）', value_kind: 'text', repeatable: true },
      { code: 'k', label: 'Form subheading（$k）', value_kind: 'text', repeatable: true },
      { code: 'l', label: 'Language of a work（$l）', value_kind: 'code', repeatable: false },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      { code: 's', label: 'Version（$s）', value_kind: 'text', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },

  // 21X-25X：titles/editions
  '210': {
    kind: 'data',
    tag: '210',
    label: '210 — Abbreviated Title',
    repeatable: true,
    indicators: [
      { label: 'ind1（Title added entry）', options: [option('0', '0：No added entry'), option('1', '1：Added entry')], allow_other: true, default: '0' },
      digits0to9('ind2（Nonfiling characters）', '0'),
    ],
    subfields: [
      { code: 'a', label: 'Abbreviated title（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Qualifying information（$b）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '222': {
    kind: 'data',
    tag: '222',
    label: '222 — Key Title',
    repeatable: true,
    indicators: [
      { label: 'ind1（Key title added entry）', options: [option('0', '0：No added entry'), option('1', '1：Added entry')], allow_other: true, default: '0' },
      digits0to9('ind2（Nonfiling characters）', '0'),
    ],
    subfields: [
      { code: 'a', label: 'Key title（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Qualifying information（$b）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '242': {
    kind: 'data',
    tag: '242',
    label: '242 — Translation of Title by Cataloging Agency',
    repeatable: true,
    indicators: [
      { label: 'ind1（Title added entry）', options: [option('0', '0：No added entry'), option('1', '1：Added entry')], allow_other: true, default: '0' },
      digits0to9('ind2（Nonfiling characters）', '0'),
    ],
    subfields: [
      { code: 'a', label: 'Title（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Remainder of title（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Statement of responsibility（$c）', value_kind: 'text', repeatable: true },
      { code: 'h', label: 'Medium（$h）', value_kind: 'text', repeatable: true },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Language code of translated title（$y）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '247': {
    kind: 'data',
    tag: '247',
    label: '247 — Former Title',
    repeatable: true,
    indicators: [
      { label: 'ind1（Title added entry）', options: [option('0', '0：No added entry'), option('1', '1：Added entry')], allow_other: true, default: '0' },
      digits0to9('ind2（Nonfiling characters）', '0'),
    ],
    subfields: [
      { code: 'a', label: 'Title（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Remainder of title（$b）', value_kind: 'text', repeatable: true },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'ISSN（$x）', value_kind: 'issn', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '240': {
    kind: 'data',
    tag: '240',
    label: '240 — Uniform Title',
    repeatable: false,
    indicators: [
      {
        label: 'ind1（Uniform title printed/displayed）',
        options: [option('0', '0：Not printed/displayed'), option('1', '1：Printed/displayed')],
        allow_other: true,
        default: '0',
      },
      digits0to9('ind2（Nonfiling characters）', '0'),
    ],
    subfields: [
      { code: 'a', label: 'Uniform title（$a）', value_kind: 'text', repeatable: false },
      { code: 'd', label: 'Date of treaty signing（$d）', value_kind: 'text', repeatable: false },
      { code: 'f', label: 'Date of a work（$f）', value_kind: 'text', repeatable: false },
      { code: 'g', label: 'Miscellaneous information（$g）', value_kind: 'text', repeatable: true },
      { code: 'k', label: 'Form subheading（$k）', value_kind: 'text', repeatable: true },
      { code: 'l', label: 'Language of a work（$l）', value_kind: 'code', repeatable: false },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '245': {
    kind: 'data',
    tag: '245',
    label: '245 — Title Statement',
    repeatable: false,
    indicators: [
      {
        label: 'ind1（Title added entry）',
        options: [option('0', '0：No added entry'), option('1', '1：Added entry')],
        allow_other: false,
        default: '0',
      },
      digits0to9('ind2（Nonfiling characters）', '0'),
    ],
    subfields: [
      { code: 'a', label: 'Title（$a）', value_kind: 'text', repeatable: false, required: true, managed_by_form: true },
      { code: 'b', label: 'Remainder of title（$b）', value_kind: 'text', repeatable: false, managed_by_form: true },
      { code: 'c', label: 'Statement of responsibility（$c）', value_kind: 'text', repeatable: false },
      { code: 'f', label: 'Inclusive dates（$f）', value_kind: 'text', repeatable: false },
      { code: 'g', label: 'Bulk dates（$g）', value_kind: 'text', repeatable: false },
      { code: 'h', label: 'Medium（$h）', value_kind: 'text', repeatable: false },
      { code: 'k', label: 'Form（$k）', value_kind: 'text', repeatable: true },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      { code: 's', label: 'Version（$s）', value_kind: 'text', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '246': {
    kind: 'data',
    tag: '246',
    label: '246 — Varying Form of Title',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Note/added entry controller）',
        options: [
          option('0', '0：Note, no added entry'),
          option('1', '1：Note, added entry'),
          option('2', '2：No note, no added entry'),
          option('3', '3：No note, added entry'),
        ],
        allow_other: true,
        default: '0',
      },
      {
        label: 'ind2（Type of title）',
        options: [
          option('', '（空白）No type specified'),
          option('0', '0：Portion of title'),
          option('1', '1：Parallel title'),
          option('2', '2：Distinctive title'),
          option('3', '3：Other title'),
          option('4', '4：Cover title'),
          option('5', '5：Added title page title'),
          option('6', '6：Caption title'),
          option('7', '7：Running title'),
          option('8', '8：Spine title'),
        ],
        allow_other: true,
        default: '',
      },
    ],
    subfields: [
      { code: 'a', label: 'Title proper/short title（$a）', value_kind: 'text', repeatable: false },
      { code: 'b', label: 'Remainder of title（$b）', value_kind: 'text', repeatable: false },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '250': {
    kind: 'data',
    tag: '250',
    label: '250 — Edition Statement',
    repeatable: false,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Edition statement（$a）', value_kind: 'text', repeatable: false },
      { code: 'b', label: 'Remainder of edition statement（$b）', value_kind: 'text', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },

  // 26X/264：imprint
  '260': {
    kind: 'data',
    tag: '260',
    label: '260 — Publication, Distribution, etc. (Imprint) (legacy)',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Place of publication（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Name of publisher（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Date of publication（$c）', value_kind: 'text', repeatable: true, managed_by_form: true },
      ...commonLinkingSubfields(),
    ],
  },
  '264': {
    kind: 'data',
    tag: '264',
    label: '264 — Production, Publication, Distribution, Manufacture, and Copyright Notice',
    repeatable: true,
    indicators: [
      blankOnlyIndicator('ind1'),
      {
        label: 'ind2（Function）',
        options: [
          option('0', '0：Production'),
          option('1', '1：Publication'),
          option('2', '2：Distribution'),
          option('3', '3：Manufacture'),
          option('4', '4：Copyright notice date'),
        ],
        allow_other: true,
        default: '1',
      },
    ],
    subfields: [
      { code: 'a', label: 'Place（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Name（$b）', value_kind: 'text', repeatable: true, managed_by_form: true },
      {
        code: 'c',
        label: 'Date（$c）',
        value_kind: 'text',
        repeatable: true,
        max_length: 32,
        managed_by_form: true,
      },
      ...commonLinkingSubfields(),
    ],
  },

  // 3XX：physical description + RDA content/media/carrier
  '300': {
    kind: 'data',
    tag: '300',
    label: '300 — Physical Description',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Extent（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Other physical details（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Dimensions（$c）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Accompanying material（$e）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '306': {
    kind: 'data',
    tag: '306',
    label: '306 — Playing Time',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Playing time（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '310': {
    kind: 'data',
    tag: '310',
    label: '310 — Current Publication Frequency',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Current publication frequency（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '321': {
    kind: 'data',
    tag: '321',
    label: '321 — Former Publication Frequency',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Former publication frequency（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '340': {
    kind: 'data',
    tag: '340',
    label: '340 — Physical Medium',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Physical medium（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Dimensions（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Materials specified（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Materials base and configuration（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Support（$e）', value_kind: 'text', repeatable: true },
      { code: 'f', label: 'Production rate/ratio（$f）', value_kind: 'text', repeatable: true },
      { code: 'g', label: 'Color content（$g）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '344': {
    kind: 'data',
    tag: '344',
    label: '344 — Sound Characteristics',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Type of recording（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Recording medium（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Playing speed（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Groove characteristic（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Track configuration（$e）', value_kind: 'text', repeatable: true },
      { code: 'f', label: 'Tape configuration（$f）', value_kind: 'text', repeatable: true },
      { code: 'g', label: 'Configuration of playback channels（$g）', value_kind: 'text', repeatable: true },
      { code: 'h', label: 'Special playback characteristics（$h）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '345': {
    kind: 'data',
    tag: '345',
    label: '345 — Projection Characteristics',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Presentation format（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Projection speed（$b）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '346': {
    kind: 'data',
    tag: '346',
    label: '346 — Video Characteristics',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Video format（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Broadcast standard（$b）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '347': {
    kind: 'data',
    tag: '347',
    label: '347 — Digital File Characteristics',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'File type（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Encoding format（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'File size（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Resolution（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Regional encoding（$e）', value_kind: 'text', repeatable: true },
      { code: 'f', label: 'Transmission speed（$f）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '348': {
    kind: 'data',
    tag: '348',
    label: '348 — Format of Notated Music',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Format of musical notation（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Format of notated music code（$b）', value_kind: 'code', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '336': {
    kind: 'data',
    tag: '336',
    label: '336 — Content Type',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Content type term（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Content type code（$b）', value_kind: 'code', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '337': {
    kind: 'data',
    tag: '337',
    label: '337 — Media Type',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Media type term（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Media type code（$b）', value_kind: 'code', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '338': {
    kind: 'data',
    tag: '338',
    label: '338 — Carrier Type',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Carrier type term（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Carrier type code（$b）', value_kind: 'code', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },

  // 490：series statement
  '490': {
    kind: 'data',
    tag: '490',
    label: '490 — Series Statement',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Series tracing policy）',
        options: [option('0', '0：Not traced'), option('1', '1：Traced')],
        allow_other: true,
        default: '0',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Series statement（$a）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Volume/sequential designation（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'ISSN（$x）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },

  // 5XX：notes
  '500': {
    kind: 'data',
    tag: '500',
    label: '500 — General Note',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'General note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '502': {
    kind: 'data',
    tag: '502',
    label: '502 — Dissertation Note',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Dissertation note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '504': {
    kind: 'data',
    tag: '504',
    label: '504 — Bibliography, etc. Note',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Bibliography note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '505': {
    kind: 'data',
    tag: '505',
    label: '505 — Formatted Contents Note',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Display constant controller）',
        options: [
          option('0', '0：Contents'),
          option('1', '1：Incomplete contents'),
          option('2', '2：Partial contents'),
          option('8', '8：No display constant generated'),
        ],
        allow_other: true,
        default: '0',
      },
      {
        label: 'ind2（Level of content designation）',
        options: [option('0', '0：Basic'), option('1', '1：Enhanced')],
        allow_other: true,
        default: '0',
      },
    ],
    subfields: [
      { code: 'a', label: 'Formatted contents note（$a）', value_kind: 'text', repeatable: true },
      { code: 'g', label: 'Miscellaneous information（$g）', value_kind: 'text', repeatable: true },
      { code: 'r', label: 'Statement of responsibility（$r）', value_kind: 'text', repeatable: true },
      { code: 't', label: 'Title（$t）', value_kind: 'text', repeatable: true },
      { code: 'u', label: 'Uniform Resource Identifier（$u）', value_kind: 'url', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '506': {
    kind: 'data',
    tag: '506',
    label: '506 — Restrictions on Access Note',
    repeatable: true,
    indicators: [
      { label: 'ind1（Restriction）', options: [option('', '（空白）未指明'), option('0', '0：No restrictions'), option('1', '1：Restrictions apply')], allow_other: true, default: '' },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Terms governing access（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Jurisdiction（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Physical access provisions（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Authorized users（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Authorization（$e）', value_kind: 'text', repeatable: true },
      { code: 'f', label: 'Standardized terminology for access restriction（$f）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '508': {
    kind: 'data',
    tag: '508',
    label: '508 — Creation/Production Credits Note',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Credits note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '511': {
    kind: 'data',
    tag: '511',
    label: '511 — Participant or Performer Note',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Display constant controller）',
        options: [
          option('', '（空白）'),
          option('0', '0：No display constant generated'),
          option('1', '1：Cast'),
          option('2', '2：Performer'),
          option('3', '3：Narrator'),
          option('8', '8：No display constant generated'),
        ],
        allow_other: true,
        default: '',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Participant/performer note（$a）', value_kind: 'text', repeatable: true },
      { code: '3', label: 'Materials specified（$3）', value_kind: 'text', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '520': {
    kind: 'data',
    tag: '520',
    label: '520 — Summary, etc.',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Display constant controller）',
        options: [
          option('', '（空白）Summary'),
          option('0', '0：Subject'),
          option('1', '1：Review'),
          option('2', '2：Scope and content'),
          option('3', '3：Abstract'),
          option('4', '4：Content advice'),
          option('8', '8：No display constant generated'),
        ],
        allow_other: true,
        default: '',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Summary（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Expansion of summary note（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Assigning source（$c）', value_kind: 'text', repeatable: true },
      { code: 'u', label: 'Uniform Resource Identifier（$u）', value_kind: 'url', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '521': {
    kind: 'data',
    tag: '521',
    label: '521 — Target Audience Note',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Display constant controller）',
        options: [
          option('', '（空白）Audience'),
          option('0', '0：Reading grade level'),
          option('1', '1：Interest age level'),
          option('2', '2：Interest grade level'),
          option('3', '3：Special audience characteristics'),
          option('4', '4：Motivation/interest level'),
          option('8', '8：No display constant generated'),
        ],
        allow_other: true,
        default: '',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Target audience note（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Source（$b）', value_kind: 'text', repeatable: true },
      { code: '3', label: 'Materials specified（$3）', value_kind: 'text', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '530': {
    kind: 'data',
    tag: '530',
    label: '530 — Additional Physical Form Available Note',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Additional physical form note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '538': {
    kind: 'data',
    tag: '538',
    label: '538 — System Details Note',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'System details note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '546': {
    kind: 'data',
    tag: '546',
    label: '546 — Language Note',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Language note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '586': {
    kind: 'data',
    tag: '586',
    label: '586 — Awards Note',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [{ code: 'a', label: 'Awards note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '588': {
    kind: 'data',
    tag: '588',
    label: '588 — Source of Description Note',
    repeatable: true,
    indicators: [
      {
        label: 'ind1',
        options: [option('', '（空白）')],
        allow_other: true,
        default: '',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [{ code: 'a', label: 'Source of description note（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },

  // 6XX：subjects
  '600': {
    kind: 'data',
    tag: '600',
    label: '600 — Subject Added Entry—Personal Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of personal name entry element）',
        options: [option('0', '0：Forename'), option('1', '1：Surname'), option('3', '3：Family name')],
        allow_other: true,
        default: '1',
      },
      thesaurusIndicator(),
    ],
    subfields: [
      { code: 'a', label: 'Personal name（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 'b', label: 'Numeration（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Titles and other words associated with a name（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Dates associated with a name（$d）', value_kind: 'text', repeatable: false },
      { code: 'q', label: 'Fuller form of name（$q）', value_kind: 'text', repeatable: false },
      { code: 't', label: 'Title of a work（$t）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '610': {
    kind: 'data',
    tag: '610',
    label: '610 — Subject Added Entry—Corporate Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of corporate name entry element）',
        options: [option('0', '0：Inverted name'), option('1', '1：Jurisdiction name'), option('2', '2：Name in direct order')],
        allow_other: true,
        default: '2',
      },
      thesaurusIndicator(),
    ],
    subfields: [
      { code: 'a', label: 'Corporate name（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 'b', label: 'Subordinate unit（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Location of meeting（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Date of meeting（$d）', value_kind: 'text', repeatable: true },
      { code: 't', label: 'Title of a work（$t）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '611': {
    kind: 'data',
    tag: '611',
    label: '611 — Subject Added Entry—Meeting Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of meeting name entry element）',
        options: [option('0', '0：Inverted name'), option('1', '1：Jurisdiction name'), option('2', '2：Name in direct order')],
        allow_other: true,
        default: '2',
      },
      thesaurusIndicator(),
    ],
    subfields: [
      { code: 'a', label: 'Meeting name（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 'c', label: 'Location of meeting（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Date of meeting（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Subordinate unit（$e）', value_kind: 'text', repeatable: true },
      { code: 't', label: 'Title of a work（$t）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '630': {
    kind: 'data',
    tag: '630',
    label: '630 — Subject Added Entry—Uniform Title',
    repeatable: true,
    indicators: [digits0to9('ind1（Nonfiling characters）', '0'), thesaurusIndicator()],
    subfields: [
      { code: 'a', label: 'Uniform title（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 'f', label: 'Date of a work（$f）', value_kind: 'text', repeatable: true },
      { code: 'g', label: 'Miscellaneous information（$g）', value_kind: 'text', repeatable: true },
      { code: 'k', label: 'Form subheading（$k）', value_kind: 'text', repeatable: true },
      { code: 'l', label: 'Language of a work（$l）', value_kind: 'code', repeatable: true },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      { code: 's', label: 'Version（$s）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '648': {
    kind: 'data',
    tag: '648',
    label: '648 — Subject Added Entry—Chronological Term',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), thesaurusIndicator()],
    subfields: [
      { code: 'a', label: 'Chronological term（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '653': {
    kind: 'data',
    tag: '653',
    label: '653 — Index Term—Uncontrolled',
    repeatable: true,
    indicators: [
      { label: 'ind1（Level of index term）', options: [option('', '（空白）'), option('0', '0：No level specified'), option('1', '1：Primary'), option('2', '2：Secondary')], allow_other: true, default: '' },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [{ code: 'a', label: 'Uncontrolled term（$a）', value_kind: 'text', repeatable: true }, ...commonLinkingSubfields()],
  },
  '656': {
    kind: 'data',
    tag: '656',
    label: '656 — Index Term—Occupation',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), thesaurusIndicator()],
    subfields: [
      { code: 'a', label: 'Occupation（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '657': {
    kind: 'data',
    tag: '657',
    label: '657 — Index Term—Function',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), thesaurusIndicator()],
    subfields: [
      { code: 'a', label: 'Function（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '658': {
    kind: 'data',
    tag: '658',
    label: '658 — Index Term—Curriculum Objective',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Main curriculum objective（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Subordinate curriculum objective（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Code（$c）', value_kind: 'code', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
  '690': {
    kind: 'data',
    tag: '690',
    label: '690 — Local Subject Added Entry—Topical Term (Local)',
    repeatable: true,
    indicators: [
      { label: 'ind1（Level of subject）', options: [option('', '（空白）'), option('0', '0：No information provided'), option('1', '1：Primary'), option('2', '2：Secondary')], allow_other: true, default: '' },
      { label: 'ind2（Thesaurus）', options: [option('', '（空白）'), option('7', '7：Source specified in $2'), option('4', '4：Source not specified')], allow_other: true, default: '' },
    ],
    subfields: [
      { code: 'a', label: 'Topical term（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '650': {
    kind: 'data',
    tag: '650',
    label: '650 — Subject Added Entry—Topical Term',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Level of subject）',
        options: [option('0', '0：No information provided'), option('1', '1：Primary'), option('2', '2：Secondary')],
        allow_other: true,
        default: '0',
      },
      thesaurusIndicator(),
    ],
    subfields: [
      { code: 'a', label: 'Topical term（$a）', value_kind: 'text', repeatable: false, required: true, managed_by_form: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '651': {
    kind: 'data',
    tag: '651',
    label: '651 — Subject Added Entry—Geographic Name',
    repeatable: true,
    indicators: [
      blankOnlyIndicator('ind1'),
      thesaurusIndicator(),
    ],
    subfields: [
      { code: 'a', label: 'Geographic name（$a）', value_kind: 'text', repeatable: false },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '655': {
    kind: 'data',
    tag: '655',
    label: '655 — Index Term—Genre/Form',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of term）',
        options: [
          option('', '（空白）'),
          option('0', '0：Basic'),
          option('7', '7：Source specified in $2'),
        ],
        allow_other: true,
        default: '7',
      },
      {
        // MARC21 655 ind2：Undefined（慣例應為空白）
        // - 我們仍 allow_other=true：避免誤擋匯入資料或地方實務
        label: 'ind2（Undefined）',
        options: [option('', '（空白）')],
        allow_other: true,
        default: '',
      },
    ],
    subfields: [
      { code: 'a', label: 'Genre/form term（$a）', value_kind: 'text', repeatable: true, required: true, managed_by_form: true },
      { code: 'x', label: 'General subdivision（$x）', value_kind: 'text', repeatable: true },
      { code: 'y', label: 'Chronological subdivision（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Geographic subdivision（$z）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Form subdivision（$v）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },

  // 7XX：added entries
  '700': {
    kind: 'data',
    tag: '700',
    label: '700 — Added Entry—Personal Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of personal name entry element）',
        options: [option('0', '0：Forename'), option('1', '1：Surname'), option('3', '3：Family name')],
        allow_other: true,
        default: '1',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Personal name（$a）', value_kind: 'text', repeatable: true, managed_by_form: true },
      { code: 'b', label: 'Numeration（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Titles and other words associated with a name（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Dates associated with a name（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Relator term（$e）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '710': {
    kind: 'data',
    tag: '710',
    label: '710 — Added Entry—Corporate Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of corporate name entry element）',
        options: [
          option('0', '0：Inverted name'),
          option('1', '1：Jurisdiction name'),
          option('2', '2：Name in direct order'),
        ],
        allow_other: true,
        default: '2',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Corporate name（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'Subordinate unit（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Location of meeting（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Date of meeting（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Relator term（$e）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '711': {
    kind: 'data',
    tag: '711',
    label: '711 — Added Entry—Meeting Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of meeting name entry element）',
        options: [
          option('0', '0：Inverted name'),
          option('1', '1：Jurisdiction name'),
          option('2', '2：Name in direct order'),
        ],
        allow_other: true,
        default: '2',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Meeting name（$a）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Location of meeting（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Date of meeting（$d）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Subordinate unit（$e）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '720': {
    kind: 'data',
    tag: '720',
    label: '720 — Added Entry—Uncontrolled Name',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Name（$a）', value_kind: 'text', repeatable: true },
      { code: 'e', label: 'Relator term（$e）', value_kind: 'text', repeatable: true },
      { code: '4', label: 'Relator code（$4）', value_kind: 'code', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '730': {
    kind: 'data',
    tag: '730',
    label: '730 — Added Entry—Uniform Title',
    repeatable: true,
    indicators: [digits0to9('ind1（Nonfiling characters）', '0'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Uniform title（$a）', value_kind: 'text', repeatable: true },
      { code: 'f', label: 'Date of a work（$f）', value_kind: 'text', repeatable: true },
      { code: 'g', label: 'Miscellaneous information（$g）', value_kind: 'text', repeatable: true },
      { code: 'k', label: 'Form subheading（$k）', value_kind: 'text', repeatable: true },
      { code: 'l', label: 'Language of a work（$l）', value_kind: 'code', repeatable: true },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      { code: 's', label: 'Version（$s）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '740': {
    kind: 'data',
    tag: '740',
    label: '740 — Added Entry—Uncontrolled Related/Analytical Title',
    repeatable: true,
    indicators: [digits0to9('ind1（Nonfiling characters）', '0'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Title（$a）', value_kind: 'text', repeatable: true },
      { code: 'n', label: 'Number of part/section（$n）', value_kind: 'text', repeatable: true },
      { code: 'p', label: 'Name of part/section（$p）', value_kind: 'text', repeatable: true },
      { code: 'h', label: 'Medium（$h）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '752': {
    kind: 'data',
    tag: '752',
    label: '752 — Added Entry—Hierarchical Place Name',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Country or larger entity（$a）', value_kind: 'text', repeatable: true },
      { code: 'b', label: 'First-order political jurisdiction（$b）', value_kind: 'text', repeatable: true },
      { code: 'c', label: 'Intermediate political jurisdiction（$c）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'City（$d）', value_kind: 'text', repeatable: true },
      { code: 'f', label: 'Other political jurisdiction（$f）', value_kind: 'text', repeatable: true },
      { code: 'g', label: 'Other place（$g）', value_kind: 'text', repeatable: true },
      { code: 'h', label: 'Extra jurisdiction name（$h）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '775': {
    kind: 'data',
    tag: '775',
    label: '775 — Other Edition Entry',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Main entry heading（$a）', value_kind: 'text', repeatable: true },
      { code: 't', label: 'Title（$t）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Place, publisher, and date of publication（$d）', value_kind: 'text', repeatable: true },
      { code: 'i', label: 'Relationship information（$i）', value_kind: 'text', repeatable: true },
      { code: 'w', label: 'Record control number（$w）', value_kind: 'code', repeatable: true },
      { code: 'x', label: 'ISSN（$x）', value_kind: 'issn', repeatable: true },
      { code: 'z', label: 'ISBN（$z）', value_kind: 'isbn', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '776': {
    kind: 'data',
    tag: '776',
    label: '776 — Additional Physical Form Entry',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Main entry heading（$a）', value_kind: 'text', repeatable: true },
      { code: 't', label: 'Title（$t）', value_kind: 'text', repeatable: true },
      { code: 'd', label: 'Place, publisher, and date of publication（$d）', value_kind: 'text', repeatable: true },
      { code: 'i', label: 'Relationship information（$i）', value_kind: 'text', repeatable: true },
      { code: 'w', label: 'Record control number（$w）', value_kind: 'code', repeatable: true },
      { code: 'x', label: 'ISSN（$x）', value_kind: 'issn', repeatable: true },
      { code: 'z', label: 'ISBN（$z）', value_kind: 'isbn', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },

  // 8XX：series added entries
  '800': {
    kind: 'data',
    tag: '800',
    label: '800 — Series Added Entry—Personal Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of personal name entry element）',
        options: [option('0', '0：Forename'), option('1', '1：Surname'), option('3', '3：Family name')],
        allow_other: true,
        default: '1',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Personal name（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 't', label: 'Title of series（$t）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Volume/sequential designation（$v）', value_kind: 'text', repeatable: true },
      { code: 'w', label: 'Bibliographic record control number（$w）', value_kind: 'code', repeatable: true },
      { code: 'x', label: 'ISSN（$x）', value_kind: 'issn', repeatable: true },
      { code: 'z', label: 'ISBN（$z）', value_kind: 'isbn', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '810': {
    kind: 'data',
    tag: '810',
    label: '810 — Series Added Entry—Corporate Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of corporate name entry element）',
        options: [option('0', '0：Inverted name'), option('1', '1：Jurisdiction name'), option('2', '2：Name in direct order')],
        allow_other: true,
        default: '2',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Corporate name（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 't', label: 'Title of series（$t）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Volume/sequential designation（$v）', value_kind: 'text', repeatable: true },
      { code: 'w', label: 'Bibliographic record control number（$w）', value_kind: 'code', repeatable: true },
      { code: 'x', label: 'ISSN（$x）', value_kind: 'issn', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '811': {
    kind: 'data',
    tag: '811',
    label: '811 — Series Added Entry—Meeting Name',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Type of meeting name entry element）',
        options: [option('0', '0：Inverted name'), option('1', '1：Jurisdiction name'), option('2', '2：Name in direct order')],
        allow_other: true,
        default: '2',
      },
      blankOnlyIndicator('ind2'),
    ],
    subfields: [
      { code: 'a', label: 'Meeting name（$a）', value_kind: 'text', repeatable: false, required: true },
      { code: 't', label: 'Title of series（$t）', value_kind: 'text', repeatable: true },
      { code: 'v', label: 'Volume/sequential designation（$v）', value_kind: 'text', repeatable: true },
      { code: 'w', label: 'Bibliographic record control number（$w）', value_kind: 'code', repeatable: true },
      { code: 'x', label: 'ISSN（$x）', value_kind: 'issn', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },
  '830': {
    kind: 'data',
    tag: '830',
    label: '830 — Series Added Entry—Uniform Title',
    repeatable: true,
    indicators: [digits0to9('ind1（Nonfiling characters）', '0'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Uniform title（$a）', value_kind: 'text', repeatable: false },
      { code: 'v', label: 'Volume/sequential designation（$v）', value_kind: 'text', repeatable: true },
      { code: 'x', label: 'ISSN（$x）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },

  // 856：electronic location
  '856': {
    kind: 'data',
    tag: '856',
    label: '856 — Electronic Location and Access',
    repeatable: true,
    indicators: [
      {
        label: 'ind1（Access method）',
        options: [
          option('0', '0：Email'),
          option('1', '1：FTP'),
          option('2', '2：Remote login (Telnet)'),
          option('3', '3：Dial-up'),
          option('4', '4：HTTP'),
          option('7', '7：Method specified in $2'),
        ],
        allow_other: true,
        default: '4',
      },
      {
        label: 'ind2（Relationship）',
        options: [
          option('0', '0：Resource'),
          option('1', '1：Version of resource'),
          option('2', '2：Related resource'),
          option('8', '8：No display constant generated'),
        ],
        allow_other: true,
        default: '0',
      },
    ],
    subfields: [
      { code: 'u', label: 'Uniform Resource Identifier（$u）', value_kind: 'url', repeatable: true, required: true },
      { code: 'y', label: 'Link text（$y）', value_kind: 'text', repeatable: true },
      { code: 'z', label: 'Public note（$z）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Access method（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },

  // 880：alternate graphic representation
  '880': {
    kind: 'data',
    tag: '880',
    label: '880 — Alternate Graphic Representation',
    repeatable: true,
    indicators: [
      { label: 'ind1', options: [option('', '（空白）')], allow_other: true, default: '' },
      { label: 'ind2', options: [option('', '（空白）')], allow_other: true, default: '' },
    ],
    subfields: [
      { code: '6', label: 'Linkage（$6；必填）', value_kind: 'code', repeatable: false, required: true },
      { code: 'a', label: 'Field-specific data（$a）', value_kind: 'text', repeatable: true },
      ...commonLinkingSubfields(),
    ],
  },

  // 887：非 MARC 資訊（常見於批次匯入/機器產生 metadata）
  '887': {
    kind: 'data',
    tag: '887',
    label: '887 — Non-MARC Information Field',
    repeatable: true,
    indicators: [blankOnlyIndicator('ind1'), blankOnlyIndicator('ind2')],
    subfields: [
      { code: 'a', label: 'Non-MARC information（$a）', value_kind: 'text', repeatable: true },
      { code: '2', label: 'Source（$2）', value_kind: 'code', repeatable: false },
      ...commonLinkingSubfields(),
    ],
  },
};

function normalizeSubfieldSpecs(subfields: Marc21SubfieldSpec[]): Marc21SubfieldSpec[] {
  // 允許 field spec 透過「先列 field-specific，再 spread common」的方式組合子欄位。
  // 這裡做一次去重（保留第一個定義），避免 UI 下拉選單出現重複 code。
  const seen = new Set<string>();
  const out: Marc21SubfieldSpec[] = [];
  for (const s of subfields) {
    if (!s?.code) continue;
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    out.push(s);
  }
  return out;
}

const MARC21_BIB_FIELDS_NORMALIZED: Record<string, Marc21FieldSpec> = Object.fromEntries(
  Object.entries(MARC21_BIB_FIELDS).map(([tag, spec]) => {
    if (spec.kind !== 'data') return [tag, spec];
    const normalized: Marc21DataFieldSpec = {
      ...spec,
      subfields: normalizeSubfieldSpecs(spec.subfields),
      subfields_allow_other: spec.subfields_allow_other ?? true,
    };
    return [tag, normalized];
  }),
) as Record<string, Marc21FieldSpec>;

export function getMarc21FieldSpec(tag: string): Marc21FieldSpec | null {
  const key = (tag ?? '').trim();
  return MARC21_BIB_FIELDS_NORMALIZED[key] ?? null;
}

export function listMarc21FieldSpecs() {
  return Object.values(MARC21_BIB_FIELDS_NORMALIZED).sort((a, b) => a.tag.localeCompare(b.tag));
}

export function getSubfieldSpec(spec: Marc21DataFieldSpec, code: string): Marc21SubfieldSpec | null {
  const key = (code ?? '').trim();
  if (!key) return null;
  return spec.subfields.find((s) => s.code === key) ?? null;
}

export function createEmptyFieldFromSpec(tag: string): MarcField {
  const trimmed = (tag ?? '').trim();
  const spec = getMarc21FieldSpec(trimmed);
  if (!spec) {
    // fallback：unknown tag → 依 tag number 決定 control/data
    if (/^[0-9]{3}$/.test(trimmed) && isControlTag(trimmed)) return { tag: trimmed, value: '' };
    return { tag: trimmed, ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '' }] };
  }

  if (spec.kind === 'control') return { tag: spec.tag, value: '' };

  // data field：指標用 default；子欄位先放 required（若沒有 required，就放第一個子欄位）
  const ind1 = normalizeIndicator(spec.indicators[0].default ?? spec.indicators[0].options[0]?.code ?? '');
  const ind2 = normalizeIndicator(spec.indicators[1].default ?? spec.indicators[1].options[0]?.code ?? '');

  const requiredCodes = spec.subfields.filter((s) => s.required).map((s) => s.code);
  const initialCodes = requiredCodes.length > 0 ? requiredCodes : [spec.subfields[0]?.code ?? 'a'];

  const subfields: MarcSubfield[] = initialCodes
    .filter(Boolean)
    .map((code) => ({ code, value: '' }));

  return {
    tag: spec.tag,
    ind1: ind1 === '' ? ' ' : ind1,
    ind2: ind2 === '' ? ' ' : ind2,
    subfields: subfields.length > 0 ? subfields : [{ code: 'a', value: '' }],
  };
}

function validateControlValue(tag: string, value: string, rules: Marc21ControlFieldSpec['value']): string[] {
  const errors: string[] = [];
  const v = value ?? '';

  if (rules.exact_length !== undefined && v.length !== rules.exact_length) {
    errors.push(`${tag} value 長度必須等於 ${rules.exact_length}`);
  }
  if (rules.min_length !== undefined && v.length < rules.min_length) {
    errors.push(`${tag} value 長度至少 ${rules.min_length}`);
  }
  if (rules.max_length !== undefined && v.length > rules.max_length) {
    errors.push(`${tag} value 長度不可超過 ${rules.max_length}`);
  }
  if (rules.pattern && !rules.pattern.test(v)) {
    errors.push(`${tag} value 格式不符合規則`);
  }

  return errors;
}

function validateSubfieldValue(sf: MarcSubfield, spec: Marc21SubfieldSpec | null): string[] {
  const errors: string[] = [];
  const value = sf.value ?? '';

  // 未列入字典：不做值驗證（避免誤擋）
  if (!spec) return errors;

  if (spec.max_length !== undefined && value.length > spec.max_length) {
    errors.push(`$${sf.code} 長度不可超過 ${spec.max_length}`);
  }

  if (spec.pattern && !spec.pattern.test(value)) {
    errors.push(`$${sf.code} 格式不符合規則`);
  }

  if (spec.value_kind === 'year' && value.trim()) {
    if (!/^[0-9]{4}$/.test(value.trim())) errors.push(`$${sf.code} 應為 4 位數年份`);
  }

  if (spec.value_kind === 'url' && value.trim()) {
    // 最小 URL 驗證：避免把明顯不是 URL 的字串塞進 856$u
    // - 不強制完整 RFC（避免誤擋）
    if (!/^https?:\/\//i.test(value.trim())) errors.push(`$${sf.code} 應以 http(s):// 開頭`);
  }

  if (spec.value_kind === 'isbn' && value.trim()) {
    // ISBN：允許破折號與 X；不做 checksum（避免誤擋）
    const token = value.trim();
    if (!/^[0-9Xx\- ().]+$/.test(token)) errors.push(`$${sf.code} 只允許數字/X/破折號與常見附註字元`);
  }

  if (spec.value_kind === 'issn' && value.trim()) {
    // ISSN：通常是 8 碼（####-###X）；實務上也可能含空白/括號等附註，先做「保守字元集」驗證避免誤擋。
    const token = value.trim();
    if (!/^[0-9Xx\- ()]+$/.test(token)) errors.push(`$${sf.code} 只允許數字/X/破折號與常見附註字元`);
  }

  return errors;
}

function validateIndicatorValue(value: string, spec: Marc21IndicatorSpec): string[] {
  const errors: string[] = [];
  const normalized = normalizeIndicator(value);
  const allowed = new Set(spec.options.map((o) => o.code));
  if (!spec.allow_other && !allowed.has(normalized)) {
    errors.push(`指標值不合法（允許：${spec.options.map((o) => o.code || '␠').join(', ')}）`);
  }
  return errors;
}

export function validateMarcFieldWithDictionary(field: MarcField): Marc21Issue[] {
  const issues: Marc21Issue[] = [];
  const pushError = (path: Marc21Issue['path'], message: string) => issues.push({ level: 'error', path, message });
  const pushWarning = (path: Marc21Issue['path'], message: string) => issues.push({ level: 'warning', path, message });

  const tag = String((field as any)?.tag ?? '').trim();
  if (!tag) {
    pushError(['tag'], '缺少 tag');
    return issues;
  }

  if (!/^[0-9]{3}$/.test(tag)) {
    pushError(['tag'], 'tag 必須是 3 位數字（例如 245）');
    return issues;
  }

  if (isSystemManagedTag(tag)) {
    pushError(['tag'], '000/001/005 為系統管理欄位（leader/控制號/時間戳），不可存入 marc_extras');
    return issues;
  }

  const spec = getMarc21FieldSpec(tag);

  // 若字典沒有這個 tag：僅做通用驗證（避免誤擋）
  if (!spec) {
    const shouldBeControl = isControlTag(tag);
    const isControl = !isMarcDataField(field);
    if (shouldBeControl && !isControl) pushError([], `tag ${tag} 屬於 control field（必須是 {tag,value}）`);
    if (!shouldBeControl && isControl) pushError([], `tag ${tag} 屬於 data field（必須有 ind1/ind2/subfields）`);
    return issues;
  }

  if (spec.kind === 'control') {
    if (isMarcDataField(field)) {
      pushError([], `tag ${tag} 屬於 control field（必須是 {tag,value}）`);
      return issues;
    }

    const value = String((field as any).value ?? '');
    for (const m of validateControlValue(tag, value, spec.value)) pushError(['value'], m);
    return issues;
  }

  // data field
  if (!isMarcDataField(field)) {
    pushError([], `tag ${tag} 屬於 data field（必須是 {tag,ind1,ind2,subfields}）`);
    return issues;
  }

  // indicators
  const ind1Errors = validateIndicatorValue(field.ind1 ?? '', spec.indicators[0]);
  for (const m of ind1Errors) pushError(['ind1'], m);

  const ind2Errors = validateIndicatorValue(field.ind2 ?? '', spec.indicators[1]);
  for (const m of ind2Errors) pushError(['ind2'], m);

  // subfields
  const allowedCodes = new Set(spec.subfields.map((s) => s.code));
  const subfields = field.subfields ?? [];

  // required subfields
  const required = spec.subfields.filter((s) => s.required).map((s) => s.code);
  for (const code of required) {
    const has = subfields.some((sf) => (sf.code ?? '').trim() === code && (sf.value ?? '').trim());
    if (!has) {
      pushError(['subfields'], `缺少必填子欄位：$${code}`);
    }
  }

  const repeatableByCode = new Map(spec.subfields.map((s) => [s.code, s.repeatable !== false]));
  const seenNonRepeatable = new Set<string>();

  for (const [i, sf] of subfields.entries()) {
    const code = (sf.code ?? '').trim();
    if (!code || code.length !== 1) {
      pushError(['subfields', i, 'code'], 'subfield.code 必須是 1 個字元');
      continue;
    }

    if (!allowedCodes.has(code)) {
      if (spec.subfields_allow_other) {
        pushWarning(['subfields', i, 'code'], `tag ${tag} 未在字典列出子欄位 $${code}（仍允許儲存）`);
      } else {
        pushError(['subfields', i, 'code'], `tag ${tag} 不支援子欄位 $${code}`);
      }
      // 未知 code：不做值型別驗證（避免誤擋）
      continue;
    }

    const isRepeatable = repeatableByCode.get(code);
    if (isRepeatable === false) {
      if (seenNonRepeatable.has(code)) pushError(['subfields', i, 'code'], `$${code} 不可重複`);
      seenNonRepeatable.add(code);
    }

    const sfSpec = getSubfieldSpec(spec, code);
    for (const m of validateSubfieldValue(sf, sfSpec)) pushError(['subfields', i, 'value'], m);

    // managed_by_form：
    // - 代表「同一個 tag/subfield」其實有一部份是由本系統的表單欄位治理（不是讓你在 marc_extras 當真相來源）
    // - 若使用者在 marc_extras 編輯這些子欄位，匯出/merge 時可能會被 core fields 覆蓋 → 很容易造成「我明明改了但怎麼沒生效」
    // - 因此我們在驗證層給一個 warning（不阻擋儲存；但提醒使用者應改在表單/term-based 欄位編輯）
    if (sfSpec?.managed_by_form) {
      const v = String((sf as any).value ?? '').trim();
      if (v) {
        pushWarning(
          ['subfields', i, 'value'],
          `$${code} 由表單欄位治理（匯出/merge 時可能被覆蓋；建議改在書目表單/term-based 欄位編輯）`,
        );
      }
    }

    // $0（Authority record control number）：
    // - 我們的系統會把 authority_terms.id 以 `urn:uuid:<uuid>` 放進 $0（方便 roundtrip 與跨系統識別）
    // - 為了不誤擋外部 control number/URI：只有在偵測到 urn:uuid: 前綴時才做 UUID 格式驗證
    if (code === '0') {
      const v = String((sf as any).value ?? '').trim();
      if (/^urn:uuid:/i.test(v)) {
        const raw = v.replace(/^urn:uuid:/i, '').trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
          pushError(['subfields', i, 'value'], '$0 的 urn:uuid:... 格式不合法（應為 UUID）');
        }
      }
    }
  }

  // ----------------------------
  // Conditional rules（controlled vocabulary / authority linking）
  // ----------------------------
  //
  // 你希望「MARC 與 controlled vocabulary 的對應規則要定死」。
  // 這裡把最常見的兩種規則做成通用判斷：
  // - 指標=7（Source specified in $2）→ 必須有 $2
  // - 有 $2 → 指標必須為 7
  //
  // 注意：
  // - 我們用「字典是否提供 7 選項」+「該欄位是否允許 $2」來判斷是否套用
  // - 避免把 022 這種「$2 但不靠指標 7」的欄位誤套用
  const has2 = subfields.some((sf) => (sf.code ?? '').trim() === '2' && String((sf as any).value ?? '').trim());
  const ind1 = normalizeIndicator(field.ind1 ?? '');
  const ind2 = normalizeIndicator(field.ind2 ?? '');
  const ind1Has7 = spec.indicators[0]?.options?.some((o) => o.code === '7') ?? false;
  const ind2Has7 = spec.indicators[1]?.options?.some((o) => o.code === '7') ?? false;

  if (allowedCodes.has('2') && ind1Has7) {
    if (ind1 === '7' && !has2) pushError(['subfields'], 'ind1=7（Source specified in $2）時，必須提供 $2');
    if (has2 && ind1 !== '7') pushError(['ind1'], '存在 $2 時，ind1 必須為 7（Source specified in $2）');
  }

  if (allowedCodes.has('2') && ind2Has7) {
    if (ind2 === '7' && !has2) pushError(['subfields'], 'ind2=7（Source specified in $2）時，必須提供 $2');
    if (has2 && ind2 !== '7') pushError(['ind2'], '存在 $2 時，ind2 必須為 7（Source specified in $2）');
  }

  return issues;
}
