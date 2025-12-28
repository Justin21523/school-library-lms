'use client';

/**
 * MARC Field Dictionary Browser（/orgs/:orgId/bibs/marc-dictionary）
 *
 * 你希望 C) 有一個「MARC 欄位字典瀏覽器」：
 * - 欄位/指標/子欄位一覽 + 搜尋
 * - 讓館員不用背 3 位數字與子欄位 code
 *
 * 設計：
 * - 這頁完全不打 API：資料來源是 `app/lib/marc21.ts` 的 `MARC21_BIB_FIELDS`
 * - 目的不是「完整 MARC21 規格」（太大），而是「我們系統常用且有驗證」的欄位字典
 * - 若要擴充：直接在 `MARC21_BIB_FIELDS` 加 spec，這頁會自動出現
 */

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import { listMarc21FieldSpecs, type Marc21DataFieldSpec, type Marc21FieldSpec } from '../../../../lib/marc21';

function isDataSpec(spec: Marc21FieldSpec): spec is Marc21DataFieldSpec {
  return (spec as any)?.kind === 'data';
}

function includesIgnoreCase(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export default function MarcDictionaryPage({ params }: { params: { orgId: string } }) {
  const all = useMemo(() => listMarc21FieldSpecs(), []);

  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>(all[0]?.tag ?? '245');

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return all;

    return all.filter((spec) => {
      if (includesIgnoreCase(spec.tag, q)) return true;
      if (includesIgnoreCase(spec.label, q)) return true;

      if (isDataSpec(spec)) {
        // indicators
        if (includesIgnoreCase(spec.indicators[0].label, q)) return true;
        if (includesIgnoreCase(spec.indicators[1].label, q)) return true;
        if (spec.indicators[0].options.some((o) => includesIgnoreCase(`${o.code} ${o.label}`, q))) return true;
        if (spec.indicators[1].options.some((o) => includesIgnoreCase(`${o.code} ${o.label}`, q))) return true;

        // subfields
        if (spec.subfields.some((sf) => includesIgnoreCase(`$${sf.code} ${sf.label}`, q))) return true;
      }

      return false;
    });
  }, [all, query]);

  const selected = useMemo(() => all.find((s) => s.tag === selectedTag) ?? null, [all, selectedTag]);

  // 若搜尋過濾後 selectedTag 不在清單：自動選第一筆（避免右側空白）
  useEffect(() => {
    if (!selectedTag) return;
    if (filtered.some((s) => s.tag === selectedTag)) return;
    if (filtered.length > 0) setSelectedTag(filtered[0]!.tag);
  }, [filtered, selectedTag]);

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>MARC 欄位字典（常用 BIB）</h1>
        <p className="muted">
          這頁提供「我們系統已內建」的 MARC 欄位字典：包含指標/子欄位/最小驗證規則，並用於 MARC 編輯器的下拉選單與驗證。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}/bibs/marc-editor`}>前往 MARC21 編輯器</Link>
          <Link href={`/orgs/${params.orgId}/bibs`}>回 Bibs</Link>
        </div>
      </section>

      <section className="panel">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* LEFT：搜尋 + 清單 */}
          <div>
            <h2 style={{ marginTop: 0 }}>搜尋</h2>
            <label>
              query（tag/label/indicator/subfield）
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：650 / subject / $0 / language" />
            </label>

            <div className="muted" style={{ marginTop: 10 }}>
              共 {filtered.length} / {all.length} 欄位
            </div>

            <div style={{ marginTop: 10, maxHeight: 560, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {filtered.map((spec) => (
                  <li key={spec.tag} style={{ borderBottom: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedTag(spec.tag)}
                      className={selectedTag === spec.tag ? 'callout' : undefined}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 10,
                        border: 0,
                        background: 'transparent',
                        color: 'var(--text)',
                        borderRadius: 0,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{spec.tag}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {spec.label}
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        kind：<code>{spec.kind}</code> · repeatable：<code>{spec.repeatable ? 'true' : 'false'}</code>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT：詳情 */}
          <div>
            <h2 style={{ marginTop: 0 }}>詳情</h2>
            {!selected ? <div className="muted">請先從左側選一個欄位。</div> : null}

            {selected ? (
              <div className="stack">
                <div className="callout">
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {selected.tag}{' '}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      — {selected.label}
                    </span>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    kind：<code>{selected.kind}</code> · repeatable：<code>{selected.repeatable ? 'true' : 'false'}</code>
                  </div>
                </div>

                {selected.kind === 'control' ? (
                  <div className="callout">
                    <div style={{ fontWeight: 700 }}>Control field rules</div>
                    <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                      {'exact_length' in selected.value && selected.value.exact_length !== undefined ? (
                        <li>
                          exact_length：<code>{selected.value.exact_length}</code>
                        </li>
                      ) : null}
                      {'min_length' in selected.value && selected.value.min_length !== undefined ? (
                        <li>
                          min_length：<code>{selected.value.min_length}</code>
                        </li>
                      ) : null}
                      {'max_length' in selected.value && selected.value.max_length !== undefined ? (
                        <li>
                          max_length：<code>{selected.value.max_length}</code>
                        </li>
                      ) : null}
                      {'pattern' in selected.value && selected.value.pattern ? (
                        <li>
                          pattern：<code>{String(selected.value.pattern)}</code>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : (
                  <div className="stack">
                    <div className="callout">
                      <div style={{ fontWeight: 700 }}>Indicators</div>
                      <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{selected.indicators[0].label}</div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            allow_other：<code>{selected.indicators[0].allow_other ? 'true' : 'false'}</code> · default：
                            <code>{selected.indicators[0].default ?? '(none)'}</code>
                          </div>
                          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                            {selected.indicators[0].options.map((o) => (
                              <li key={`${o.code}-${o.label}`}>
                                <code>{o.code || '␠'}</code> — {o.label}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <div style={{ fontWeight: 700 }}>{selected.indicators[1].label}</div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            allow_other：<code>{selected.indicators[1].allow_other ? 'true' : 'false'}</code> · default：
                            <code>{selected.indicators[1].default ?? '(none)'}</code>
                          </div>
                          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                            {selected.indicators[1].options.map((o) => (
                              <li key={`${o.code}-${o.label}`}>
                                <code>{o.code || '␠'}</code> — {o.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="callout">
                      <div style={{ fontWeight: 700 }}>Subfields</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        subfields_allow_other：<code>{selected.subfields_allow_other ? 'true' : 'false'}</code>
                      </div>

                      <div style={{ marginTop: 10, overflow: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>code</th>
                              <th>label</th>
                              <th>required</th>
                              <th>repeatable</th>
                              <th>value_kind</th>
                              <th>managed_by_form</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.subfields.map((sf) => (
                              <tr key={sf.code}>
                                <td>
                                  <code>${sf.code}</code>
                                </td>
                                <td>{sf.label}</td>
                                <td>
                                  <code>{sf.required ? 'true' : 'false'}</code>
                                </td>
                                <td>
                                  <code>{sf.repeatable === false ? 'false' : 'true'}</code>
                                </td>
                                <td>
                                  <code>{sf.value_kind ?? '(text)'}</code>
                                </td>
                                <td>
                                  <code>{sf.managed_by_form ? 'true' : 'false'}</code>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
