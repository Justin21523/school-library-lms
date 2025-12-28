/**
 * Thesaurus Quality（/orgs/:orgId/authority-terms/thesaurus/quality）
 *
 * 目的：在 polyhierarchy + 大量詞彙下，提供「治理/清理」的可視化入口。
 *
 * v1.1 先做三種常見問題清單：
 * - orphans：完全孤立（沒有 BT/NT/RT）
 * - multi_broader：同時掛在多個 BT（polyhierarchy 可接受，但需要治理/確認）
 * - unused_with_relations：有關係但未被書目 subjects 使用（可能是過度建詞或尚未編目套用）
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { ThesaurusQualityIssueType, ThesaurusQualityPage } from '../../../../../lib/api';
import { getThesaurusQuality } from '../../../../../lib/api';
import { formatErrorMessage } from '../../../../../lib/error';
import { useStaffSession } from '../../../../../lib/use-staff-session';

export default function ThesaurusQualityPage({ params }: { params: { orgId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const searchParams = useSearchParams();

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
  const [type, setType] = useState<ThesaurusQualityIssueType>(() => {
    const v = (searchParams.get('type') ?? '').trim();
    if (v === 'orphans' || v === 'multi_broader' || v === 'unused_with_relations') return v;
    return 'orphans';
  });
  const [limit, setLimit] = useState(() => (searchParams.get('limit') ?? '').trim() || '200');

  const limitValue = useMemo(() => {
    const n = Number.parseInt(limit.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) return 200;
    return Math.min(n, 500);
  }, [limit]);

  const [page, setPage] = useState<ThesaurusQualityPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const vocab = vocabularyCode.trim();
    if (!vocab) {
      setError('vocabulary_code 不可為空');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await getThesaurusQuality(params.orgId, {
        kind,
        vocabulary_code: vocab,
        status,
        type,
        limit: limitValue,
      });
      setPage(next);
    } catch (e) {
      setPage(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!page?.next_cursor) return;

    const vocab = vocabularyCode.trim();
    if (!vocab) return;

    setLoadingMore(true);
    setError(null);
    try {
      const next = await getThesaurusQuality(params.orgId, {
        kind,
        vocabulary_code: vocab,
        status,
        type,
        limit: limitValue,
        cursor: page.next_cursor,
      });
      setPage({ items: [...(page.items ?? []), ...next.items], next_cursor: next.next_cursor });
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
  }, [sessionReady, session, kind, vocabularyCode, status, type, limitValue]);

  // URL deep link：/quality?kind=geographic&vocabulary_code=builtin-zh
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

    const urlType = (searchParams.get('type') ?? '').trim();
    if (urlType === 'orphans' || urlType === 'multi_broader' || urlType === 'unused_with_relations') setType(urlType);

    const urlLimit = (searchParams.get('limit') ?? '').trim();
    if (urlLimit) setLimit(urlLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Login gate
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Thesaurus Quality</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Thesaurus Quality</h1>
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
        <h1 style={{ marginTop: 0 }}>Thesaurus Quality</h1>
        <p className="muted">用於治理/清理：找出孤立詞、多重上位、或「有關係但未被書目使用」的詞。</p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}/authority-terms/thesaurus`}>回到 Thesaurus Browser</Link>
          <Link href={`/orgs/${params.orgId}/authority`}>Authority Control（主控入口）</Link>
          <Link href={`/orgs/${params.orgId}/authority-terms`}>回到 Authority Terms</Link>
        </div>

        {error ? <p className="error">錯誤：{error}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Filters</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            kind
            <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="subject">subject（650）</option>
              <option value="geographic">geographic（651）</option>
              <option value="genre">genre（655）</option>
            </select>
          </label>
          <label>
            vocabulary_code
            <input value={vocabularyCode} onChange={(e) => setVocabularyCode(e.target.value)} />
          </label>

          <label>
            type
            <select value={type} onChange={(e) => setType(e.target.value as ThesaurusQualityIssueType)}>
              <option value="orphans">orphans（完全孤立）</option>
              <option value="multi_broader">multi_broader（多重上位）</option>
              <option value="unused_with_relations">unused_with_relations（有關係但未被書目使用）</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <label>
            status
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="all">all</option>
            </select>
          </label>

          <label>
            limit（1..500）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? '載入中…' : '重新整理'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Results</h2>
        {loading ? <p className="muted">載入中…</p> : null}
        {!loading && page && page.items.length === 0 ? <p className="muted">（沒有資料）</p> : null}

        {page && page.items.length > 0 ? (
          <div className="stack">
            <ul>
              {page.items.map((t) => (
                <li key={t.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>
                      <Link href={`/orgs/${params.orgId}/authority-terms/${t.id}`}>{t.preferred_label}</Link>{' '}
                      <span className="muted" style={{ fontWeight: 400 }}>
                        ({t.status} · BT×{t.broader_count} · NT×{t.narrower_count} · {t.issue_type})
                      </span>
                    </div>
                    <div className="muted" style={{ wordBreak: 'break-all' }}>
                      id：<code>{t.id}</code>
                    </div>
                  </div>
                </li>
              ))}
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
