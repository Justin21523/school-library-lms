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

  // Login gate
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Authority Terms</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Authority Terms</h1>
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
        <h1 style={{ marginTop: 0 }}>Authority / Vocabulary（v0）</h1>
        <p className="muted">
          先把「姓名/主題詞」做成可治理的主檔，讓後續 MARC 匯入、authority linking、thesaurus 都有落地點。
        </p>
        <p className="muted">
          API：<code>GET/POST/PATCH /api/v1/orgs/:orgId/authority-terms</code>
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}/authority`}>Authority Control（主控入口）</Link>
          <Link href={`/orgs/${params.orgId}/authority-terms/thesaurus`}>Thesaurus Browser</Link>
          <Link href={`/orgs/${params.orgId}/authority-terms/thesaurus/quality`}>Thesaurus Quality</Link>
          <Link href={`/orgs/${params.orgId}/authority-terms/thesaurus/visual`}>Thesaurus Visual Editor</Link>
        </div>

        <div className="muted" style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <div>
            orgId：<code>{params.orgId}</code>
          </div>
        </div>

        {loading ? <p className="muted">載入中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>搜尋/篩選</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            kind（款目類型）
            <select value={kind} onChange={(e) => setKind(e.target.value as AuthorityTerm['kind'])}>
              <option value="subject">subject（主題詞）</option>
              <option value="name">name（姓名）</option>
              <option value="geographic">geographic（地理名稱）</option>
              <option value="genre">genre（類型/體裁）</option>
              <option value="language">language（語言）</option>
              <option value="relator">relator（關係/角色）</option>
            </select>
          </label>

          <label>
            status
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="active">active（只看啟用）</option>
              <option value="inactive">inactive（只看停用）</option>
              <option value="all">all（全部）</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <label>
            vocabulary_code（選填；例如 local / builtin-zh）
            <input value={vocabularyCode} onChange={(e) => setVocabularyCode(e.target.value)} />
          </label>

          <label>
            limit（1..500）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
        </div>

        <label style={{ marginTop: 12 }}>
          query（模糊搜尋：preferred_label + variant_labels）
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例如：魔法 / Rowling / 資訊素養" />
        </label>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            重新整理
          </button>
          <Link href={`/orgs/${params.orgId}`}>回到 Dashboard</Link>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>建立新款目（local）</h2>
        <form onSubmit={onCreate} className="stack" style={{ marginTop: 12 }}>
          <label>
            preferred_label（必填）
            <input value={newPreferredLabel} onChange={(e) => setNewPreferredLabel(e.target.value)} />
          </label>

          <label>
            variant_labels（選填；每行一個）
            <textarea value={newVariantLabels} onChange={(e) => setNewVariantLabels(e.target.value)} rows={4} />
          </label>

          <label>
            note（選填）
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} />
          </label>

          <label>
            vocabulary_code（建議：local；若你要建多套詞彙庫可自行分碼）
            <input value={newVocabularyCode} onChange={(e) => setNewVocabularyCode(e.target.value)} />
          </label>

          <button type="submit" disabled={creating}>
            {creating ? '建立中…' : '建立'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>款目列表</h2>
        {page && page.items.length === 0 ? <p className="muted">沒有資料。</p> : null}

        {page && page.items.length > 0 ? (
          <div className="stack">
            <ul>
              {page.items.map((t) => {
                const isEditing = editingId === t.id;
                const isUpdating = updatingId === t.id;
                return (
                  <li key={t.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontWeight: 700 }}>
                        {t.preferred_label}{' '}
                        <span className="muted" style={{ fontWeight: 400 }}>
                          ({t.status} · {t.vocabulary_code} · {t.source})
                        </span>
                      </div>

                      {t.variant_labels && t.variant_labels.length > 0 ? (
                        <div className="muted">variant_labels：{t.variant_labels.join(' · ')}</div>
                      ) : null}

                      {t.note ? <div className="muted">note：{t.note}</div> : null}

                      <div className="muted" style={{ wordBreak: 'break-all' }}>
                        id：<code>{t.id}</code>
                      </div>

                      {!isEditing ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Link href={`/orgs/${params.orgId}/authority-terms/${t.id}`}>BT/NT/RT</Link>
                          <button type="button" onClick={() => startEdit(t)}>
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleStatus(t)}
                            disabled={isUpdating}
                          >
                            {t.status === 'active' ? '停用' : '啟用'}
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={onSaveEdit} className="stack" style={{ marginTop: 8 }}>
                          <label>
                            preferred_label
                            <input value={editPreferredLabel} onChange={(e) => setEditPreferredLabel(e.target.value)} />
                          </label>
                          <label>
                            variant_labels（每行一個；留空代表清空）
                            <textarea value={editVariantLabels} onChange={(e) => setEditVariantLabels(e.target.value)} rows={4} />
                          </label>
                          <label>
                            note（留空代表清空）
                            <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} />
                          </label>
                          <label>
                            vocabulary_code
                            <input value={editVocabularyCode} onChange={(e) => setEditVocabularyCode(e.target.value)} />
                          </label>
                          <label>
                            status
                            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as AuthorityTerm['status'])}>
                              <option value="active">active</option>
                              <option value="inactive">inactive</option>
                            </select>
                          </label>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="submit" disabled={isUpdating}>
                              {isUpdating ? '儲存中…' : '儲存'}
                            </button>
                            <button type="button" onClick={cancelEdit} disabled={isUpdating}>
                              取消
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {page.next_cursor ? (
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore || loading}>
                {loadingMore ? '載入中…' : '載入更多'}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
