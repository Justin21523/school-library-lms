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
import { Alert } from '../../../../../components/ui/alert';
import { DataTable } from '../../../../../components/ui/data-table';
import { EmptyState } from '../../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../../components/ui/page-header';
import { SkeletonText } from '../../../../../components/ui/skeleton';

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
        <PageHeader title="Thesaurus Quality" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="Thesaurus Quality" description="這頁需要 staff 登入才能檢視治理清單。">
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
        title="Thesaurus Quality"
        description="用於治理/清理：找出孤立詞、多重上位、或「有關係但未被書目使用」的詞。"
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority`}>
              Authority 主控
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority-terms`}>
              Terms
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority-terms/thesaurus`}>
              Browser
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
            kind：<code>{kind}</code> · vocabulary_code：<code>{vocabularyCode.trim() || '—'}</code> · status：
            <code>{status}</code> · type：<code>{type}</code>
          </div>
        </div>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader
          title="Filters"
          description="選擇 kind/vocabulary/type 後會自動刷新（也可手動重新整理）。"
          actions={
            <button type="button" className="btnSmall" onClick={() => void refresh()} disabled={loading}>
              {loading ? '載入中…' : '重新整理'}
            </button>
          }
        />

        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="篩選條件" description="vocabulary_code 建議對齊 thesaurus 的詞彙庫（例如 builtin-zh / local）。">
            <div className="grid3">
              <Field label="kind" htmlFor="thesaurus_quality_kind">
                <select id="thesaurus_quality_kind" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                  <option value="subject">subject（650）</option>
                  <option value="geographic">geographic（651）</option>
                  <option value="genre">genre（655）</option>
                </select>
              </Field>

              <Field label="vocabulary_code" htmlFor="thesaurus_quality_vocab">
                <input id="thesaurus_quality_vocab" value={vocabularyCode} onChange={(e) => setVocabularyCode(e.target.value)} />
              </Field>

              <Field label="type" htmlFor="thesaurus_quality_type">
                <select
                  id="thesaurus_quality_type"
                  value={type}
                  onChange={(e) => setType(e.target.value as ThesaurusQualityIssueType)}
                >
                  <option value="orphans">orphans（完全孤立）</option>
                  <option value="multi_broader">multi_broader（多重上位）</option>
                  <option value="unused_with_relations">unused_with_relations（有關係但未被書目使用）</option>
                </select>
              </Field>
            </div>

            <div className="grid2">
              <Field label="status" htmlFor="thesaurus_quality_status">
                <select id="thesaurus_quality_status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="all">all</option>
                </select>
              </Field>

              <Field label="limit（1..500）" htmlFor="thesaurus_quality_limit">
                <input id="thesaurus_quality_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            </div>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="Results" description="清單中的 term 可點進 detail 進一步做 usage/merge/relations 治理。" />

        {loading ? <SkeletonText lines={4} /> : null}
        {!loading && page && page.items.length === 0 ? <EmptyState title="沒有資料" description="可調整 filters（type/status/kind/vocabulary）。" /> : null}

        {page && page.items.length > 0 ? (
          <div className="stack">
            <DataTable
              rows={page.items}
              getRowKey={(r) => r.id}
              density="compact"
              columns={[
                {
                  id: 'term',
                  header: 'term',
                  cell: (r) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <Link href={`/orgs/${params.orgId}/authority-terms/${r.id}`} style={{ fontWeight: 800 }}>
                        {r.preferred_label}
                      </Link>
                      <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                        <code>{r.id}</code>
                      </div>
                    </div>
                  ),
                  sortValue: (r) => r.preferred_label,
                },
                { id: 'issue', header: 'issue', cell: (r) => <code>{r.issue_type}</code>, width: 170, sortValue: (r) => r.issue_type },
                { id: 'status', header: 'status', cell: (r) => <code>{r.status}</code>, width: 110, sortValue: (r) => r.status },
                { id: 'bt', header: 'BT', cell: (r) => <code>{r.broader_count}</code>, width: 70, align: 'right', sortValue: (r) => r.broader_count },
                { id: 'nt', header: 'NT', cell: (r) => <code>{r.narrower_count}</code>, width: 70, align: 'right', sortValue: (r) => r.narrower_count },
              ]}
            />

            {page.next_cursor ? (
              <button type="button" className="btnSmall" onClick={() => void loadMore()} disabled={loadingMore || loading}>
                {loadingMore ? '載入中…' : '載入更多'}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
