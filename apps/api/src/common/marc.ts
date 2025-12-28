/**
 * MARC 21（MVP → 進階編目基礎層）
 *
 * 你在本專案的決策是：
 * 1) 「表單欄位」是可治理的真相來源（title/creators/subjects/...）
 * 2) MARC 21 是「交換/輸出格式」：由表單欄位產生
 * 3) 但仍要能保留/編輯「表單尚未覆蓋」的 MARC 欄位 → 透過 bibliographic_records.marc_extras
 *
 * 因此這個檔案提供三件事（都不引入外部依賴，避免被網路/套件綁住）：
 * - MARC record 的最小資料結構（JSON-friendly）
 * - 由 bibliographic_records（表單欄位）產生 MARC record（含 extras）
 * - 將 MARC record 序列化成：
 *   - MARCXML（可人讀/可交換）
 *   - ISO2709（.mrc；圖書館系統傳統交換格式）
 *
 * 注意：
 * - 這裡先落地「可用的最小集合」：245/100/700/264/020/041/650/651/655/082/084 + 001/005
 * - 不是完整 RDA/AACR2/MARC cataloging rules 引擎；後續會再擴充欄位、指標、子欄位與 authority control。
 */

import {
  applyMarcIndicatorsForVocabulary,
  formatAuthorityControlNumber as formatAuthorityControlNumberShared,
} from '@library-system/shared';

// ----------------------------
// 1) Types：JSON-friendly MARC structure
// ----------------------------

export type MarcSubfield = {
  // code：子欄位代碼（MARC 21 是單一字元，例如 a/b/c/x/2）
  code: string;
  // value：子欄位內容（UTF-8）
  value: string;
};

export type MarcControlField = {
  // tag：001..009 通常是 control fields（但我們不硬限制；由使用者/匯入決定）
  tag: string;
  value: string;
};

export type MarcDataField = {
  tag: string;
  // ind1/ind2：指標（每個 1 字元；空白指標用 ' '）
  ind1: string;
  ind2: string;
  subfields: MarcSubfield[];
};

export type MarcField = MarcControlField | MarcDataField;

export type MarcRecord = {
  // leader：24 chars（ISO2709 會需要；MARCXML 也會放）
  leader: string;
  fields: MarcField[];
};

export function isMarcDataField(field: MarcField): field is MarcDataField {
  return (field as any)?.subfields !== undefined;
}

// ----------------------------
// 2) Build：from our Bib row (form fields) + marc_extras
// ----------------------------

export type BibliographicForMarc = {
  id: string;
  title: string;
  creators: string[] | null;
  contributors: string[] | null;
  publisher: string | null;
  published_year: number | null;
  language: string | null;
  subjects: string[] | null;
  geographics: string[] | null;
  genres: string[] | null;
  isbn: string | null;
  classification: string | null;
  marc_extras: unknown; // DB 是 jsonb；先當 unknown，進到這層再做 sanitize
};

/**
 * BuildMarcRecordOptions
 *
 * 這裡刻意把「可能需要 DB 的資訊」拆成 options 注入，而不是在 common 層直接查 DB，原因：
 * - common 層保持純函式（pure-ish）：可測、可重用、可在不同 runtime 使用
 * - service 層才負責 IO（DB/RBAC/transaction）
 *
 * 目前先放：
 * - subjectVocabularyByLabel：用來把 650 補上 `$2`（thesaurus code），並把 ind2 設為 `7`
 */
export type BuildMarcRecordOptions = {
  subjectVocabularyByLabel?: Record<string, string>;
  // subjectAuthorityIdByLabel：把 subject heading（$a）對應到 authority term id（UUID）
  // - 匯出時會放進 650 的 $0（我們用 urn:uuid:... 格式，避免和外部 control number 混淆）
  subjectAuthorityIdByLabel?: Record<string, string>;
  // geographicVocabularyByLabel / geographicAuthorityIdByLabel：對應 MARC 651（地理名稱）
  geographicVocabularyByLabel?: Record<string, string>;
  geographicAuthorityIdByLabel?: Record<string, string>;
  // genreVocabularyByLabel / genreAuthorityIdByLabel：對應 MARC 655（類型/體裁）
  genreVocabularyByLabel?: Record<string, string>;
  genreAuthorityIdByLabel?: Record<string, string>;
  // nameAuthorityIdByLabel：把 name heading（100/700$a）對應到 authority term id（UUID）
  // - 匯出時會放進 100/700 的 $0（urn:uuid:...）
  nameAuthorityIdByLabel?: Record<string, string>;
};

/**
 * buildMarcRecordFromBibliographic
 *
 * 設計重點：
 * - 「表單欄位」永遠先生成一套 MARC core fields（可預期、可重現）
 * - 再把 marc_extras merge/append（保留未覆蓋欄位 + 避免重複欄位）
 *
 * 這樣可以同時滿足：
 * - UI 表單治理（欄位一致、可驗證）
 * - MARC 交換（不丟欄位）
 *
 * v1（本輪補齊的缺口）：
 * - 針對「部分對映」tags（100/245/264/650/651/655/700/020/041/082/084），做 subfields merge
 *   - 例：匯入時把 650$x/$y/$z/$2 放進 marc_extras，匯出時合併回同一個 650
 *   - 例：匯入時保留 700$e/$4（relator），匯出時合併回同一個 700
 * - 其餘 tags（246/250/300/490/830/505/520/更完整 6XX/7XX...）若在 extras 中，會原樣保留
 */
export function buildMarcRecordFromBibliographic(bib: BibliographicForMarc, options?: BuildMarcRecordOptions): MarcRecord {
  const creators = (bib.creators ?? []).map((v) => v.trim()).filter(Boolean);
  const contributors = (bib.contributors ?? []).map((v) => v.trim()).filter(Boolean);
  const subjects = (bib.subjects ?? []).map((v) => v.trim()).filter(Boolean);
  const geographics = (bib.geographics ?? []).map((v) => v.trim()).filter(Boolean);
  const genres = (bib.genres ?? []).map((v) => v.trim()).filter(Boolean);

  // subjectVocabularyByLabel：把 authority_terms.kind=subject 的 vocabulary_code 注入進來（可選）
  const subjectVocabularyByLabel = options?.subjectVocabularyByLabel ?? {};
  // subjectAuthorityIdByLabel：把 authority term id 注入進來（可選）
  const subjectAuthorityIdByLabel = options?.subjectAuthorityIdByLabel ?? {};
  const geographicVocabularyByLabel = options?.geographicVocabularyByLabel ?? {};
  const geographicAuthorityIdByLabel = options?.geographicAuthorityIdByLabel ?? {};
  const genreVocabularyByLabel = options?.genreVocabularyByLabel ?? {};
  const genreAuthorityIdByLabel = options?.genreAuthorityIdByLabel ?? {};
  const nameAuthorityIdByLabel = options?.nameAuthorityIdByLabel ?? {};

  // 1) leader：用 UTF-8 版本（leader[9]='a'）
  const leader = buildBaseLeaderUtf8();

  // 2) control fields：001（控制號；先用 bib UUID）+ 005（最後處理時間戳）
  const fields: MarcField[] = [];
  fields.push({ tag: '001', value: bib.id });
  fields.push({ tag: '005', value: formatMarc005(new Date()) });

  // 3) main entry（100）+ title（245）
  const mainCreator = creators[0] ?? null;
  let f100: MarcDataField | null = null;
  if (mainCreator) {
    const nameAuthorityId = getNameAuthorityId(nameAuthorityIdByLabel, mainCreator);
    f100 = {
      tag: '100',
      ind1: '1',
      ind2: ' ',
      subfields: [
        { code: 'a', value: mainCreator },
        ...(nameAuthorityId ? [{ code: '0', value: formatAuthorityControlNumber(nameAuthorityId) }] : []),
      ],
    };
    fields.push(f100);
  }

  // 245 ind1：若有 1XX（main entry）則為 1；否則 0
  const titleInd1 = mainCreator ? '1' : '0';
  const titleInd2 = '0'; // non-filing characters（英文冠詞）後續可擴充
  const titleSubfields = splitTitleTo245Subfields(bib.title);
  const f245: MarcDataField = {
    tag: '245',
    ind1: titleInd1,
    ind2: titleInd2,
    // v1：若題名包含「主題名 : 副題名」，嘗試拆成 245$a/$b（避免匯入後保留 $b 造成重複）
    subfields: titleSubfields,
  };
  fields.push(f245);

  // 4) added entries（700）：把 creators 的其餘作者 + contributors 都放在 700$a
  //
  // 注意：
  // - 這是「MVP 的最小可用映射」
  // - 真正 MARC 21 會區分個人名/團體名（100/110/111/700/710/711），也會有 relator code（$e/$4）
  const moreCreators = creators.slice(1);
  const f700List: MarcDataField[] = [];
  for (const name of [...moreCreators, ...contributors]) {
    const nameAuthorityId = getNameAuthorityId(nameAuthorityIdByLabel, name);
    const f700: MarcDataField = {
      tag: '700',
      ind1: '1',
      ind2: ' ',
      subfields: [
        { code: 'a', value: name },
        ...(nameAuthorityId ? [{ code: '0', value: formatAuthorityControlNumber(nameAuthorityId) }] : []),
      ],
    };
    f700List.push(f700);
    fields.push(f700);
  }

  // 5) publication（264）
  //
  // 264 ind2='1' 表示 publication（RDA 常見）；260 是 AACR2 舊格式
  const pubSubfields: MarcSubfield[] = [];
  if (bib.publisher?.trim()) pubSubfields.push({ code: 'b', value: bib.publisher.trim() });
  if (typeof bib.published_year === 'number') pubSubfields.push({ code: 'c', value: String(bib.published_year) });
  let f264: MarcDataField | null = null;
  if (pubSubfields.length > 0) {
    f264 = { tag: '264', ind1: ' ', ind2: '1', subfields: pubSubfields };
    fields.push(f264);
  }

  // 6) language（041$a）
  let f041: MarcDataField | null = null;
  if (bib.language?.trim()) {
    f041 = {
      tag: '041',
      ind1: ' ',
      ind2: ' ',
      subfields: [{ code: 'a', value: bib.language.trim() }],
    };
    fields.push(f041);
  }

  // 7) ISBN（020$a）
  let f020: MarcDataField | null = null;
  if (bib.isbn?.trim()) {
    f020 = {
      tag: '020',
      ind1: ' ',
      ind2: ' ',
      subfields: [{ code: 'a', value: bib.isbn.trim() }],
    };
    fields.push(f020);
  }

  // 8) classification（082/084）
  //
  // 你的需求：同時支援 DDC 與 中文圖書分類法（CCL），且 DDC 主要用於英文類書籍。
  // MVP 的先行策略：
  // - 若 language 以 en 開頭 → 082（DDC）
  // - 其他 → 084 + $2 ccl（先用代碼表明 scheme，後續可做更完整的 mapping）
  let f082: MarcDataField | null = null;
  let f084: MarcDataField | null = null;
  if (bib.classification?.trim()) {
    const classValue = bib.classification.trim();
    const lang = (bib.language ?? '').trim().toLowerCase();
    const isEnglish = lang === 'en' || lang.startsWith('en-') || lang === 'eng';
    if (isEnglish) {
      f082 = {
        tag: '082',
        ind1: '0',
        ind2: '4',
        subfields: [{ code: 'a', value: classValue }],
      };
      fields.push(f082);
    } else {
      f084 = {
        tag: '084',
        ind1: ' ',
        ind2: ' ',
        subfields: [
          { code: 'a', value: classValue },
          { code: '2', value: 'ccl' },
        ],
      };
      fields.push(f084);
    }
  }

  // 9) subjects（650$a）
  const f650List: MarcDataField[] = [];
  for (const s of subjects) {
    const vocab = getSubjectVocabularyCode(subjectVocabularyByLabel, s);
    const subjectAuthorityId = getSubjectAuthorityId(subjectAuthorityIdByLabel, s);

    // 650 指標規則（單一真相來源）：由 shared mapping 決定
    // - 當（且僅當）$2 有值 → ind2=7
    // - 否則回到保守預設（4：source not specified）
    const indicators = applyMarcIndicatorsForVocabulary('650', { ind1: ' ', ind2: ' ' }, vocab);

    const subfields: MarcSubfield[] = [{ code: 'a', value: s }];
    // $0：authority term id（linking）
    // - 用 URN 表達「這是 UUID」（避免被誤解成其他系統的 control number）
    if (subjectAuthorityId) subfields.push({ code: '0', value: formatAuthorityControlNumber(subjectAuthorityId) });
    if (vocab) subfields.push({ code: '2', value: vocab });

    const f650: MarcDataField = {
      tag: '650',
      ind1: indicators.ind1,
      ind2: indicators.ind2,
      subfields,
    };
    f650List.push(f650);
    fields.push(f650);
  }

  // 9.1) geographics（651$a）
  const f651List: MarcDataField[] = [];
  for (const g of geographics) {
    const vocab = getGeographicVocabularyCode(geographicVocabularyByLabel, g);
    const geographicAuthorityId = getGeographicAuthorityId(geographicAuthorityIdByLabel, g);

    const indicators = applyMarcIndicatorsForVocabulary('651', { ind1: ' ', ind2: ' ' }, vocab);

    const subfields: MarcSubfield[] = [{ code: 'a', value: g }];
    if (geographicAuthorityId) subfields.push({ code: '0', value: formatAuthorityControlNumber(geographicAuthorityId) });
    if (vocab) subfields.push({ code: '2', value: vocab });

    const f651: MarcDataField = { tag: '651', ind1: indicators.ind1, ind2: indicators.ind2, subfields };
    f651List.push(f651);
    fields.push(f651);
  }

  // 9.2) genres（655$a）
  const f655List: MarcDataField[] = [];
  for (const g of genres) {
    const vocab = getGenreVocabularyCode(genreVocabularyByLabel, g);
    const genreAuthorityId = getGenreAuthorityId(genreAuthorityIdByLabel, g);

    // 655 指標規則（單一真相來源）：由 shared mapping 決定
    // - 當（且僅當）$2 有值 → ind1=7（source specified in $2）
    // - 否則回到保守預設（0：basic）
    const indicators = applyMarcIndicatorsForVocabulary('655', { ind1: '0', ind2: ' ' }, vocab);

    const subfields: MarcSubfield[] = [{ code: 'a', value: g }];
    if (genreAuthorityId) subfields.push({ code: '0', value: formatAuthorityControlNumber(genreAuthorityId) });
    if (vocab) subfields.push({ code: '2', value: vocab });

    // 655 ind2：Undefined → 慣例留空白（shared 規則也會保持 ind2=' '）
    const f655: MarcDataField = { tag: '655', ind1: indicators.ind1, ind2: ' ', subfields };
    f655List.push(f655);
    fields.push(f655);
  }

  // 10) extras：保留「表單未覆蓋」的欄位
  const extras = sanitizeMarcExtras(bib.marc_extras);

  // 安全：禁止 extras 覆蓋 001/005（這兩個我們視為系統管理欄位）
  // - 同時也排除 000（leader 不應以 tag=000 出現；leader 由 record.leader 表達）
  const filteredExtras = extras.filter((f) => f.tag !== '000' && f.tag !== '001' && f.tag !== '005');

  // 11) merge：把「部分對映」欄位的 subfields 合併（避免重複、也避免丟細節）
  //
  // 合併策略（重點）：
  // - 245：保留 extras 的 ind2（non-filing），並保留 $b/$c/$6/$8... 等未在表單治理的子欄位
  // - 264：保留 extras 的 $a（place）等子欄位，並用表單值覆蓋/補齊 $b/$c
  // - 650/651/655：依 $a 對應合併，保留 subdivisions（$x/$y/$z）與 linking（$0/$2）等進階子欄位
  // - 700/100：依 $a 對應合併，保留 relator（$e/$4）與其他細節
  //
  // 注意：我們不把「整筆 extras」當成真相來源；表單欄位仍優先覆蓋 `$a/$b/$c` 等核心值。
  const consumedExtraIndexes = new Set<number>();

  // 11.1 100 merge（main creator）
  if (f100) {
    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '100');
    if (matched) {
      const idx = fields.indexOf(f100);
      if (idx >= 0) fields.splice(idx, 1, mergeNameFieldPreferCoreA(f100, matched.field));
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.2 245 merge（title）
  {
    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '245');
    if (matched) {
      const idx = fields.indexOf(f245);
      if (idx >= 0) fields.splice(idx, 1, merge245PreferCore(matched.field, f245));
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.3 264 merge（publication）
  if (f264) {
    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '264', (f) => ensureIndicator(f.ind2) === '1');
    if (matched) {
      const idx = fields.indexOf(f264);
      if (idx >= 0) fields.splice(idx, 1, merge264PreferCoreBc(matched.field, f264));
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.4 041 merge（language）
  //
  // 041$a：由表單 language 產生（可治理）
  // - 但匯入資料常會在 041 放更多細節（多語、翻譯語言、原文等），因此我們把 extras 合併回來
  if (f041) {
    // 先嘗試找「已包含 core 語言」的 041，再 fallback 到第一筆 041
    const coreLang = getFirstSubfieldValue(f041, 'a') ?? '';
    const coreKey = normalizeHeadingKey(coreLang);

    const preferred =
      coreKey && coreLang
        ? findExtraDataField(filteredExtras, consumedExtraIndexes, '041', (f) =>
            getSubfieldValues(f, 'a')
              .map((v) => normalizeHeadingKey(v))
              .includes(coreKey),
          )
        : null;

    const matched = preferred ?? findExtraDataField(filteredExtras, consumedExtraIndexes, '041');
    if (matched) {
      const idx = fields.indexOf(f041);
      if (idx >= 0) fields.splice(idx, 1, merge041PreferCoreA(matched.field, f041));
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.5 020 merge（ISBN）
  //
  // 020$a：由表單 isbn 產生（可治理）
  // - 但匯入資料常會在 020 放 $q（qualifying info）、$c（terms of availability）等，因此合併回來
  if (f020) {
    const coreIsbn = getFirstSubfieldValue(f020, 'a') ?? '';
    const coreKey = normalizeIsbnKey(coreIsbn);

    const preferred =
      coreKey && coreIsbn
        ? findExtraDataField(filteredExtras, consumedExtraIndexes, '020', (f) => normalizeIsbnKey(getFirstSubfieldValue(f, 'a')) === coreKey)
        : null;

    const matched = preferred ?? findExtraDataField(filteredExtras, consumedExtraIndexes, '020');
    if (matched) {
      const idx = fields.indexOf(f020);
      if (idx >= 0) fields.splice(idx, 1, merge020PreferCoreA(matched.field, f020));
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.6 082/084 merge（classification）
  //
  // 我們的表單只有一個 classification 欄位，因此目前只會生成一筆 082 或 084。
  // - 匯入資料可能還帶有 edition/source 等子欄位（例如 082$2、084$2），因此需要合併保留
  if (f082) {
    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '082');
    if (matched) {
      const idx = fields.indexOf(f082);
      if (idx >= 0) fields.splice(idx, 1, merge082PreferCoreA(matched.field, f082));
      consumedExtraIndexes.add(matched.index);
    }
  }
  if (f084) {
    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '084');
    if (matched) {
      const idx = fields.indexOf(f084);
      if (idx >= 0) fields.splice(idx, 1, merge084PreferCoreAAndSource(matched.field, f084));
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.7 650 merge（subjects）
  //
  // 對每個 core 650，找一個同 `$a` 的 extras 650 合併；找不到就維持 core
  for (const f650 of f650List) {
    const a = getFirstSubfieldValue(f650, 'a');
    if (!a) continue;

    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '650', (f) => normalizeHeadingKey(getFirstSubfieldValue(f, 'a')) === normalizeHeadingKey(a));
    if (matched) {
      const merged = merge650PreferCoreAAndVocabulary(matched.field, f650, subjectVocabularyByLabel);
      const idx = fields.indexOf(f650);
      if (idx >= 0) fields.splice(idx, 1, merged);
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.8 651 merge（geographics）
  for (const f651 of f651List) {
    const a = getFirstSubfieldValue(f651, 'a');
    if (!a) continue;

    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '651', (f) => normalizeHeadingKey(getFirstSubfieldValue(f, 'a')) === normalizeHeadingKey(a));
    if (matched) {
      const merged = merge651PreferCoreAAndVocabulary(matched.field, f651, geographicVocabularyByLabel);
      const idx = fields.indexOf(f651);
      if (idx >= 0) fields.splice(idx, 1, merged);
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.9 655 merge（genres）
  for (const f655 of f655List) {
    const a = getFirstSubfieldValue(f655, 'a');
    if (!a) continue;

    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '655', (f) => normalizeHeadingKey(getFirstSubfieldValue(f, 'a')) === normalizeHeadingKey(a));
    if (matched) {
      const merged = merge655PreferCoreAAndVocabulary(matched.field, f655, genreVocabularyByLabel);
      const idx = fields.indexOf(f655);
      if (idx >= 0) fields.splice(idx, 1, merged);
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.10 700 merge（added entries）
  for (const f700 of f700List) {
    const a = getFirstSubfieldValue(f700, 'a');
    if (!a) continue;

    const matched = findExtraDataField(filteredExtras, consumedExtraIndexes, '700', (f) => normalizeHeadingKey(getFirstSubfieldValue(f, 'a')) === normalizeHeadingKey(a));
    if (matched) {
      const idx = fields.indexOf(f700);
      if (idx >= 0) fields.splice(idx, 1, mergeNameFieldPreferCoreA(f700, matched.field));
      consumedExtraIndexes.add(matched.index);
    }
  }

  // 11.11 append remaining extras（包含：246/250/300/490/830/505/520、更完整 6XX/7XX…）
  const remainingExtras = filteredExtras.filter((_, i) => !consumedExtraIndexes.has(i));
  return { leader, fields: [...fields, ...remainingExtras] };
}

/**
 * sanitizeMarcExtras
 *
 * marc_extras 是 jsonb，因此 DB 層沒有型別保護；
 * 我們在輸出前做一次 sanitize：
 * - 不是 array → 當成空
 * - element 不是 object → 丟掉
 * - datafield/controlfield 形狀不對 → 丟掉
 *
 * 取捨：
 * - 這裡選擇「丟掉不合法資料」而不是整個報錯，原因：
 *   1) 進階欄位通常由匯入/編輯器產生，開發早期可能會有格式演進
 *   2) 我們希望「至少核心欄位可輸出」，不要因少量髒資料讓整筆書目無法匯出
 *
 * 若你想把資料品質提升到「不合法就拒絕」，可以改成回傳 errors 讓 UI 顯示並要求修正。
 */
export function sanitizeMarcExtras(value: unknown): MarcField[] {
  if (!Array.isArray(value)) return [];

  const out: MarcField[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as any;

    const tag = typeof obj.tag === 'string' ? obj.tag.trim() : '';
    if (!/^[0-9]{3}$/.test(tag)) continue;

    // control field：{ tag, value }
    if (typeof obj.value === 'string') {
      out.push({ tag, value: obj.value });
      continue;
    }

    // data field：{ tag, ind1, ind2, subfields:[{code,value}] }
    const ind1 = typeof obj.ind1 === 'string' ? ensureIndicator(obj.ind1) : null;
    const ind2 = typeof obj.ind2 === 'string' ? ensureIndicator(obj.ind2) : null;
    if (!ind1 || !ind2) continue;

    if (!Array.isArray(obj.subfields)) continue;
    const subfields: MarcSubfield[] = [];
    for (const sf of obj.subfields) {
      if (!sf || typeof sf !== 'object') continue;
      const code = typeof (sf as any).code === 'string' ? (sf as any).code.trim() : '';
      const v = typeof (sf as any).value === 'string' ? (sf as any).value : null;
      if (!code || code.length !== 1) continue;
      if (v === null) continue;
      subfields.push({ code, value: v });
    }
    if (subfields.length === 0) continue;

    out.push({ tag, ind1, ind2, subfields });
  }

  return out;
}

function ensureIndicator(value: string) {
  // MARC 指標是「1 個字元」；空字串視為空白指標
  if (value.length === 0) return ' ';
  return value.slice(0, 1);
}

function normalizeHeadingKey(value: string | null | undefined) {
  // 用於合併 6XX/7XX：同一個 heading 可能有結尾標點或大小寫差異
  // - 這裡故意保持「保守」：只做 trim + 去掉常見結尾標點 + lower
  // - 不做中文斷詞/authority normalization（那屬於後續權威控制/詞彙處理 pipeline）
  const v = (value ?? '').trim();
  if (!v) return '';
  return v.replace(/[\\s\\/:;,.]+$/g, '').trim().toLowerCase();
}

function getFirstSubfieldValue(field: MarcDataField, code: string) {
  for (const sf of field.subfields ?? []) {
    if (sf.code === code) return sf.value ?? '';
  }
  return null;
}

function getSubfieldValues(field: MarcDataField, code: string) {
  const out: string[] = [];
  for (const sf of field.subfields ?? []) {
    if (sf.code !== code) continue;
    const v = (sf.value ?? '').trim();
    if (!v) continue;
    out.push(v);
  }
  return out;
}

function normalizeIsbnKey(value: string | null | undefined) {
  // ISBN 常見雜訊：
  // - "9789573317248 (pbk.)"
  // - "978-957-33-1724-8"
  //
  // 我們用「保守的抽取」做 key：
  // - 抽出 10..20 長度的 [0-9X-]
  // - 去掉破折號
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const token = (raw.match(/([0-9Xx-]{10,20})/)?.[1] ?? raw).trim();
  return token.replaceAll('x', 'X').replaceAll('-', '');
}

function getVocabularyCodeByLabel(vocabularyByLabel: Record<string, string>, label: string) {
  // 以「表單欄位的 heading」為 key 查 vocabulary_code：
  // - key 以 normalizeHeadingKey 做最小正規化（避免多一個句點就 miss）
  const key = normalizeHeadingKey(label);
  if (!key) return null;

  // 注意：這個 map 由 service 層建立，因此這裡同時嘗試：
  // - 原字串 key（保留大小寫）
  // - normalize 後 key
  return vocabularyByLabel[label] ?? vocabularyByLabel[key] ?? null;
}

function getAuthorityIdByLabel(authorityIdByLabel: Record<string, string>, label: string) {
  const key = normalizeHeadingKey(label);
  if (!key) return null;
  return authorityIdByLabel[label] ?? authorityIdByLabel[key] ?? null;
}

function getSubjectVocabularyCode(subjectVocabularyByLabel: Record<string, string>, subjectLabel: string) {
  return getVocabularyCodeByLabel(subjectVocabularyByLabel, subjectLabel);
}

function getSubjectAuthorityId(subjectAuthorityIdByLabel: Record<string, string>, subjectLabel: string) {
  return getAuthorityIdByLabel(subjectAuthorityIdByLabel, subjectLabel);
}

function getGeographicVocabularyCode(geographicVocabularyByLabel: Record<string, string>, label: string) {
  return getVocabularyCodeByLabel(geographicVocabularyByLabel, label);
}

function getGeographicAuthorityId(geographicAuthorityIdByLabel: Record<string, string>, label: string) {
  return getAuthorityIdByLabel(geographicAuthorityIdByLabel, label);
}

function getGenreVocabularyCode(genreVocabularyByLabel: Record<string, string>, label: string) {
  return getVocabularyCodeByLabel(genreVocabularyByLabel, label);
}

function getGenreAuthorityId(genreAuthorityIdByLabel: Record<string, string>, label: string) {
  return getAuthorityIdByLabel(genreAuthorityIdByLabel, label);
}

function getNameAuthorityId(nameAuthorityIdByLabel: Record<string, string>, nameLabel: string) {
  return getAuthorityIdByLabel(nameAuthorityIdByLabel, nameLabel);
}

function formatAuthorityControlNumber(uuidOrUrn: string) {
  // 保留這個 wrapper（避免大範圍改動 call sites），但把規則交給 shared：單一真相來源。
  return formatAuthorityControlNumberShared(uuidOrUrn);
}

function splitTitleTo245Subfields(title: string): MarcSubfield[] {
  // 題名拆分（非常保守的 heuristics）：
  // - 我們的 DB 只有一個 title 欄位，但 MARC 21 的 245 常見分成：
  //   - $a Title
  //   - $b Remainder of title（副題名/其餘題名資訊）
  //
  // 因此我們用「最小策略」：
  // 1) 若含 ` : `（我們自己的匯入/映射也會用這個串接）→ 取第一段為 $a，其餘合併為 $b
  // 2) 若含 `：`（中文常見）→ 同上
  //
  // 取捨：
  // - 這不是完整 245$a/$b/$n/$p 的可逆 mapping（後續要靠 MARC editor 或擴充資料模型）
  // - 但能避免「匯入保留 245$b」後，匯出時 `$a` 又含副題名導致重複
  const trimmed = (title ?? '').trim();
  if (!trimmed) return [{ code: 'a', value: '' }];

  const splitBy = (sep: string) => {
    const parts = trimmed.split(sep).map((p) => p.trim()).filter((p) => p);
    if (parts.length <= 1) return null;
    return { a: parts[0]!, b: parts.slice(1).join(sep).trim() };
  };

  const byAsciiColon = splitBy(' : ');
  if (byAsciiColon) {
    const out: MarcSubfield[] = [{ code: 'a', value: byAsciiColon.a }];
    if (byAsciiColon.b) out.push({ code: 'b', value: byAsciiColon.b });
    return out;
  }

  const byZhColon = splitBy('：');
  if (byZhColon) {
    const out: MarcSubfield[] = [{ code: 'a', value: byZhColon.a }];
    if (byZhColon.b) out.push({ code: 'b', value: byZhColon.b });
    return out;
  }

  return [{ code: 'a', value: trimmed }];
}

type ExtraMatch = { index: number; field: MarcDataField };

function findExtraDataField(
  extras: MarcField[],
  consumed: Set<number>,
  tag: string,
  predicate?: (field: MarcDataField) => boolean,
): ExtraMatch | null {
  for (let i = 0; i < extras.length; i += 1) {
    if (consumed.has(i)) continue;
    const f = extras[i]!;
    if (f.tag !== tag) continue;
    if (!isMarcDataField(f)) continue;
    if (predicate && !predicate(f)) continue;
    return { index: i, field: f };
  }
  return null;
}

function mergeNameFieldPreferCoreA(core: MarcDataField, extra: MarcDataField): MarcDataField {
  // 100/700：優先用表單的 `$a`（館內治理資料），其餘子欄位（例如 $d 日期、$e/$4 relator、$0 authority id）保留
  const coreA = getFirstSubfieldValue(core, 'a') ?? '';
  const mergedSubfields: MarcSubfield[] = [{ code: 'a', value: coreA }];

  // v1：保留 core 的其他子欄位（例如 $0 authority id）
  for (const sf of core.subfields ?? []) {
    if (sf.code === 'a') continue;
    mergedSubfields.push(sf);
  }

  for (const sf of extra.subfields ?? []) {
    if (sf.code === 'a') continue; // 避免重複
    // 避免把完全相同的 subfield 重複塞兩次（常見於 $0/$4）
    if (mergedSubfields.some((x) => x.code === sf.code && x.value === sf.value)) continue;
    mergedSubfields.push(sf);
  }

  return {
    tag: core.tag,
    ind1: ensureIndicator(extra.ind1 ?? core.ind1),
    ind2: ensureIndicator(extra.ind2 ?? core.ind2),
    subfields: mergedSubfields,
  };
}

function merge245PreferCore(extra245: MarcDataField, core245: MarcDataField): MarcDataField {
  // 245：
  // - `$a/$b` 以表單為準（避免匯入後 UI 改了題名，匯出仍是舊題名）
  // - ind2（non-filing）以 extras 為準（表單目前沒有「略過冠詞字元數」欄位）
  // - 其餘子欄位（$b/$c/$h/$6/$8...）保留
  const mergedSubfields: MarcSubfield[] = [...(core245.subfields ?? [])];
  const codesInCore = new Set(mergedSubfields.map((sf) => sf.code));

  for (const sf of extra245.subfields ?? []) {
    if (codesInCore.has(sf.code)) continue; // 避免 `$a/$b` 等重複
    mergedSubfields.push(sf);
  }

  return {
    tag: '245',
    ind1: ensureIndicator(core245.ind1),
    ind2: ensureIndicator(extra245.ind2), // preserve non-filing
    subfields: mergedSubfields,
  };
}

function merge041PreferCoreA(extra041: MarcDataField, core041: MarcDataField): MarcDataField {
  // 041：
  // - `$a`（Language code）以表單為準（可治理欄位）
  // - 但匯入資料常包含更多語言細節（多個 `$a`、或 `$b/$d/$h` 等），因此我們：
  //   1) 先把 core 的 `$a` 放到最前面（確保可重現）
  //   2) 再保留 extras 的其他子欄位（含其他語言）
  const coreA = (getFirstSubfieldValue(core041, 'a') ?? '').trim();
  const coreKey = normalizeHeadingKey(coreA);

  const mergedSubfields: MarcSubfield[] = [];
  if (coreA) mergedSubfields.push({ code: 'a', value: coreA });

  for (const sf of extra041.subfields ?? []) {
    // 若 extras 已包含同一個 $a，就不重複加入（其餘語言照留）
    if (coreKey && sf.code === 'a' && normalizeHeadingKey(sf.value) === coreKey) continue;
    mergedSubfields.push(sf);
  }

  return {
    tag: '041',
    ind1: ensureIndicator(extra041.ind1 ?? core041.ind1),
    ind2: ensureIndicator(extra041.ind2 ?? core041.ind2),
    subfields: mergedSubfields.length > 0 ? mergedSubfields : core041.subfields,
  };
}

function merge020PreferCoreA(extra020: MarcDataField, core020: MarcDataField): MarcDataField {
  // 020：
  // - `$a`（ISBN）以表單為準（可治理欄位）
  // - 其餘子欄位（$q/$c/$z...）保留
  const coreA = getFirstSubfieldValue(core020, 'a') ?? '';
  const mergedSubfields: MarcSubfield[] = [{ code: 'a', value: coreA }];

  for (const sf of extra020.subfields ?? []) {
    if (sf.code === 'a') continue; // 避免重複
    mergedSubfields.push(sf);
  }

  return {
    tag: '020',
    ind1: ensureIndicator(extra020.ind1 ?? core020.ind1),
    ind2: ensureIndicator(extra020.ind2 ?? core020.ind2),
    subfields: mergedSubfields,
  };
}

function merge264PreferCoreBc(extra264: MarcDataField, core264: MarcDataField): MarcDataField {
  // 264：
  // - `$b/$c` 以表單為準（publisher/year 是可治理欄位）
  // - `$a`（place）、`$3`（materials specified）、以及其他未涵蓋子欄位保留
  const coreB = getFirstSubfieldValue(core264, 'b');
  const coreC = getFirstSubfieldValue(core264, 'c');

  const mergedSubfields: MarcSubfield[] = [];

  // 先保留 extras 中除了 b/c 以外的子欄位（避免 place 等資訊丟失）
  for (const sf of extra264.subfields ?? []) {
    if (sf.code === 'b' || sf.code === 'c') continue;
    mergedSubfields.push(sf);
  }

  // 再補上 b/c（以表單為準；若表單缺值就保留 extras）
  if (coreB && coreB.trim()) mergedSubfields.push({ code: 'b', value: coreB.trim() });
  else {
    const extraB = getFirstSubfieldValue(extra264, 'b');
    if (extraB && extraB.trim()) mergedSubfields.push({ code: 'b', value: extraB.trim() });
  }

  if (coreC && coreC.trim()) mergedSubfields.push({ code: 'c', value: coreC.trim() });
  else {
    const extraC = getFirstSubfieldValue(extra264, 'c');
    if (extraC && extraC.trim()) mergedSubfields.push({ code: 'c', value: extraC.trim() });
  }

  return {
    tag: '264',
    ind1: ensureIndicator(extra264.ind1 ?? core264.ind1),
    ind2: ensureIndicator(extra264.ind2 ?? core264.ind2),
    subfields: mergedSubfields.length > 0 ? mergedSubfields : core264.subfields,
  };
}

function merge082PreferCoreA(extra082: MarcDataField, core082: MarcDataField): MarcDataField {
  // 082：
  // - `$a`（Classification number）以表單為準（可治理欄位）
  // - 其餘子欄位（$2 edition、$b item number、$q...）保留
  const coreA = getFirstSubfieldValue(core082, 'a') ?? '';
  const mergedSubfields: MarcSubfield[] = [{ code: 'a', value: coreA }];

  for (const sf of extra082.subfields ?? []) {
    if (sf.code === 'a') continue;
    mergedSubfields.push(sf);
  }

  return {
    tag: '082',
    ind1: ensureIndicator(extra082.ind1 ?? core082.ind1),
    ind2: ensureIndicator(extra082.ind2 ?? core082.ind2),
    subfields: mergedSubfields,
  };
}

function merge084PreferCoreAAndSource(extra084: MarcDataField, core084: MarcDataField): MarcDataField {
  // 084：
  // - `$a` 以表單為準（可治理欄位）
  // - `$2`（Source of classification）若 extras 有就保留；否則才用 core（例如 MVP 預設 ccl）
  const coreA = getFirstSubfieldValue(core084, 'a') ?? '';
  const sourceFromExtra = getFirstSubfieldValue(extra084, '2');
  const sourceFromCore = getFirstSubfieldValue(core084, '2');
  const source = (sourceFromExtra ?? sourceFromCore ?? '').trim() || null;

  const mergedSubfields: MarcSubfield[] = [{ code: 'a', value: coreA }];
  if (source) mergedSubfields.push({ code: '2', value: source });

  const has2 = Boolean(source);
  for (const sf of extra084.subfields ?? []) {
    if (sf.code === 'a') continue;
    if (sf.code === '2' && has2) continue; // 避免 $2 重複（以 extras 優先）
    mergedSubfields.push(sf);
  }

  return {
    tag: '084',
    ind1: ensureIndicator(extra084.ind1 ?? core084.ind1),
    ind2: ensureIndicator(extra084.ind2 ?? core084.ind2),
    subfields: mergedSubfields,
  };
}

function merge650PreferCoreAAndVocabulary(
  extra650: MarcDataField,
  core650: MarcDataField,
  subjectVocabularyByLabel: Record<string, string>,
): MarcDataField {
  return merge6xxPreferCoreAAndVocabulary('650', extra650, core650, subjectVocabularyByLabel);
}

function merge651PreferCoreAAndVocabulary(
  extra651: MarcDataField,
  core651: MarcDataField,
  geographicVocabularyByLabel: Record<string, string>,
): MarcDataField {
  return merge6xxPreferCoreAAndVocabulary('651', extra651, core651, geographicVocabularyByLabel);
}

function merge655PreferCoreAAndVocabulary(
  extra655: MarcDataField,
  core655: MarcDataField,
  genreVocabularyByLabel: Record<string, string>,
): MarcDataField {
  const coreA = getFirstSubfieldValue(core655, 'a') ?? '';

  // vocabulary 推導優先順序：
  // 1) authority_terms（options 注入；term-based 最可靠）
  // 2) extras 既有 $2（代表匯入資料已標示 source）
  const vocabFromAuthority = getVocabularyCodeByLabel(genreVocabularyByLabel, coreA);
  const vocabFromExtra = getFirstSubfieldValue(extra655, '2');
  const vocab = vocabFromAuthority ?? vocabFromExtra ?? null;

  const mergedSubfields: MarcSubfield[] = [{ code: 'a', value: coreA }];

  // $0：允許 repeatable，但我們仍去掉「完全相同」的重複（避免匯入/匯出 roundtrip 逐次變長）
  const seen0 = new Set<string>();
  const pushSubfield = (sf: MarcSubfield) => {
    const code = (sf.code ?? '').trim();
    const value = (sf.value ?? '').trim();
    if (!code) return;
    if (code === '0') {
      if (!value) return;
      if (seen0.has(value)) return;
      seen0.add(value);
    }
    mergedSubfields.push(sf);
  };

  const has2 = Boolean(vocab);

  // 先保留 core 的其他子欄位（例如 $0）
  for (const sf of core655.subfields ?? []) {
    if (sf.code === 'a') continue;
    if (sf.code === '2') continue;
    pushSubfield(sf);
  }

  if (vocab) mergedSubfields.push({ code: '2', value: vocab });

  // 再合併 extras 的 subdivisions/連結欄位（$x/$y/$z/$0/$6/$8...）
  for (const sf of extra655.subfields ?? []) {
    if (sf.code === 'a') continue;
    if (sf.code === '2' && has2) continue;
    pushSubfield(sf);
  }

  // 655 indicators：
  // - ind1：有 $2 → 7（Source specified in $2）；否則保留 extras/core（若仍空白就 fallback 0）
  // - ind2：Undefined（保留 extras/core；通常是空白）
  const ind1FromExtraOrCore = ensureIndicator(extra655.ind1 ?? core655.ind1);
  const ind1 = vocab ? '7' : ind1FromExtraOrCore === ' ' ? '0' : ind1FromExtraOrCore;
  const ind2 = ensureIndicator(extra655.ind2 ?? core655.ind2);

  return {
    tag: '655',
    ind1,
    ind2,
    subfields: mergedSubfields,
  };
}

function merge6xxPreferCoreAAndVocabulary(
  tag: '650' | '651',
  extra: MarcDataField,
  core: MarcDataField,
  vocabularyByLabel: Record<string, string>,
): MarcDataField {
  const coreA = getFirstSubfieldValue(core, 'a') ?? '';

  // vocabulary 推導優先順序：
  // 1) authority_terms（options 注入；term-based 最可靠）
  // 2) extras 既有 $2（代表匯入資料已標示 source）
  const vocabFromAuthority = getVocabularyCodeByLabel(vocabularyByLabel, coreA);
  const vocabFromExtra = getFirstSubfieldValue(extra, '2');
  const vocab = vocabFromAuthority ?? vocabFromExtra ?? null;

  const mergedSubfields: MarcSubfield[] = [{ code: 'a', value: coreA }];

  // $0：允許 repeatable，但我們仍去掉「完全相同」的重複（避免匯入/匯出 roundtrip 逐次變長）
  const seen0 = new Set<string>();
  const pushSubfield = (sf: MarcSubfield) => {
    const code = (sf.code ?? '').trim();
    const value = (sf.value ?? '').trim();
    if (!code) return;
    if (code === '0') {
      if (!value) return;
      if (seen0.has(value)) return;
      seen0.add(value);
    }
    mergedSubfields.push(sf);
  };

  const has2 = Boolean(vocab);

  // 先保留 core 的其他子欄位（例如 $0）
  for (const sf of core.subfields ?? []) {
    if (sf.code === 'a') continue;
    if (sf.code === '2') continue;
    pushSubfield(sf);
  }

  if (vocab) mergedSubfields.push({ code: '2', value: vocab });

  // 再合併 extras 的 subdivisions/連結欄位（$x/$y/$z/$0/$6/$8...）
  for (const sf of extra.subfields ?? []) {
    if (sf.code === 'a') continue;
    if (sf.code === '2' && has2) continue;
    pushSubfield(sf);
  }

  // ind2：有 $2 → 7；否則保留 extras 原 ind2（若沒有就 fallback 4）
  const ind2 = vocab ? '7' : ensureIndicator(extra.ind2 || '4');

  return {
    tag,
    ind1: ensureIndicator(extra.ind1 ?? core.ind1),
    ind2,
    subfields: mergedSubfields,
  };
}

function buildBaseLeaderUtf8() {
  // leader = 24 chars
  // 我們先用空白填滿，再填入必要位置；record length 與 base address 由 ISO2709 序列化時補。
  const chars = Array.from({ length: 24 }, () => ' ');
  chars[5] = 'n'; // record status：new
  chars[6] = 'a'; // type of record：language material（先用 a）
  chars[7] = 'm'; // bibliographic level：monograph
  chars[9] = 'a'; // character coding scheme：UCS/Unicode（UTF-8）
  chars[10] = '2'; // indicator count
  chars[11] = '2'; // subfield code length
  // 12..16 = base address（先留 00000）
  for (let i = 12; i <= 16; i++) chars[i] = '0';
  // 20..23 = entry map（4500）
  chars[20] = '4';
  chars[21] = '5';
  chars[22] = '0';
  chars[23] = '0';
  return chars.join('');
}

function formatMarc005(date: Date) {
  // 005：Date and Time of Latest Transaction（YYYYMMDDHHMMSS.0）
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const mi = pad2(date.getUTCMinutes());
  const ss = pad2(date.getUTCSeconds());
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}.0`;
}

// ----------------------------
// 3) Serialize：MARCXML
// ----------------------------

export function serializeMarcXml(record: MarcRecord) {
  // MARCXML 的 namespace：MARC21 slim（常見交換格式）
  const ns = 'http://www.loc.gov/MARC21/slim';

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<record xmlns="${ns}">`);
  parts.push(`  <leader>${escapeXml(record.leader)}</leader>`);

  for (const field of record.fields) {
    if (isMarcDataField(field)) {
      parts.push(
        `  <datafield tag="${escapeXml(field.tag)}" ind1="${escapeXml(ensureIndicator(field.ind1))}" ind2="${escapeXml(ensureIndicator(field.ind2))}">`,
      );
      for (const sf of field.subfields) {
        parts.push(`    <subfield code="${escapeXml(sf.code)}">${escapeXml(sf.value)}</subfield>`);
      }
      parts.push(`  </datafield>`);
    } else {
      parts.push(`  <controlfield tag="${escapeXml(field.tag)}">${escapeXml(field.value)}</controlfield>`);
    }
  }

  parts.push(`</record>`);
  parts.push('');
  return parts.join('\n');
}

function escapeXml(value: string) {
  // 最小 XML escaping（MARCXML 不需要更複雜的 entity 處理）
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// ----------------------------
// 4) Serialize：ISO2709 (.mrc)
// ----------------------------

export function serializeIso2709(record: MarcRecord): Buffer {
  // ISO2709 常用控制字元：
  const FT = 0x1e; // field terminator
  const RT = 0x1d; // record terminator
  const SF = 0x1f; // subfield delimiter

  // 1) 把每個 field 先序列化成 bytes
  const fieldBuffers: Array<{ tag: string; buf: Buffer }> = [];

  for (const field of record.fields) {
    if (isMarcDataField(field)) {
      const chunks: Buffer[] = [];
      chunks.push(Buffer.from(ensureIndicator(field.ind1), 'utf8'));
      chunks.push(Buffer.from(ensureIndicator(field.ind2), 'utf8'));

      for (const sf of field.subfields) {
        const code = sf.code.slice(0, 1) || 'a';
        chunks.push(Buffer.from([SF]));
        chunks.push(Buffer.from(code, 'utf8'));
        chunks.push(Buffer.from(sf.value ?? '', 'utf8'));
      }

      // field terminator
      chunks.push(Buffer.from([FT]));
      fieldBuffers.push({ tag: field.tag, buf: Buffer.concat(chunks) });
    } else {
      // control field：value + FT
      fieldBuffers.push({
        tag: field.tag,
        buf: Buffer.concat([Buffer.from(field.value ?? '', 'utf8'), Buffer.from([FT])]),
      });
    }
  }

  // 2) 組 directory（每個 entry 12 bytes）：tag(3)+length(4)+start(5)
  //
  // length：包含 field terminator（FT）
  // start：相對於 base address 的位移
  let offset = 0;
  const dirEntries: string[] = [];
  for (const f of fieldBuffers) {
    const length = f.buf.length;
    const entry = `${f.tag.padStart(3, '0')}${String(length).padStart(4, '0')}${String(offset).padStart(5, '0')}`;
    dirEntries.push(entry);
    offset += length;
  }

  const directory = Buffer.concat([Buffer.from(dirEntries.join(''), 'utf8'), Buffer.from([FT])]);

  // 3) base address = leader(24) + directory bytes
  const baseAddress = 24 + directory.length;

  // 4) 組 record bytes（先用 placeholder leader，再填 record length/base address）
  const fieldsData = Buffer.concat(fieldBuffers.map((f) => f.buf));
  const recordWithoutLeader = Buffer.concat([directory, fieldsData, Buffer.from([RT])]);

  // leader：以 record.leader 為 base，但我們仍會強制填入：
  // - 0..4 record length
  // - 12..16 base address
  // 並確保 leader 長度為 24
  const leader = Buffer.from(fixLeader(record.leader, recordWithoutLeader.length + 24, baseAddress), 'utf8');

  return Buffer.concat([leader, recordWithoutLeader]);
}

function fixLeader(input: string, recordLength: number, baseAddress: number) {
  // leader 需要 24 chars；不足就補空白，超過就截斷
  const chars = Array.from({ length: 24 }, (_, i) => input[i] ?? ' ');

  // 0..4：record length（5 digits）
  const len = String(recordLength).padStart(5, '0').slice(-5);
  for (let i = 0; i < 5; i++) chars[i] = len[i]!;

  // 12..16：base address（5 digits）
  const base = String(baseAddress).padStart(5, '0').slice(-5);
  for (let i = 0; i < 5; i++) chars[12 + i] = base[i]!;

  // 10/11：indicator/subfield length（MARC21 固定 2/2）
  chars[10] = '2';
  chars[11] = '2';

  // 20..23：entry map（4500）
  chars[20] = '4';
  chars[21] = '5';
  chars[22] = '0';
  chars[23] = '0';

  return chars.join('');
}
