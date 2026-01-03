/**
 * OPAC：我的借閱（/opac/orgs/:orgId/loans）
 *
 * 目的：
 * - 讓讀者登入後查看自己的借閱清單（open/closed/all）
 *
 * 對應 API（PatronAuthGuard）：
 * - GET /api/v1/orgs/:orgId/me/loans?status=&limit=&cursor=
 *
 * 設計重點：
 * - 與 staff /loans 回傳 shape 保持一致（LoanWithDetails），方便未來共用 UI
 * - 這頁不提供續借：renew 仍是 staff 動作（需要館員確認、且可能涉及罰則/規則）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { LoanWithDetails } from '../../../../lib/api';
import { listMyLoans } from '../../../../lib/api';
import { Alert } from '../../../../components/ui/alert';
import { CursorPagination } from '../../../../components/ui/cursor-pagination';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { SkeletonTable } from '../../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../../lib/error';
import { useOpacSession } from '../../../../lib/use-opac-session';

export default function OpacMyLoansPage({ params }: { params: { orgId: string } }) {
  // OPAC session：/me 端點需要 PatronAuthGuard，因此必須先登入。
  const { ready: sessionReady, session } = useOpacSession(params.orgId);

  const [loans, setLoans] = useState<LoanWithDetails[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{
    status: 'open' | 'closed' | 'all';
    limit?: number;
  } | null>(null);

  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');
  const [limit, setLimit] = useState('200');

  const [error, setError] = useState<string | null>(null);

  const meLabel = useMemo(() => {
    if (!session) return null;
    return `${session.user.name}（${session.user.role}）· ${session.user.external_id}`;
  }, [session]);

  async function refresh(overrides?: { status: 'open' | 'closed' | 'all'; limit: string }) {
    setLoading(true);
    setError(null);

    try {
      // 注意：清除按鈕會「同時 setState + 重新查詢」；
      // React state 更新是非同步，因此 refresh 允許帶 overrides 確保查詢用的是新值。
      const effectiveStatus = overrides?.status ?? status;
      const effectiveLimitText = overrides?.limit ?? limit;

      const trimmedLimit = effectiveLimitText.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const page = await listMyLoans(params.orgId, {
        status: effectiveStatus,
        limit: limitNumber,
      });

      setLoans(page.items);
      setNextCursor(page.next_cursor);
      setAppliedFilters({ status: effectiveStatus, limit: limitNumber });
    } catch (e) {
      setLoans(null);
      setNextCursor(null);
      setAppliedFilters(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || !appliedFilters) return;

    setLoadingMore(true);
    setError(null);

    try {
      const page = await listMyLoans(params.orgId, { ...appliedFilters, cursor: nextCursor });
      setLoans((prev) => [...(prev ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  // 初次載入：登入後立刻列出 open loans。
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refresh();
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="我的借閱" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader
          title="我的借閱"
          description="這頁使用 /me 端點（PatronAuthGuard），因此需要 OPAC Account 登入。"
          actions={
            <Link className="btnSmall btnPrimary" href={`/opac/orgs/${params.orgId}/login`}>
              前往登入
            </Link>
          }
        >
          <Alert variant="danger" title="需要登入">
            這頁需要讀者登入才能查看。請先前往 <Link href={`/opac/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="我的借閱"
        description={
          <>
            目前使用者：{meLabel}；對應 API：<code>GET /api/v1/orgs/:orgId/me/loans</code>
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}`}>
              回到搜尋
            </Link>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/holds`}>
              我的預約
            </Link>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/logout`}>
              登出
            </Link>
          </>
        }
      >
        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="查詢" description="支援 open/closed/all；limit 預設 200（cursor-based pagination）。" />

        <Form onSubmit={onSearch}>
          <FormSection title="Filters" description="（提示）open=未歸還；closed=已歸還；all=全部。">
            <div className="grid2">
              <Field label="status" htmlFor="opac_loans_status">
                <select id="opac_loans_status" value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'closed' | 'all')}>
                  <option value="open">open（未歸還）</option>
                  <option value="closed">closed（已歸還）</option>
                  <option value="all">all（全部）</option>
                </select>
              </Field>

              <Field label="limit（預設 200）" htmlFor="opac_loans_limit">
                <input id="opac_loans_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '查詢中…' : '查詢'}
              </button>
              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  const nextStatus: 'open' | 'closed' | 'all' = 'open';
                  const nextLimit = '200';
                  setStatus(nextStatus);
                  setLimit(nextLimit);
                  void refresh({ status: nextStatus, limit: nextLimit });
                }}
                disabled={loading}
              >
                清除
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="結果" />

        {loading ? <SkeletonTable columns={4} rows={8} /> : null}
        {!loading && loans && loans.length === 0 ? <EmptyState title="沒有符合條件的借閱" description="你可以調整 status 後再查詢。" /> : null}

        {!loading && loans && loans.length > 0 ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <DataTable
              rows={loans}
              getRowKey={(l) => l.id}
              density="compact"
              initialSort={{ columnId: 'due_at', direction: 'asc' }}
              columns={[
                {
                  id: 'title',
                  header: 'title',
                  sortValue: (l) => l.bibliographic_title,
                  cell: (l) => (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 900 }}>{l.bibliographic_title}</span>
                        <span className="muted">
                          <code>{l.status}</code>
                          {l.is_overdue ? ' · overdue' : ''}
                        </span>
                      </div>
                      <div className="muted">
                        item_barcode=<code>{l.item_barcode}</code> · call_number=<code>{l.item_call_number}</code>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'checked_out_at',
                  header: 'checked_out_at',
                  sortValue: (l) => l.checked_out_at,
                  width: 200,
                  cell: (l) => <span className="muted">{l.checked_out_at}</span>,
                },
                {
                  id: 'due_at',
                  header: 'due_at',
                  sortValue: (l) => l.due_at,
                  width: 200,
                  cell: (l) => <span className="muted">{l.due_at}</span>,
                },
                {
                  id: 'id',
                  header: 'id',
                  sortValue: (l) => l.id,
                  width: 140,
                  cell: (l) => <code>{l.id.slice(0, 8)}…</code>,
                },
              ]}
            />

            <CursorPagination showing={loans.length} nextCursor={nextCursor} loading={loading} loadingMore={loadingMore} onLoadMore={() => void loadMore()} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
