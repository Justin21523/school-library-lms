/**
 * MARC21 編輯器（/orgs/:orgId/bibs/marc-editor）
 *
 * 你回報「找不到 MARC21 編輯器頁面」，因此這裡提供一個「單一入口」：
 * - 先用搜尋選到某筆書目（bib）
 * - 然後在同頁：
 *   - 載入/編輯/儲存 `marc_extras`
 *   - 產生/下載 MARC（JSON / MARCXML / ISO2709 .mrc）
 *
 * 設計原則（對齊你要求的治理方向）：
 * - 本系統的「可治理表單欄位」仍是真相來源（title/subjects/term_ids...）
 * - MARC21 是交換格式；`marc_extras` 用來保留「表單未覆蓋」的欄位/子欄位
 * - 匯出時由後端負責 merge（避免重複欄位且保留進階子欄位）
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/bibs?query=&limit=&cursor=
 * - GET  /api/v1/orgs/:orgId/bibs/:bibId/marc?format=json|xml|mrc
 * - GET  /api/v1/orgs/:orgId/bibs/:bibId/marc-extras
 * - PUT  /api/v1/orgs/:orgId/bibs/:bibId/marc-extras
 *
 * 權限：
 * - 需 staff 登入（StaffAuthGuard）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { BibliographicRecordWithCounts, MarcField } from '../../../../lib/api';
import { MarcFieldsEditor } from '../../../../components/marc/marc-fields-editor';
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { SkeletonTable, SkeletonText } from '../../../../components/ui/skeleton';
import {
  getBib,
  getBibMarc,
  getBibMarcExtras,
  getBibMarcMrc,
  getBibMarcXml,
  listBibs,
  updateBibMarcExtras,
} from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

function downloadText(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBytes(filename: string, bytes: ArrayBuffer, contentType: string) {
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MarcEditorPage({ params }: { params: { orgId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const searchParams = useSearchParams();

  // ----------------------------
  // 1) Bib 選擇器（先找到要編輯哪一筆書目）
  // ----------------------------

  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState('50');

  const limitValue = useMemo(() => {
    const n = Number.parseInt(limit.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) return 50;
    return Math.min(n, 200);
  }, [limit]);

  const [page, setPage] = useState<{ items: BibliographicRecordWithCounts[]; next_cursor: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedBibId, setSelectedBibId] = useState<string>('');
  const [selectedBibDetail, setSelectedBibDetail] = useState<BibliographicRecordWithCounts | null>(null);
  const [loadingSelectedBib, setLoadingSelectedBib] = useState(false);

  // ----------------------------
  // 2) MARC 編輯器狀態（針對 selectedBibId）
  // ----------------------------

  const [marcJsonText, setMarcJsonText] = useState('');
  const [marcExtras, setMarcExtras] = useState<MarcField[] | null>(null);
  const [loadingMarc, setLoadingMarc] = useState(false);
  const [loadingMarcExtras, setLoadingMarcExtras] = useState(false);
  const [savingMarcExtras, setSavingMarcExtras] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedBib = useMemo(() => {
    if (selectedBibDetail) return selectedBibDetail;
    const items = page?.items ?? [];
    return items.find((b) => b.id === selectedBibId) ?? null;
  }, [page?.items, selectedBibDetail, selectedBibId]);

  async function refreshBibs() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await listBibs(params.orgId, { limit: limitValue, ...(query.trim() ? { query: query.trim() } : {}) });
      setPage(result);

      // UX：若尚未選 bib，預設選第一筆（方便你一進來就能開始操作）
      if (!selectedBibId && result.items.length > 0) setSelectedBibId(result.items[0]!.id);
    } catch (e) {
      setPage(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreBibs() {
    if (!page?.next_cursor) return;

    setLoadingMore(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await listBibs(params.orgId, {
        limit: limitValue,
        cursor: page.next_cursor,
        ...(query.trim() ? { query: query.trim() } : {}),
      });
      setPage({ items: [...page.items, ...next.items], next_cursor: next.next_cursor });
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  // 初次載入：列出最近的書目（或 query 變更後手動按刷新）
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refreshBibs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, session]);

  // 若 URL 帶了 bib_id，就用它作為初始選擇（讓你可以從其他頁面一鍵跳過來）
  useEffect(() => {
    const fromUrl = (searchParams.get('bib_id') ?? '').trim();
    if (fromUrl) setSelectedBibId(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 切換 bib 時，清掉上一筆的 MARC 資料（避免誤會「編輯的是哪一筆」）
  useEffect(() => {
    setMarcJsonText('');
    setMarcExtras(null);
    setSelectedBibDetail(null);
  }, [selectedBibId]);

  // 讓「從別頁帶 bib_id」也能顯示 title 等摘要（避免 bib 不在第一頁時右側資訊空白）
  useEffect(() => {
    if (!sessionReady || !session) return;
    if (!selectedBibId) return;

    async function run() {
      setLoadingSelectedBib(true);
      try {
        const bib = await getBib(params.orgId, selectedBibId);
        setSelectedBibDetail(bib);
      } catch (e) {
        setSelectedBibDetail(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoadingSelectedBib(false);
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, selectedBibId, sessionReady, session]);

  async function onGenerateMarcJson() {
    if (!selectedBibId) return;
    setLoadingMarc(true);
    setError(null);
    setSuccess(null);
    try {
      const record = await getBibMarc(params.orgId, selectedBibId);
      setMarcJsonText(JSON.stringify(record, null, 2));
      setSuccess('已產生 MARC(JSON)');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMarc(false);
    }
  }

  async function onDownloadMarcJson() {
    if (!selectedBibId) return;
    setError(null);
    setSuccess(null);

    try {
      let text = marcJsonText;
      if (!text.trim()) {
        const record = await getBibMarc(params.orgId, selectedBibId);
        text = JSON.stringify(record, null, 2);
        setMarcJsonText(text);
      }

      downloadText(`bib-${selectedBibId}.marc.json`, text, 'application/json;charset=utf-8');
      setSuccess('已下載 MARC(JSON)');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  }

  async function onDownloadMarcXml() {
    if (!selectedBibId) return;
    setError(null);
    setSuccess(null);
    try {
      const xml = await getBibMarcXml(params.orgId, selectedBibId);
      downloadText(`bib-${selectedBibId}.xml`, xml, 'application/marcxml+xml;charset=utf-8');
      setSuccess('已下載 MARCXML');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  }

  async function onDownloadMarcMrc() {
    if (!selectedBibId) return;
    setError(null);
    setSuccess(null);
    try {
      const bytes = await getBibMarcMrc(params.orgId, selectedBibId);
      downloadBytes(`bib-${selectedBibId}.mrc`, bytes, 'application/octet-stream');
      setSuccess('已下載 ISO2709 (.mrc)');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  }

  async function onLoadMarcExtras() {
    if (!selectedBibId) return;
    setLoadingMarcExtras(true);
    setError(null);
    setSuccess(null);
    try {
      const extras = await getBibMarcExtras(params.orgId, selectedBibId);
      setMarcExtras(extras);
      setSuccess(`已載入 marc_extras（fields=${extras.length}）`);
    } catch (e) {
      setMarcExtras(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMarcExtras(false);
    }
  }

  async function onSaveMarcExtras() {
    if (!selectedBibId) return;
    if (!marcExtras) {
      setError('尚未載入 marc_extras（請先按「載入 marc_extras」）');
      return;
    }

    setSavingMarcExtras(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateBibMarcExtras(params.orgId, selectedBibId, marcExtras);
      setMarcExtras(updated);
      setSuccess(`已儲存 marc_extras（fields=${updated.length}）`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSavingMarcExtras(false);
    }
  }

  // Login gate
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="MARC21 編輯器" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="MARC21 編輯器">
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="MARC21 編輯器"
        description={
          <>
            這頁是「MARC 交換格式」的操作入口：你可以編輯 <code>marc_extras</code>（表單未覆蓋欄位），並下載 <code>.mrc</code>/<code>.xml</code>/<code>.json</code>。
          </>
        }
      >
        <p className="muted">
          提醒：<code>001</code>/<code>005</code> 由系統產生，不可存入 <code>marc_extras</code>；表單欄位（title/subjects/term_ids...）仍是治理真相來源。
        </p>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert variant="success" title="已完成" role="status">
            {success}
          </Alert>
        ) : null}

        <div className="toolbar" style={{ marginTop: 12 }}>
          <div className="toolbarLeft">
            <Link href={`/orgs/${params.orgId}/bibs`}>回 Bibs</Link>
            <Link href={`/orgs/${params.orgId}/bibs/marc-dictionary`}>MARC 欄位字典</Link>
          </div>
          <div className="toolbarRight">
            <Link href={`/orgs/${params.orgId}/authority`}>Authority Control</Link>
          </div>
        </div>
      </PageHeader>

      <section className="panel">
        <SectionHeader title="選擇書目" />
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void refreshBibs();
          }}
        >
          <FormSection title="搜尋" description="先用書目查詢找到要編輯的那筆 bib，選定後才能操作 MARC 匯出與 marc_extras。">
            <div className="grid2">
              <Field label="query（選填；依 title/作者/主題等搜尋）" htmlFor="marc_bib_query">
                <input
                  id="marc_bib_query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例：哈利波特 / 魔法 / 978..."
                />
              </Field>
              <Field label="limit（一次載入筆數；建議 50~200）" htmlFor="marc_bib_limit">
                <input id="marc_bib_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '載入中…' : '搜尋/重新整理'}
              </button>
              {page?.next_cursor ? (
                <button type="button" className="btnSmall" onClick={() => void loadMoreBibs()} disabled={loadingMore || loading}>
                  {loadingMore ? '載入中…' : '載入更多'}
                </button>
              ) : null}
              <span className="muted">
                {page ? `items=${page.items.length} · next_cursor=${page.next_cursor ? '有' : '無'}` : '尚未載入'}
              </span>
            </FormActions>
          </FormSection>
        </Form>

        {loading && !page ? <SkeletonTable columns={4} rows={6} /> : null}

        {!loading && !page ? (
          <EmptyState
            title="尚未載入書目"
            description="按上方「搜尋/重新整理」開始載入。"
            actions={
              <button type="button" className="btnPrimary" onClick={() => void refreshBibs()}>
                載入
              </button>
            }
          />
        ) : null}

        {!loading && page && page.items.length === 0 ? (
          <EmptyState title="沒有符合條件的書目" description="你可以調整 query/limit 後再試一次。" />
        ) : null}

        {page && page.items.length > 0 ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <DataTable
              rows={page.items}
              getRowKey={(b) => b.id}
              density="compact"
              onRowClick={(b) => setSelectedBibId(b.id)}
              sortHint="排序僅影響目前已載入資料（cursor pagination）。"
              initialSort={{ columnId: 'title', direction: 'asc' }}
              columns={[
                {
                  id: 'title',
                  header: 'title',
                  sortValue: (b) => b.title,
                  cell: (b) => (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 900 }}>{b.title}</span>
                      {b.id === selectedBibId ? <span className="statusPill statusPill--ok">已選</span> : null}
                    </div>
                  ),
                },
                {
                  id: 'isbn',
                  header: 'isbn',
                  width: 190,
                  sortValue: (b) => b.isbn ?? '',
                  cell: (b) => <span className="muted">{b.isbn ?? '—'}</span>,
                },
                {
                  id: 'items',
                  header: 'available/total',
                  width: 140,
                  align: 'right',
                  sortValue: (b) => b.total_items,
                  cell: (b) => (
                    <span className="muted">
                      <code>{b.available_items}</code>/<code>{b.total_items}</code>
                    </span>
                  ),
                },
                {
                  id: 'id',
                  header: 'id',
                  width: 220,
                  sortValue: (b) => b.id,
                  cell: (b) => <code>{b.id.slice(0, 8)}…</code>,
                },
              ]}
              rowActions={(b) => (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <Link href={`/orgs/${params.orgId}/bibs/${b.id}`} data-no-row-click="true">
                    開啟
                  </Link>
                </div>
              )}
              rowActionsHeader="open"
              rowActionsWidth={90}
            />
          </div>
        ) : null}
      </section>

      <section className="panel">
        <SectionHeader title="MARC 編輯/匯出" />

        {!selectedBibId ? (
          <EmptyState title="尚未選擇書目" description="請先在上方清單點選一筆書目，再進行 MARC 匯出與 marc_extras 編輯。" />
        ) : (
          <>
            <p className="muted">
              對應 API：<code>GET /bibs/:bibId/marc</code> 與 <code>GET/PUT /bibs/:bibId/marc-extras</code>
            </p>

            <Alert
              variant="info"
              title={
                loadingSelectedBib ? (
                  '載入書目中…'
                ) : selectedBib ? (
                  <>
                    已選擇：{selectedBib.title} <span className="muted">（{selectedBibId}）</span>
                  </>
                ) : (
                  <>
                    已選擇：<code>{selectedBibId}</code>
                  </>
                )
              }
              role="status"
            >
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                <Link href={`/orgs/${params.orgId}/bibs/${selectedBibId}`}>開啟書目詳情</Link>
                <Link href={`/orgs/${params.orgId}/bibs/${selectedBibId}#marc21`}>跳到該書目的 MARC 區塊</Link>
              </div>
            </Alert>

            <div className="toolbar" style={{ marginTop: 12 }}>
              <div className="toolbarLeft">
                <button type="button" className="btnPrimary" onClick={() => void onGenerateMarcJson()} disabled={loadingMarc}>
                  {loadingMarc ? '產生中…' : '產生 MARC(JSON)'}
                </button>
                <button type="button" className="btnSmall" onClick={() => void onDownloadMarcJson()}>
                  下載 JSON
                </button>
                <button type="button" className="btnSmall" onClick={() => void onDownloadMarcXml()}>
                  下載 MARCXML
                </button>
                <button type="button" className="btnSmall" onClick={() => void onDownloadMarcMrc()}>
                  下載 .mrc
                </button>
              </div>
              <div className="toolbarRight">
                {/* 避免同一頁面同時出現兩個「載入 marc_extras」按鈕造成混淆/測試 strict mode：
                 * - 尚未載入時：下方 EmptyState 已有主要 CTA（btnPrimary）
                 * - 已載入後：才顯示這個 btnSmall（用於重新載入 / 對照） */}
                {marcExtras ? (
                  <button type="button" className="btnSmall" onClick={() => void onLoadMarcExtras()} disabled={loadingMarcExtras}>
                    {loadingMarcExtras ? '載入中…' : '重新載入 marc_extras'}
                  </button>
                ) : null}
                <button type="button" className="btnPrimary" onClick={() => void onSaveMarcExtras()} disabled={savingMarcExtras}>
                  {savingMarcExtras ? '儲存中…' : '儲存 marc_extras'}
                </button>
              </div>
            </div>

            <label style={{ marginTop: 12 }}>
              MARC(JSON)（由表單欄位 + marc_extras 產生）
              <textarea value={marcJsonText} readOnly rows={10} placeholder="按「產生 MARC(JSON)」後會出現在這裡" />
            </label>

            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ marginBottom: 8 }}>
                marc_extras（可編輯任意 tag/指標/子欄位；並提供 authority linking helper）
              </div>

              {loadingMarcExtras && !marcExtras ? <SkeletonText lines={4} /> : null}

              {marcExtras ? (
                <MarcFieldsEditor
                  orgId={params.orgId}
                  value={marcExtras}
                  onChange={setMarcExtras}
                  disabled={loadingMarcExtras || savingMarcExtras}
                />
              ) : (
                <EmptyState
                  title="尚未載入 marc_extras"
                  description="按「載入 marc_extras」後即可視覺化編輯欄位/指標/子欄位。"
                  actions={
                    <button type="button" className="btnPrimary" onClick={() => void onLoadMarcExtras()} disabled={loadingMarcExtras}>
                      {loadingMarcExtras ? '載入中…' : '載入 marc_extras'}
                    </button>
                  }
                />
              )}

              <details style={{ marginTop: 12 }}>
                <summary className="muted">檢視 marc_extras JSON</summary>
                <textarea
                  value={JSON.stringify(marcExtras ?? [], null, 2)}
                  readOnly
                  rows={10}
                  placeholder="[]"
                  style={{ marginTop: 8 }}
                />
              </details>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
