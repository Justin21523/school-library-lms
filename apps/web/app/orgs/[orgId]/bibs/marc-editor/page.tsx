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
import {
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
    const items = page?.items ?? [];
    return items.find((b) => b.id === selectedBibId) ?? null;
  }, [page?.items, selectedBibId]);

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
  }, [selectedBibId]);

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
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>MARC21 編輯器</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>MARC21 編輯器</h1>
          <p className="muted">
            這頁需要 staff 登入。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>MARC21 編輯器</h1>
        <p className="muted">
          這頁是「MARC 交換格式」的操作入口：你可以編輯 <code>marc_extras</code>（表單未覆蓋欄位），並下載{' '}
          <code>.mrc</code>/<code>.xml</code>/<code>.json</code>。
        </p>
        <p className="muted">
          提醒：<code>001</code>/<code>005</code> 由系統產生，不可存入 <code>marc_extras</code>；表單欄位（title/subjects/term_ids...）仍是治理真相來源。
        </p>

        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}/bibs`}>回 Bibs</Link>
          <Link href={`/orgs/${params.orgId}/authority-terms`}>Authority Terms</Link>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>選擇書目</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            query（選填；依 title/作者/主題等搜尋）
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：哈利波特 / 魔法 / 978..." />
          </label>
          <label>
            limit（一次載入筆數；建議 50~200）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <button type="button" onClick={() => void refreshBibs()} disabled={loading}>
            {loading ? '載入中…' : '搜尋/重新整理'}
          </button>
          {page?.next_cursor ? (
            <button type="button" onClick={() => void loadMoreBibs()} disabled={loadingMore || loading}>
              {loadingMore ? '載入中…' : '載入更多'}
            </button>
          ) : null}
          <span className="muted">
            {page ? `items=${page.items.length} · next_cursor=${page.next_cursor ? '有' : '無'}` : '尚未載入'}
          </span>
        </div>

        <label style={{ marginTop: 12 }}>
          選擇 bib
          <select value={selectedBibId} onChange={(e) => setSelectedBibId(e.target.value)} disabled={loading || loadingMore}>
            <option value="">（請選擇）</option>
            {(page?.items ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} · isbn={b.isbn ?? '—'} · id={b.id.slice(0, 8)}…
              </option>
            ))}
          </select>
        </label>

        {selectedBibId ? (
          <div className="muted" style={{ marginTop: 10, display: 'grid', gap: 4 }}>
            <div>
              selected_bib_id：<code>{selectedBibId}</code>
            </div>
            {selectedBib ? (
              <div>
                title：<span style={{ fontWeight: 700 }}>{selectedBib.title}</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href={`/orgs/${params.orgId}/bibs/${selectedBibId}`}>開啟書目詳情</Link>
              <Link href={`/orgs/${params.orgId}/bibs/${selectedBibId}#marc21`}>跳到該書目的 MARC 區塊</Link>
              <Link href={`/orgs/${params.orgId}/bibs/marc-dictionary`}>MARC 欄位字典</Link>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            先選一筆書目，才會顯示 MARC 編輯器。
          </p>
        )}
      </section>

      {selectedBibId ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>MARC 編輯/匯出</h2>
          <p className="muted">
            對應 API：<code>GET /bibs/:bibId/marc</code> 與 <code>GET/PUT /bibs/:bibId/marc-extras</code>
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" onClick={() => void onGenerateMarcJson()} disabled={loadingMarc}>
              {loadingMarc ? '產生中…' : '產生 MARC(JSON)'}
            </button>
            <button type="button" onClick={() => void onDownloadMarcJson()}>
              下載 JSON
            </button>
            <button type="button" onClick={() => void onDownloadMarcXml()}>
              下載 MARCXML
            </button>
            <button type="button" onClick={() => void onDownloadMarcMrc()}>
              下載 .mrc
            </button>
          </div>

          <label style={{ marginTop: 12 }}>
            MARC(JSON)（由表單欄位 + marc_extras 產生）
            <textarea value={marcJsonText} readOnly rows={10} placeholder="按「產生 MARC(JSON)」後會出現在這裡" />
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" onClick={() => void onLoadMarcExtras()} disabled={loadingMarcExtras}>
              {loadingMarcExtras ? '載入中…' : '載入 marc_extras'}
            </button>
            <button type="button" onClick={() => void onSaveMarcExtras()} disabled={savingMarcExtras}>
              {savingMarcExtras ? '儲存中…' : '儲存 marc_extras'}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ marginBottom: 8 }}>
              marc_extras（可編輯任意 tag/指標/子欄位；並提供 authority linking helper）
            </div>

            {marcExtras ? (
              <MarcFieldsEditor
                orgId={params.orgId}
                value={marcExtras}
                onChange={setMarcExtras}
                disabled={loadingMarcExtras || savingMarcExtras}
              />
            ) : (
              <div className="muted">尚未載入 marc_extras；按上方「載入 marc_extras」後可編輯。</div>
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
        </section>
      ) : null}
    </div>
  );
}
