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
 * - v1.5 起：字典 SSOT 在 `packages/shared/src/marc21-bib-field-dictionary.ts`，Web 這裡只是 re-export（避免 Web/API 漂移）
 * - 若要擴充：直接在 SSOT 的 `MARC21_BIB_FIELDS` 加 spec，這頁會自動出現
 */

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import { listMarc21FieldSpecs, type Marc21DataFieldSpec, type Marc21FieldSpec } from '../../../../lib/marc21';
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';

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
      <PageHeader
        title="MARC 欄位字典（常用 BIB）"
        description={
          <>
            這頁提供「本系統已內建」的欄位字典（tag/indicator/subfield + 最小驗證規則），並用於 MARC 編輯器的下拉選單與驗證。
            資料來源：<code>app/lib/marc21.ts</code>（re-export <code>@library-system/shared</code> 的 SSOT）。
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs`}>
              回 Bibs
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/marc-editor`}>
              MARC 編輯器
            </Link>
          </>
        }
      />

      <section className="panel">
        <SectionHeader title="瀏覽與搜尋" description="支援 tag/label/indicator/subfield（例如：650、subject、$0、language）。" />
        <div className="grid2" style={{ alignItems: 'start' }}>
          {/* LEFT：搜尋 + 清單 */}
          <div>
            <Form onSubmit={(e) => e.preventDefault()}>
              <FormSection title="搜尋" description="（提示）輸入越短越適合掃描；輸入越長越適合精準定位。">
                <Field label="query" htmlFor="marc_dict_query">
                  <input
                    id="marc_dict_query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="例：650 / subject / $0 / language"
                  />
                </Field>

                <div className="muted">
                  共 <code>{filtered.length}</code> / <code>{all.length}</code> 欄位
                </div>
              </FormSection>
            </Form>

            <div style={{ marginTop: 12 }}>
              {filtered.length === 0 ? (
                <EmptyState title="沒有符合的欄位" description="請調整 query（可輸入 tag、label、indicator label、或子欄位代碼）。" />
              ) : (
                <DataTable
                  rows={filtered}
                  getRowKey={(r) => r.tag}
                  initialSort={{ columnId: 'tag', direction: 'asc' }}
                  columns={[
                    {
                      id: 'tag',
                      header: 'tag',
                      sortValue: (r) => r.tag,
                      cell: (r) => (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button type="button" className="btnLink" onClick={() => setSelectedTag(r.tag)}>
                            <code>{r.tag}</code>
                          </button>
                          {selectedTag === r.tag ? <span className="badge badge--info">selected</span> : null}
                        </div>
                      ),
                      width: 92,
                    },
                    { id: 'label', header: 'label', sortValue: (r) => r.label, cell: (r) => r.label },
                    {
                      id: 'kind',
                      header: 'kind',
                      sortValue: (r) => r.kind,
                      cell: (r) => <code>{r.kind}</code>,
                      width: 110,
                    },
                    {
                      id: 'repeatable',
                      header: 'repeatable',
                      sortValue: (r) => (r.repeatable ? 1 : 0),
                      cell: (r) => <code>{r.repeatable ? 'true' : 'false'}</code>,
                      width: 120,
                    },
                  ]}
                />
              )}
            </div>
          </div>

          {/* RIGHT：詳情 */}
          <div>
            <h2 style={{ marginTop: 0 }}>詳情</h2>
            {!selected ? <EmptyState title="尚未選擇欄位" description="請先從左側清單選一個欄位。" /> : null}

            {selected ? (
              <div className="stack">
                <Alert variant="info" title={`${selected.tag} — ${selected.label}`} role="status">
                  <span className="muted">
                    kind：<code>{selected.kind}</code> · repeatable：<code>{selected.repeatable ? 'true' : 'false'}</code>
                  </span>
                </Alert>

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

                      <div style={{ marginTop: 10 }}>
                        <DataTable
                          rows={selected.subfields}
                          getRowKey={(r) => r.code}
                          initialSort={{ columnId: 'code', direction: 'asc' }}
                          columns={[
                            {
                              id: 'code',
                              header: 'code',
                              sortValue: (r) => r.code,
                              cell: (r) => <code>${r.code}</code>,
                              width: 86,
                            },
                            { id: 'label', header: 'label', sortValue: (r) => r.label, cell: (r) => r.label },
                            {
                              id: 'required',
                              header: 'required',
                              sortValue: (r) => (r.required ? 1 : 0),
                              cell: (r) => <code>{r.required ? 'true' : 'false'}</code>,
                              width: 110,
                            },
                            {
                              id: 'repeatable',
                              header: 'repeatable',
                              sortValue: (r) => (r.repeatable === false ? 0 : 1),
                              cell: (r) => <code>{r.repeatable === false ? 'false' : 'true'}</code>,
                              width: 120,
                            },
                            {
                              id: 'value_kind',
                              header: 'value_kind',
                              sortValue: (r) => r.value_kind ?? '(text)',
                              cell: (r) => <code>{r.value_kind ?? '(text)'}</code>,
                              width: 140,
                            },
                            {
                              id: 'managed_by_form',
                              header: 'managed_by_form',
                              sortValue: (r) => (r.managed_by_form ? 1 : 0),
                              cell: (r) => <code>{r.managed_by_form ? 'true' : 'false'}</code>,
                              width: 160,
                            },
                          ]}
                        />
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
