/**
 * Authority Terms Page（/orgs/:orgId/authority-terms）
 *
 * 這頁是「controlled vocabulary（權威控制檔）」的管理入口：
 * - name：姓名款目（作者/貢獻者）
 * - subject：主題詞（可搭配 thesaurus：BT/NT/RT）
 * - geographic：地理名稱（MARC 651）
 * - genre：類型/體裁（MARC 655）
 * - language：語言（MARC 041；本輪先把 kinds 打開，細規則在文件定死）
 * - relator：關係/角色代碼（MARC 700$e/$4；本輪先用前端 datalist 提示）
 *
 * 對應 API：
 * - GET   /api/v1/orgs/:orgId/authority-terms
 * - GET   /api/v1/orgs/:orgId/authority-terms/suggest
 * - POST  /api/v1/orgs/:orgId/authority-terms
 * - PATCH /api/v1/orgs/:orgId/authority-terms/:termId
 *
 * v1 的定位（先可用，再演進）：
 * - subjects / names 已經可以 term-based（書目寫入以 term_id 為準）
 * - 其他 kinds 先提供「主檔 + 搜尋/建議」，讓 MARC 編輯器可用 $0/$2 做 linking，再逐步把編目 UI 補齊
 */

/**
 * NOTE:
 * - 本頁是「Authority Terms 列表/維護」。
 * - 你也要求有一個「治理主入口」把 terms / thesaurus / backfill / MARC 串起來。
 *   → 入口在：/orgs/:orgId/authority
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { AuthorityTerm } from '../../../lib/api';
import { createAuthorityTerm, listAuthorityTerms, updateAuthorityTerm } from '../../../lib/api';
import { Alert } from '../../../components/ui/alert';
import { CursorPagination } from '../../../components/ui/cursor-pagination';
import { DataTable } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

const AUTHORITY_KINDS: AuthorityTerm['kind'][] = ['subject', 'name', 'geographic', 'genre', 'language', 'relator'];
function parseAuthorityKindFromUrl(raw: string | null): AuthorityTerm['kind'] | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  return (AUTHORITY_KINDS as string[]).includes(v) ? (v as AuthorityTerm['kind']) : null;
}

function parseLines(value: string) {
  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export default function AuthorityTermsPage({ params }: { params: { orgId: string } }) {
  // staff session：authority_terms 是後台主檔，受 StaffAuthGuard 保護
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const searchParams = useSearchParams();

  // filters（管理頁）
  const [kind, setKind] = useState<AuthorityTerm['kind']>(() => parseAuthorityKindFromUrl(searchParams.get('kind')) ?? 'subject');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [vocabularyCode, setVocabularyCode] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [limit, setLimit] = useState<string>('200');

  // data
  const [page, setPage] = useState<{ items: AuthorityTerm[]; next_cursor: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ----------------------------
  // create form
  // ----------------------------

  const [newPreferredLabel, setNewPreferredLabel] = useState('');
  const [newVariantLabels, setNewVariantLabels] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newVocabularyCode, setNewVocabularyCode] = useState('local');
  const [creating, setCreating] = useState(false);

  // ----------------------------
  // edit form（一次只編輯一筆，避免 UI 太複雜）
  // ----------------------------

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPreferredLabel, setEditPreferredLabel] = useState('');
  const [editVariantLabels, setEditVariantLabels] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editVocabularyCode, setEditVocabularyCode] = useState('local');
  const [editStatus, setEditStatus] = useState<AuthorityTerm['status']>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const limitValue = useMemo(() => {
    const n = Number.parseInt(limit.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) return 200;
    return Math.min(n, 500);
  }, [limit]);

  // thesaurus links：
  // - BT/NT/RT 目前只支援 subject/geographic/genre（對齊 650/651/655）
  // - vocabulary_code 若未指定，thesaurus 頁會預設 builtin-zh（這裡也用同樣策略做連結）
  const thesaurusKind = kind === 'subject' || kind === 'geographic' || kind === 'genre' ? kind : null;
  const thesaurusVocabularyCode = vocabularyCode.trim() || 'builtin-zh';

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await listAuthorityTerms(params.orgId, {
        kind,
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(vocabularyCode.trim() ? { vocabulary_code: vocabularyCode.trim() } : {}),
        status,
        limit: limitValue,
      });
      setPage(result);
    } catch (e) {
      setPage(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!page?.next_cursor) return;

    setLoadingMore(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await listAuthorityTerms(params.orgId, {
        kind,
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(vocabularyCode.trim() ? { vocabulary_code: vocabularyCode.trim() } : {}),
        status,
        limit: limitValue,
        cursor: page.next_cursor,
      });
      setPage({ items: [...page.items, ...next.items], next_cursor: next.next_cursor });
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session, kind, status, vocabularyCode, query, limitValue]);

  // URL deep link：允許從「Authority Control 主頁」或其他頁面帶 query params 初始化
  // - 目前最重要的是 kind（因為你常在 subject/geographic/genre/name 間切換）
  useEffect(() => {
    const urlKind = parseAuthorityKindFromUrl(searchParams.get('kind'));
    if (urlKind && urlKind !== kind) setKind(urlKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    const preferred = newPreferredLabel.trim();
    if (!preferred) {
      setError('preferred_label 不可為空');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      await createAuthorityTerm(params.orgId, {
        kind,
        preferred_label: preferred,
        ...(newVocabularyCode.trim() ? { vocabulary_code: newVocabularyCode.trim() } : {}),
        ...(parseLines(newVariantLabels) ? { variant_labels: parseLines(newVariantLabels) } : {}),
        ...(newNote.trim() ? { note: newNote.trim() } : {}),
        // v0：UI 建立的款目一律標記 local（內建詞彙庫由 seed/維運工具建立）
        source: 'local',
        status: 'active',
      });

      setNewPreferredLabel('');
      setNewVariantLabels('');
      setNewNote('');
      setSuccess('已建立 authority term');
      await refresh();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(t: AuthorityTerm) {
    setEditingId(t.id);
    setEditPreferredLabel(t.preferred_label);
    setEditVariantLabels((t.variant_labels ?? []).join('\n'));
    setEditNote(t.note ?? '');
    setEditVocabularyCode(t.vocabulary_code ?? 'local');
    setEditStatus(t.status);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPreferredLabel('');
    setEditVariantLabels('');
    setEditNote('');
    setEditVocabularyCode('local');
    setEditStatus('active');
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    const current = (page?.items ?? []).find((x) => x.id === editingId);
    if (!current) {
      setError('找不到要編輯的 term（請重新整理）');
      return;
    }

    const payload: Parameters<typeof updateAuthorityTerm>[2] = {};

    const preferred = editPreferredLabel.trim();
    if (!preferred) {
      setError('preferred_label 不可為空');
      return;
    }
    if (preferred !== current.preferred_label) payload.preferred_label = preferred;

    const vocab = editVocabularyCode.trim();
    if (!vocab) {
      setError('vocabulary_code 不可為空（至少用 local）');
      return;
    }
    if (vocab !== current.vocabulary_code) payload.vocabulary_code = vocab;

    const variants = parseLines(editVariantLabels) ?? null;
    const currentVariants = current.variant_labels ?? null;
    if (JSON.stringify(variants) !== JSON.stringify(currentVariants)) payload.variant_labels = variants;

    const note = editNote.trim() ? editNote.trim() : null;
    const currentNote = current.note ?? null;
    if (note !== currentNote) payload.note = note;

    if (editStatus !== current.status) payload.status = editStatus;

    if (Object.keys(payload).length === 0) {
      setError('沒有任何變更需要儲存');
      return;
    }

    setUpdatingId(editingId);
    setError(null);
    setSuccess(null);
    try {
      await updateAuthorityTerm(params.orgId, editingId, payload);
      setSuccess('已更新 authority term');
      await refresh();
      cancelEdit();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleStatus(t: AuthorityTerm) {
    setUpdatingId(t.id);
    setError(null);
    setSuccess(null);
    try {
      await updateAuthorityTerm(params.orgId, t.id, { status: t.status === 'active' ? 'inactive' : 'active' });
      setSuccess(t.status === 'active' ? '已停用' : '已啟用');
      await refresh();
      if (editingId === t.id) cancelEdit();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdatingId(null);
    }
  }

  function statusBadgeVariant(s: AuthorityTerm['status']): 'success' | 'danger' {
    // 這裡的顏色不是「規則」本身，而是治理 UI 的掃描輔助：
    // - active：可用（綠）
    // - inactive：停用/不建議用（紅）
    return s === 'active' ? 'success' : 'danger';
  }

  // Login gate
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Authority Terms" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader
          title="Authority Terms"
          description="這頁需要 staff 登入（StaffAuthGuard），才能治理權威詞主檔。"
          actions={
            <Link className="btnSmall btnPrimary" href={`/orgs/${params.orgId}/login`}>
              前往登入
            </Link>
          }
        >
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
        title="Authority Terms（權威詞主檔）"
        description={
          <>
            這裡是 controlled vocabulary 的「單一真相來源」：term-based 編目、thesaurus、MARC $0 linking、backfill 都會以此為準。
            <br />
            API：<code>GET/POST/PATCH /api/v1/orgs/:orgId/authority-terms</code>
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority`}>
              主控入口
            </Link>
            <Link className="btnSmall btnPrimary" href="#create">
              新增款目
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}`}>
              Dashboard
            </Link>
          </>
        }
      >
        <div className="grid3">
          <div className="callout">
            <div className="muted">orgId</div>
            <div style={{ fontFamily: 'var(--font-mono)' }}>{params.orgId}</div>
          </div>
          <div className="callout">
            <div className="muted">登入者</div>
            <div style={{ fontWeight: 900 }}>{session.user.name}</div>
            <div className="muted">{session.user.role}</div>
          </div>
          <div className="callout">
            <div className="muted">目前範圍</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge--info">{kind}</span>
              <span
                className={[
                  'badge',
                  status === 'active' ? 'badge--success' : status === 'inactive' ? 'badge--danger' : 'badge--info',
                ].join(' ')}
              >
                {status}
              </span>
              <span className="muted">{vocabularyCode.trim() ? `vocab=${vocabularyCode.trim()}` : 'vocab=all'}</span>
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbarLeft">
            {thesaurusKind ? (
              <>
                <Link
                  className="btnSmall"
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    thesaurusVocabularyCode,
                  )}`}
                >
                  Thesaurus Browser
                </Link>
                <Link
                  className="btnSmall"
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus/quality?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    thesaurusVocabularyCode,
                  )}`}
                >
                  Quality
                </Link>
                <Link
                  className="btnSmall"
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus/visual?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    thesaurusVocabularyCode,
                  )}`}
                >
                  Visual
                </Link>
              </>
            ) : (
              <span className="muted">（此 kind 不支援 Thesaurus：只支援 subject/geographic/genre）</span>
            )}
          </div>
        </div>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </PageHeader>

      <div className="grid2">
        <section className="panel">
          <SectionHeader
            title="搜尋/篩選"
            description="filters 變更後會自動 refresh；你也可手動按「重新整理」。"
            actions={
              <button type="button" className="btnSmall" onClick={() => void refresh()} disabled={loading}>
                {loading ? '載入中…' : '重新整理'}
              </button>
            }
          />

          {/* NOTE:
           * - 目前這頁的 filters 採「state 變更 → useEffect 自動 refresh」。
           * - 因此這裡的表單主要目標是：一致容器 + 可掃描。 */}
          <Form onSubmit={(e) => e.preventDefault()}>
            <FormSection title="條件" description="query 為模糊搜尋（preferred_label + variant_labels）。">
              <div className="grid2">
                <Field label="kind（款目類型）" htmlFor="authority_kind">
                  <select id="authority_kind" value={kind} onChange={(e) => setKind(e.target.value as AuthorityTerm['kind'])}>
                    <option value="subject">subject（主題詞 / 650）</option>
                    <option value="geographic">geographic（地理名稱 / 651）</option>
                    <option value="genre">genre（類型/體裁 / 655）</option>
                    <option value="name">name（姓名 / 100/700）</option>
                    <option value="language">language（語言 / 041/008）</option>
                    <option value="relator">relator（關係/角色 / $e/$4）</option>
                  </select>
                </Field>

                <Field label="status" htmlFor="authority_status">
                  <select id="authority_status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                    <option value="active">active（只看啟用）</option>
                    <option value="inactive">inactive（只看停用）</option>
                    <option value="all">all（全部）</option>
                  </select>
                </Field>
              </div>

              <div className="grid2">
                <Field label="vocabulary_code（選填）" htmlFor="authority_vocab" hint="例：local / builtin-zh">
                  <input id="authority_vocab" value={vocabularyCode} onChange={(e) => setVocabularyCode(e.target.value)} />
                </Field>

                <Field label="limit（1..500）" htmlFor="authority_limit" className="field--narrow">
                  <input id="authority_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
                </Field>
              </div>

              <Field label="query（模糊搜尋）" htmlFor="authority_query" hint="例：魔法 / Rowling / 資訊素養">
                <input
                  id="authority_query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例如：魔法 / Rowling / 資訊素養"
                />
              </Field>

              <FormActions>
                <Link className="btnSmall" href={`/orgs/${params.orgId}/authority`}>
                  回主控入口
                </Link>
                {thesaurusKind ? (
                  <>
                    <Link
                      className="btnSmall"
                      href={`/orgs/${params.orgId}/authority-terms/thesaurus?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                        thesaurusVocabularyCode,
                      )}`}
                    >
                      Thesaurus Browser
                    </Link>
                    <Link
                      className="btnSmall"
                      href={`/orgs/${params.orgId}/authority-terms/thesaurus/visual?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                        thesaurusVocabularyCode,
                      )}`}
                    >
                      Visual
                    </Link>
                  </>
                ) : (
                  <span className="muted">（此 kind 不支援 Thesaurus）</span>
                )}
              </FormActions>
            </FormSection>
          </Form>
        </section>

        <section className="panel" id="create">
          <SectionHeader title="建立新款目（local）" description="由 UI 建立的款目一律 source=local；內建詞彙庫由 seed/維運工具建立。" />
          <Form onSubmit={onCreate}>
            <FormSection title="建立" description="建立後可再進入 term detail 做 usage / merge/redirect / 關係治理。">
              <Field label="preferred_label（必填）" htmlFor="new_preferred_label" error={error === 'preferred_label 不可為空' ? error : undefined}>
                <input
                  id="new_preferred_label"
                  value={newPreferredLabel}
                  onChange={(e) => setNewPreferredLabel(e.target.value)}
                />
              </Field>

              <div className="grid2">
                <Field label="vocabulary_code" htmlFor="new_vocabulary_code" hint="建議：local（若你要多套詞彙庫可自行分碼）">
                  <input
                    id="new_vocabulary_code"
                    value={newVocabularyCode}
                    onChange={(e) => setNewVocabularyCode(e.target.value)}
                  />
                </Field>
                <Field label="kind" htmlFor="new_kind" hint="沿用上方篩選的 kind（讓你更快批次建立同類款目）。">
                  <input id="new_kind" value={kind} disabled />
                </Field>
              </div>

              <Field label="variant_labels（選填；每行一個）" htmlFor="new_variant_labels" hint="UF（同義詞/別名/常見錯寫）。">
                <textarea
                  id="new_variant_labels"
                  value={newVariantLabels}
                  onChange={(e) => setNewVariantLabels(e.target.value)}
                  rows={4}
                />
              </Field>

              <Field label="note（選填）" htmlFor="new_note">
                <textarea id="new_note" value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} />
              </Field>

              <FormActions>
                <button type="submit" className="btnPrimary" disabled={creating}>
                  {creating ? '建立中…' : '建立'}
                </button>
              </FormActions>
            </FormSection>
          </Form>
        </section>
      </div>

      <section className="panel">
        <SectionHeader
          title="款目列表"
          description={page ? `showing ${page.items.length} · next_cursor=${page.next_cursor ? '有' : '無'}` : undefined}
          actions={
            <button type="button" className="btnSmall" onClick={() => void refresh()} disabled={loading}>
              {loading ? '載入中…' : '重新整理'}
            </button>
          }
        />
        {loading && !page ? <SkeletonTable columns={6} rows={8} /> : null}

        {!loading && !page ? (
          <EmptyState
            title="尚無資料"
            description="目前沒有 authority terms 可顯示（可能是載入失敗或尚未建立）。"
            actions={
              <button type="button" className="btnPrimary" onClick={() => void refresh()}>
                重試載入
              </button>
            }
          />
        ) : null}

        {page && page.items.length === 0 ? (
          <EmptyState
            title="沒有資料"
            description="你可以改變 kind/status/query，或先建立第一筆款目。"
          />
        ) : null}

        {page && page.items.length > 0 ? (
          <div className="stack">
            <DataTable
              rows={page.items}
              getRowKey={(t) => t.id}
              density="compact"
              getRowHref={(t) => `/orgs/${params.orgId}/authority-terms/${t.id}`}
              initialSort={{ columnId: 'preferred_label', direction: 'asc' }}
              sortHint="排序僅影響目前已載入資料（cursor pagination）。"
              rowActionsHeader="actions"
              rowActionsWidth={240}
              rowActions={(t) => {
                const isUpdating = updatingId === t.id;
                return (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Link className="btnSmall" href={`/orgs/${params.orgId}/authority-terms/${t.id}`}>
                      詳情
                    </Link>
                    <button type="button" onClick={() => startEdit(t)} className="btnSmall">
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleStatus(t)}
                      disabled={isUpdating}
                      className={['btnSmall', t.status === 'active' ? 'btnDanger' : 'btnPrimary'].join(' ')}
                    >
                      {isUpdating ? '處理中…' : t.status === 'active' ? '停用' : '啟用'}
                    </button>
                  </div>
                );
              }}
              columns={[
                {
                  id: 'preferred_label',
                  header: 'preferred_label',
                  cell: (t) => (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <Link href={`/orgs/${params.orgId}/authority-terms/${t.id}`}>
                        <span style={{ fontWeight: 800 }}>{t.preferred_label}</span>
                      </Link>
                      <div className="muted" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className={['badge', `badge--${statusBadgeVariant(t.status)}`].join(' ')}>{t.status}</span>
                        <span className="badge badge--info">{t.kind}</span>
                        <span className="muted">{t.vocabulary_code}</span>
                        <span className="muted">source={t.source}</span>
                      </div>
                    </div>
                  ),
                  sortValue: (t) => t.preferred_label,
                },
                {
                  id: 'variants',
                  header: 'variant_labels',
                  cell: (t) =>
                    t.variant_labels && t.variant_labels.length > 0 ? (
                      <span className="muted">
                        {t.variant_labels.slice(0, 3).join(' · ')}
                        {t.variant_labels.length > 3 ? <span> · …</span> : null}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    ),
                  sortValue: (t) => (t.variant_labels?.[0] ?? ''),
                  width: 260,
                },
                {
                  id: 'note',
                  header: 'note',
                  cell: (t) => (t.note ? <span className="muted">{t.note}</span> : <span className="muted">—</span>),
                  sortValue: (t) => t.note ?? '',
                  width: 240,
                },
                {
                  id: 'id',
                  header: 'id',
                  cell: (t) => <code>{t.id}</code>,
                  sortValue: (t) => t.id,
                  width: 310,
                },
              ]}
            />

            <CursorPagination
              showing={page.items.length}
              nextCursor={page.next_cursor}
              loadingMore={loadingMore}
              loading={loading}
              onLoadMore={() => void loadMore()}
            />
          </div>
        ) : null}
      </section>

      {/* 編輯面板：從「列表 actions」進來（避免在 table row 內塞一整個表單造成閱讀負擔） */}
      {editingId ? (
        <section className="panel">
          <SectionHeader
            title="編輯款目"
            description={
              <>
                editing_id=<code>{editingId}</code>
              </>
            }
            actions={
              <>
                <button type="button" className="btnSmall" onClick={cancelEdit} disabled={Boolean(updatingId)}>
                  關閉
                </button>
                <Link className="btnSmall" href={`/orgs/${params.orgId}/authority-terms/${editingId}`}>
                  開啟詳情
                </Link>
              </>
            }
          />

          <Form onSubmit={onSaveEdit}>
            <FormSection title="更新" description="只會送出有變更的欄位（減少無意義的 updated_at 異動）。">
              <div className="grid2">
                <Field label="preferred_label（必填）" htmlFor="edit_preferred_label">
                  <input
                    id="edit_preferred_label"
                    value={editPreferredLabel}
                    onChange={(e) => setEditPreferredLabel(e.target.value)}
                  />
                </Field>
                <Field label="vocabulary_code（必填）" htmlFor="edit_vocabulary_code" hint="至少用 local。">
                  <input
                    id="edit_vocabulary_code"
                    value={editVocabularyCode}
                    onChange={(e) => setEditVocabularyCode(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="variant_labels（每行一個；留空代表清空）" htmlFor="edit_variant_labels">
                <textarea
                  id="edit_variant_labels"
                  value={editVariantLabels}
                  onChange={(e) => setEditVariantLabels(e.target.value)}
                  rows={4}
                />
              </Field>

              <Field label="note（留空代表清空）" htmlFor="edit_note">
                <textarea id="edit_note" value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} />
              </Field>

              <div className="grid2">
                <Field label="status" htmlFor="edit_status">
                  <select id="edit_status" value={editStatus} onChange={(e) => setEditStatus(e.target.value as AuthorityTerm['status'])}>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </Field>
                <Field label="id" htmlFor="edit_id">
                  <input id="edit_id" value={editingId} disabled />
                </Field>
              </div>

              <FormActions>
                <button type="submit" className="btnPrimary" disabled={Boolean(updatingId)}>
                  {updatingId ? '儲存中…' : '儲存'}
                </button>
                <button type="button" className="btnSmall" onClick={cancelEdit} disabled={Boolean(updatingId)}>
                  取消
                </button>
              </FormActions>
            </FormSection>
          </Form>
        </section>
      ) : null}
    </div>
  );
}
