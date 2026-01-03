/**
 * Thesaurus Browser（/orgs/:orgId/authority-terms/thesaurus）
 *
 * 你希望支援「幾萬 terms + polyhierarchy（多個 BT）」時，UI 的核心原則是：
 * - 不一次把整棵樹拉回來（會爆）
 * - 改用 roots 作入口 + children lazy-load（展開到哪載到哪）
 * - 每個節點顯示：
 *   - broader_count（BT 數量；>1 代表多重上位）
 *   - narrower_count / has_children（是否還能展開）
 *
 * 對應 API（Staff）：
 * - GET  /api/v1/orgs/:orgId/authority-terms/thesaurus/roots
 * - GET  /api/v1/orgs/:orgId/authority-terms/:termId/thesaurus/children
 * - GET  /api/v1/orgs/:orgId/authority-terms/thesaurus/relations/export
 * - POST /api/v1/orgs/:orgId/authority-terms/thesaurus/relations/import
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { ThesaurusChildrenPage, ThesaurusNodeSummary, ThesaurusRelationsImportResult, ThesaurusRootsPage } from '../../../../lib/api';
import { exportThesaurusRelationsCsv, importThesaurusRelations, listThesaurusChildren, listThesaurusRoots } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';
import { Alert } from '../../../../components/ui/alert';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { SkeletonText } from '../../../../components/ui/skeleton';

function downloadText(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ChildrenState = {
  page: ThesaurusChildrenPage | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

export default function ThesaurusBrowserPage({ params }: { params: { orgId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const searchParams = useSearchParams();

  // ----------------------------
  // 1) roots filters（入口）
  // ----------------------------

  // kind：thesaurus（BT/NT）目前只支援 subject/geographic/genre（對應 650/651/655）
  const [kind, setKind] = useState<'subject' | 'geographic' | 'genre'>(() => {
    const v = (searchParams.get('kind') ?? '').trim();
    if (v === 'subject' || v === 'geographic' || v === 'genre') return v;
    return 'subject';
  });
  const [vocabularyCode, setVocabularyCode] = useState(() => (searchParams.get('vocabulary_code') ?? '').trim() || 'builtin-zh');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>(() => {
    const v = (searchParams.get('status') ?? '').trim();
    if (v === 'active' || v === 'inactive' || v === 'all') return v;
    return 'active';
  });
  const [query, setQuery] = useState(() => (searchParams.get('query') ?? '').trim());
  const [limit, setLimit] = useState(() => (searchParams.get('limit') ?? '').trim() || '200');

  const limitValue = useMemo(() => {
    const n = Number.parseInt(limit.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) return 200;
    return Math.min(n, 500);
  }, [limit]);

  // ----------------------------
  // 2) roots data + state
  // ----------------------------

  const [roots, setRoots] = useState<ThesaurusRootsPage | null>(null);
  const [loadingRoots, setLoadingRoots] = useState(false);
  const [loadingMoreRoots, setLoadingMoreRoots] = useState(false);

  // tree state（lazy-load）
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [childrenById, setChildrenById] = useState<Record<string, ChildrenState>>({});

  // import/export
  const [exporting, setExporting] = useState(false);

  const [importCsvText, setImportCsvText] = useState('');
  const [importFilename, setImportFilename] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'preview' | 'apply'>('preview');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ThesaurusRelationsImportResult | null>(null);

  // shared messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refreshRoots() {
    const vocab = vocabularyCode.trim();
    if (!vocab) {
      setError('vocabulary_code 不可為空（例如 builtin-zh / local）');
      return;
    }

    setLoadingRoots(true);
    setError(null);
    setSuccess(null);
    try {
      const page = await listThesaurusRoots(params.orgId, {
        kind,
        vocabulary_code: vocab,
        status,
        ...(query.trim() ? { query: query.trim() } : {}),
        limit: limitValue,
      });
      setRoots(page);
    } catch (e) {
      setRoots(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingRoots(false);
    }
  }

  async function loadMoreRoots() {
    if (!roots?.next_cursor) return;
    const vocab = vocabularyCode.trim();
    if (!vocab) return;

    setLoadingMoreRoots(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await listThesaurusRoots(params.orgId, {
        kind,
        vocabulary_code: vocab,
        status,
        ...(query.trim() ? { query: query.trim() } : {}),
        limit: limitValue,
        cursor: roots.next_cursor,
      });
      setRoots({ items: [...roots.items, ...next.items], next_cursor: next.next_cursor });
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMoreRoots(false);
    }
  }

  async function ensureChildrenLoaded(termId: string) {
    const current = childrenById[termId] ?? null;
    if (current?.page) return;

    setChildrenById((prev) => ({
      ...prev,
      [termId]: { page: null, loading: true, loadingMore: false, error: null },
    }));

    try {
      const page = await listThesaurusChildren(params.orgId, termId, { status, limit: 200 });
      setChildrenById((prev) => ({
        ...prev,
        [termId]: { page, loading: false, loadingMore: false, error: null },
      }));
    } catch (e) {
      setChildrenById((prev) => ({
        ...prev,
        [termId]: { page: null, loading: false, loadingMore: false, error: formatErrorMessage(e) },
      }));
    }
  }

  async function loadMoreChildren(termId: string) {
    const current = childrenById[termId] ?? null;
    if (!current?.page?.next_cursor) return;

    setChildrenById((prev) => ({
      ...prev,
      [termId]: { ...(prev[termId] ?? { page: null, loading: false, loadingMore: false, error: null }), loadingMore: true },
    }));

    try {
      const next = await listThesaurusChildren(params.orgId, termId, { status, limit: 200, cursor: current.page.next_cursor });
      setChildrenById((prev) => ({
        ...prev,
        [termId]: {
          page: { items: [...(current.page?.items ?? []), ...next.items], next_cursor: next.next_cursor },
          loading: false,
          loadingMore: false,
          error: null,
        },
      }));
    } catch (e) {
      setChildrenById((prev) => ({
        ...prev,
        [termId]: { ...(prev[termId] ?? { page: null, loading: false, loadingMore: false, error: null }), loadingMore: false, error: formatErrorMessage(e) },
      }));
    }
  }

  function toggleExpand(termId: string, hasChildren: boolean) {
    if (!hasChildren) return;
    setExpanded((prev) => {
      const next = !prev[termId];
      // 只有「準備展開」時才去載 children（collapse 不需要）
      if (next) void ensureChildrenLoaded(termId);
      return { ...prev, [termId]: next };
    });
  }

  function renderNode(term: ThesaurusNodeSummary, level: number) {
    return (
      <TreeNode
        orgId={params.orgId}
        term={term}
        level={level}
        expanded={!!expanded[term.id]}
        childrenState={childrenById[term.id] ?? null}
        onToggle={() => toggleExpand(term.id, term.has_children)}
        onLoadMore={() => void loadMoreChildren(term.id)}
        renderNode={renderNode}
      />
    );
  }

  useEffect(() => {
    if (!sessionReady || !session) return;
    void refreshRoots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, session, kind, vocabularyCode, status, query, limitValue]);

  // URL deep link：允許從「Authority Control 主頁」或其他頁面帶 kind/vocabulary_code 初始化
  // - 例如：/thesaurus?kind=genre&vocabulary_code=builtin-zh
  const lastInitializedQueryStringRef = useRef<string | null>(null);
  useEffect(() => {
    const queryString = searchParams.toString();
    if (lastInitializedQueryStringRef.current === queryString) return;
    lastInitializedQueryStringRef.current = queryString;

    const urlKind = (searchParams.get('kind') ?? '').trim();
    if (urlKind === 'subject' || urlKind === 'geographic' || urlKind === 'genre') setKind(urlKind);

    const urlVocab = (searchParams.get('vocabulary_code') ?? '').trim();
    if (urlVocab) setVocabularyCode(urlVocab);

    const urlStatus = (searchParams.get('status') ?? '').trim();
    if (urlStatus === 'active' || urlStatus === 'inactive' || urlStatus === 'all') setStatus(urlStatus);

    const urlQuery = (searchParams.get('query') ?? '').trim();
    if (urlQuery) setQuery(urlQuery);

    const urlLimit = (searchParams.get('limit') ?? '').trim();
    if (urlLimit) setLimit(urlLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onExportRelations() {
    const vocab = vocabularyCode.trim();
    if (!vocab) {
      setError('vocabulary_code 不可為空');
      return;
    }

    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const { text, contentType } = await exportThesaurusRelationsCsv(params.orgId, { kind, vocabulary_code: vocab });
      downloadText(`thesaurus-relations-${kind}-${vocab}.csv`, text, contentType ?? 'text/csv;charset=utf-8');
      setSuccess('已匯出 relations CSV');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  async function onPickImportFile(file: File | null) {
    setError(null);
    setSuccess(null);
    setImportResult(null);
    if (!file) return;

    setImportFilename(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setImportCsvText(text);
    };
    reader.onerror = () => setError('讀取 CSV 檔案失敗，請重新選擇');
    reader.readAsText(file);
  }

  async function runImport(mode: 'preview' | 'apply') {
    const vocab = vocabularyCode.trim();
    if (!vocab) {
      setError('vocabulary_code 不可為空');
      return;
    }
    if (!importCsvText.trim()) {
      setError('請先選擇 CSV 檔案或貼上 csv_text');
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);
    setImportMode(mode);
    try {
      const result = await importThesaurusRelations(params.orgId, {
        kind,
        vocabulary_code: vocab,
        mode,
        csv_text: importCsvText,
      });
      setImportResult(result);
      setSuccess(mode === 'preview' ? '已完成 preview' : '已套用匯入（apply）');
    } catch (e) {
      setImportResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setImporting(false);
    }
  }

  // Login gate
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Thesaurus Browser" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="Thesaurus Browser" description="這頁需要 staff 登入才能操作 thesaurus。">
          <Alert variant="danger" title="需要登入">
            請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="Thesaurus Browser（polyhierarchy）"
        description={
          <>
            roots → children lazy-load；支援幾萬 terms 時不會一次拉爆。建議先選定 <code>vocabulary_code</code> 再瀏覽。
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority`}>
              Authority 主控
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority-terms`}>
              Terms
            </Link>
            <Link
              className="btnSmall"
              href={`/orgs/${params.orgId}/authority-terms/thesaurus/quality?kind=${encodeURIComponent(
                kind,
              )}&vocabulary_code=${encodeURIComponent(vocabularyCode.trim() || 'builtin-zh')}`}
            >
              Quality
            </Link>
            <Link
              className="btnSmall"
              href={`/orgs/${params.orgId}/authority-terms/thesaurus/visual?kind=${encodeURIComponent(
                kind,
              )}&vocabulary_code=${encodeURIComponent(vocabularyCode.trim() || 'builtin-zh')}`}
            >
              Visual
            </Link>
          </>
        }
      >
        <div className="muted" style={{ display: 'grid', gap: 4 }}>
          <div>
            orgId：<code>{params.orgId}</code>
          </div>
          <div>
            kind：<code>{kind}</code> · vocabulary_code：<code>{vocabularyCode.trim() || '—'}</code> · status：
            <code>{status}</code>
          </div>
        </div>

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
      </PageHeader>

      <section className="panel">
        <SectionHeader
          title="Filters"
          description="roots 的入口條件：kind/vocabulary/status/query/limit（更新後會自動刷新 roots）。"
          actions={
            <>
              <button type="button" className="btnSmall" onClick={() => void refreshRoots()} disabled={loadingRoots}>
                {loadingRoots ? '載入中…' : '重新整理'}
              </button>
              <button type="button" className="btnSmall" onClick={() => void onExportRelations()} disabled={exporting}>
                {exporting ? '匯出中…' : '匯出 relations CSV'}
              </button>
            </>
          }
        />

        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="Roots filters" description="query 只會過濾 roots（children 仍依節點展開才載入）。">
            <div className="grid3">
              <Field label="kind" htmlFor="thesaurus_kind">
                <select id="thesaurus_kind" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                  <option value="subject">subject（650）</option>
                  <option value="geographic">geographic（651）</option>
                  <option value="genre">genre（655）</option>
                </select>
              </Field>

              <Field label="vocabulary_code（必填）" htmlFor="thesaurus_vocab" hint="例如 builtin-zh / local">
                <input id="thesaurus_vocab" value={vocabularyCode} onChange={(e) => setVocabularyCode(e.target.value)} />
              </Field>

              <Field label="status" htmlFor="thesaurus_status">
                <select id="thesaurus_status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="active">active（只看啟用）</option>
                  <option value="inactive">inactive（只看停用）</option>
                  <option value="all">all（全部）</option>
                </select>
              </Field>
            </div>

            <div className="grid2">
              <Field label="query（只過濾 roots；模糊搜尋 label + variants）" htmlFor="thesaurus_query">
                <input
                  id="thesaurus_query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例如：盤點 / 汰舊 / 魔法"
                />
              </Field>

              <Field label="limit（1..500）" htmlFor="thesaurus_limit">
                <input id="thesaurus_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            </div>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="Roots（Top terms）" description="展開節點時才 lazy-load children；可支援大量詞彙與 polyhierarchy。" />
        {loadingRoots ? <SkeletonText lines={4} /> : null}
        {!loadingRoots && roots && roots.items.length === 0 ? <EmptyState title="沒有 roots" description="請調整 filters，或先建立/啟用詞彙。" /> : null}

        {roots && roots.items.length > 0 ? (
          <div className="stack">
            <ul>
              {roots.items.map((t) => (
                <li key={t.id} style={{ marginBottom: 8 }}>
                  {renderNode(t, 0)}
                </li>
              ))}
            </ul>

            {roots.next_cursor ? (
              <button type="button" className="btnSmall" onClick={() => void loadMoreRoots()} disabled={loadingMoreRoots || loadingRoots}>
                {loadingMoreRoots ? '載入中…' : '載入更多 roots'}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <SectionHeader
          title="Relations CSV Import"
          description="建議先匯出取得模板，再修改後回匯；匯入會做 unique 去重與 cycle 檢查（broader）。"
        />

        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="匯入" description="Preview 不寫入；Apply 會建立/更新 thesaurus relations。">
            <Field
              label="選擇 CSV 檔案（可選）"
              htmlFor="thesaurus_import_file"
              hint={importFilename ? <>已選：{importFilename}</> : '可不選，直接貼上 csv_text'}
            >
              <input
                id="thesaurus_import_file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onPickImportFile(e.target.files?.[0] ?? null)}
              />
            </Field>

            <Field label="csv_text（可直接貼上；20MB 上限）" htmlFor="thesaurus_import_csv_text">
              <textarea
                id="thesaurus_import_csv_text"
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                rows={8}
              />
            </Field>

            <FormActions>
              <button type="button" className="btnSmall" onClick={() => void runImport('preview')} disabled={importing}>
                {importing && importMode === 'preview' ? 'Preview 中…' : 'Preview'}
              </button>
              <button type="button" className="btnDanger" onClick={() => void runImport('apply')} disabled={importing}>
                {importing && importMode === 'apply' ? 'Apply 中…' : 'Apply'}
              </button>
            </FormActions>

            {importing ? <SkeletonText lines={3} /> : null}

            {importResult ? (
              <details open>
                <summary>Import result</summary>
                <div className="muted" style={{ marginTop: 8 }}>
                  summary：total={importResult.summary.total_rows} · create={importResult.summary.create_count} · skip_existing=
                  {importResult.summary.skip_existing_count} · errors={importResult.summary.error_count}
                </div>

                {'rows' in importResult ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 800 }}>Errors / Skips（前 50 筆）</div>
                    <ul style={{ marginTop: 8 }}>
                      {importResult.rows
                        .filter((r) => r.status !== 'create')
                        .slice(0, 50)
                        .map((r) => (
                          <li key={r.row_number} style={{ marginBottom: 6 }}>
                            <span>
                              row {r.row_number}：{r.status}
                              {r.error ? (
                                <>
                                  {' '}
                                  · {r.error.code}：{r.error.message}
                                </>
                              ) : null}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </details>
            ) : null}
          </FormSection>
        </Form>
      </section>
    </div>
  );
}

function TreeNode(props: {
  orgId: string;
  term: ThesaurusNodeSummary;
  level: number;
  expanded: boolean;
  childrenState: ChildrenState | null;
  onToggle: () => void;
  onLoadMore: () => void;
  renderNode: (term: ThesaurusNodeSummary, level: number) => React.ReactNode;
}) {
  const { orgId, term, level, expanded, childrenState, onToggle, onLoadMore, renderNode } = props;

  const indent = level * 18;
  const hasChildren = term.has_children;
  const childrenPage = childrenState?.page ?? null;
  const childrenItems = childrenPage?.items ?? [];

  return (
    <div style={{ marginLeft: indent }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={onToggle} disabled={!hasChildren} aria-label={expanded ? 'collapse' : 'expand'}>
          {hasChildren ? (expanded ? '▾' : '▸') : '·'}
        </button>

        <Link href={`/orgs/${orgId}/authority-terms/${term.id}`}>
          {term.preferred_label}
        </Link>

        <span className="muted">
          (BT×{term.broader_count} · NT×{term.narrower_count})
        </span>

        {term.broader_count > 1 ? <span className="muted">[多重上位]</span> : null}
      </div>

      {expanded ? (
        <div style={{ marginTop: 6 }}>
          {childrenState?.loading ? <div className="muted">children 載入中…</div> : null}
          {childrenState?.error ? <div className="fieldError">children 錯誤：{childrenState.error}</div> : null}

          {childrenItems.length > 0 ? (
            <ul style={{ marginTop: 8 }}>
              {childrenItems.map((edge) => (
                <li key={edge.relation_id} style={{ marginBottom: 8 }}>
                  {renderNode(edge.term, level + 1)}
                </li>
              ))}
            </ul>
          ) : null}

          {childrenPage?.next_cursor ? (
            <button type="button" onClick={onLoadMore} disabled={childrenState?.loadingMore}>
              {childrenState?.loadingMore ? '載入中…' : '載入更多 children'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
