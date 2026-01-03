/**
 * Loans Page（/orgs/:orgId/loans）
 *
 * 目的：
 * - 讓館員快速查詢「目前借出」與「已歸還」的借閱紀錄
 * - 提供續借（renew）操作，補齊 circulation 的日常工作流
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/loans?status=&user_external_id=&item_barcode=&limit=
 * - POST /api/v1/orgs/:orgId/circulation/renew
 *
 * 設計取捨（MVP 版）：
 * - 查詢預設 status=open（最常見）
 * - 續借需要 actor_user_id（寫 audit 用），但由登入者本人推導（session.user.id）
 * - renew 以 loan_id 作為目標（因為續借本質是改 loans.due_at）
 *
 * Auth/權限（重要）：
 * - /loans 與 /circulation/renew 都是 staff 端點，受 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id 不再由下拉選單選擇，避免冒用
 */

'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { LoanWithDetails, RenewResult } from '../../../lib/api';
import { listLoans, renewLoan } from '../../../lib/api';
import { Alert } from '../../../components/ui/alert';
import { CursorPagination } from '../../../components/ui/cursor-pagination';
import { DataTable } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

export default function LoansPage({ params }: { params: { orgId: string } }) {
  // staff session：/loans 與 /circulation/renew 都受 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：由登入者本人推導（避免 UI 任意選 actor 冒用）。
  const actorUserId = session?.user.id ?? '';

  // ---- loans 查詢 ----
  const [loans, setLoans] = useState<LoanWithDetails[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{
    query?: string;
    status?: 'open' | 'closed' | 'all';
    user_external_id?: string;
    item_barcode?: string;
    limit?: number;
  } | null>(null);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // filters（對應 API query params）
  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');
  const [query, setQuery] = useState('');
  const [userExternalId, setUserExternalId] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [limit, setLimit] = useState('200');

  // renew 狀態（避免同時多筆按鈕一起送）
  const [renewingLoanId, setRenewingLoanId] = useState<string | null>(null);

  // 共用訊息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRenewResult, setLastRenewResult] = useState<RenewResult | null>(null);

  async function refreshLoans(
    overrides?: Partial<{
      status: 'open' | 'closed' | 'all';
      query: string;
      userExternalId: string;
      itemBarcode: string;
      limit: string;
    }>,
  ) {
    setLoadingLoans(true);
    setError(null);
    setSuccess(null);

    try {
      // 允許呼叫端用 overrides 暫時覆蓋 filters：
      // - 典型情境：按下「清除」時，setState 尚未生效，但我們希望用預設條件立即刷新
      const effectiveStatus = overrides?.status ?? status;
      const effectiveQuery = overrides?.query ?? query;
      const effectiveUserExternalId = overrides?.userExternalId ?? userExternalId;
      const effectiveItemBarcode = overrides?.itemBarcode ?? itemBarcode;
      const effectiveLimit = overrides?.limit ?? limit;

      // limit：空字串視為未提供；否則轉 int。
      const trimmedLimit = effectiveLimit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const filters = {
        status: effectiveStatus,
        query: effectiveQuery.trim() || undefined,
        user_external_id: effectiveUserExternalId.trim() || undefined,
        item_barcode: effectiveItemBarcode.trim() || undefined,
        limit: limitNumber,
      };

      const result = await listLoans(params.orgId, filters);
      setLoans(result.items);
      setNextCursor(result.next_cursor);
      setAppliedFilters(filters);
    } catch (e) {
      setLoans(null);
      setNextCursor(null);
      setAppliedFilters(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingLoans(false);
    }
  }

  async function loadMoreLoans() {
    if (!nextCursor || !appliedFilters) return;

    setLoadingMore(true);
    setError(null);
    setSuccess(null);

    try {
      const page = await listLoans(params.orgId, { ...appliedFilters, cursor: nextCursor });
      setLoans((prev) => [...(prev ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  // 初次載入：列出 open loans（limit=200）
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refreshLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refreshLoans();
  }

  async function onRenew(loanId: string) {
    setError(null);
    setSuccess(null);
    setLastRenewResult(null);

    if (!actorUserId) {
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    setRenewingLoanId(loanId);
    try {
      const result = await renewLoan(params.orgId, {
        loan_id: loanId,
        actor_user_id: actorUserId,
      });

      setLastRenewResult(result);
      setSuccess('續借成功');

      // 續借後刷新列表（讓 due_at/renewed_count 立即更新）
      await refreshLoans();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setRenewingLoanId(null);
    }
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Loans" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="Loans">
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查詢/續借。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  function loanStatusBadgeVariant(s: LoanWithDetails['status']): 'info' | 'success' {
    // open/closed 對館員來說是「流程狀態」，用顏色讓掃描更快：
    // - open：借出中（藍）
    // - closed：已歸還（綠）
    return s === 'closed' ? 'success' : 'info';
  }

  function itemStatusBadgeVariant(s: LoanWithDetails['item_status']): 'success' | 'info' | 'danger' | 'warning' {
    // 與 Items 頁一致：同一狀態在不同頁要呈現一致的 cue，避免學習成本。
    if (s === 'available') return 'success';
    if (s === 'lost' || s === 'withdrawn') return 'danger';
    if (s === 'repair') return 'warning';
    return 'info';
  }

  return (
    <div className="stack">
      <PageHeader
        title="Loans"
        description={
          <>
            查詢對應 API：<code>GET /api/v1/orgs/:orgId/loans</code>；續借對應 API：<code>POST /api/v1/orgs/:orgId/circulation/renew</code>
          </>
        }
      >
        <p className="muted">
          借閱歷史保存期限（US-061）屬於系統管理作業：請到 <Link href={`/orgs/${params.orgId}/loans/maintenance`}>Loans Maintenance</Link> 先預覽（preview）再套用（apply），並可在{' '}
          <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 用 action <code>loan.purge_history</code> 追溯清理紀錄。
        </p>

        <p className="muted">
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} / {session.user.role}）
        </p>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}

        {success ? (
          <Alert variant="success" title={success} role="status" />
        ) : null}

        {lastRenewResult ? (
          <Alert variant="info" title="renew 結果" role="status">
            loan_id=<code>{lastRenewResult.loan_id}</code> · renewed_count=<code>{lastRenewResult.renewed_count}</code> ·
            due_at=<code>{lastRenewResult.due_at}</code>
          </Alert>
        ) : null}

        <Form onSubmit={onSearch}>
          <FormSection title="查詢" description="支援 query（模糊）與 user_external_id/item_barcode（精確）；未提供時預設 status=open。">
            <div className="grid4">
              <Field label="query（姓名/學號/條碼/書名）" htmlFor="loans_query">
                <input
                  id="loans_query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例：王小明 / S1130123 / SCL- / 哈利波特"
                />
              </Field>
              <Field label="status" htmlFor="loans_status">
                <select
                  id="loans_status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'open' | 'closed' | 'all')}
                >
                  <option value="open">open（未歸還）</option>
                  <option value="closed">closed（已歸還）</option>
                  <option value="all">all（全部）</option>
                </select>
              </Field>

              <Field label="user_external_id（精確）" htmlFor="loans_user_external_id">
                <input
                  id="loans_user_external_id"
                  value={userExternalId}
                  onChange={(e) => setUserExternalId(e.target.value)}
                  placeholder="例：S1130123"
                />
              </Field>

              <Field label="item_barcode（精確）" htmlFor="loans_item_barcode">
                <input
                  id="loans_item_barcode"
                  value={itemBarcode}
                  onChange={(e) => setItemBarcode(e.target.value)}
                  placeholder="例：LIB-00001234"
                />
              </Field>
            </div>

            <Field label="limit（預設 200）" htmlFor="loans_limit" hint="建議 50–200；避免一次拉太多造成 UI 卡頓。">
              <input id="loans_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </Field>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loadingLoans}>
                {loadingLoans ? '查詢中…' : '查詢'}
              </button>
              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  setStatus('open');
                  setQuery('');
                  setUserExternalId('');
                  setItemBarcode('');
                  setLimit('200');
                  void refreshLoans({
                    status: 'open',
                    query: '',
                    userExternalId: '',
                    itemBarcode: '',
                    limit: '200',
                  });
                }}
                disabled={loadingLoans}
              >
                清除
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </PageHeader>

      <section className="panel">
        <SectionHeader title="結果" />
        {loadingLoans && !loans ? <SkeletonTable columns={7} rows={8} /> : null}

        {!loadingLoans && !loans ? (
          <EmptyState
            title="尚無資料"
            description="目前沒有 loans 可顯示（可能是查詢失敗或尚未產生借閱）。"
            actions={
              <button type="button" className="btnPrimary" onClick={() => void refreshLoans()}>
                重試載入
              </button>
            }
          />
        ) : null}

        {!loadingLoans && loans && loans.length === 0 ? (
          <EmptyState title="沒有符合條件的 loans" description="你可以調整查詢條件或清除條件後再試一次。" />
        ) : null}

        {loans && loans.length > 0 ? (
          <div className="stack">
            <DataTable
              rows={loans}
              getRowKey={(l) => l.id}
              density="compact"
              initialSort={{ columnId: 'due_at', direction: 'asc' }}
              sortHint="排序僅影響目前已載入資料（cursor pagination）。"
              getRowHref={(l) => `/orgs/${params.orgId}/bibs/${l.bibliographic_id}`}
              rowActionsHeader="actions"
              rowActionsWidth={140}
              rowActions={(l) =>
                l.returned_at === null ? (
                  <button
                    type="button"
                    className={['btnSmall', 'btnPrimary'].join(' ')}
                    onClick={() => void onRenew(l.id)}
                    disabled={renewingLoanId === l.id}
                  >
                    {renewingLoanId === l.id ? '續借中…' : '續借'}
                  </button>
                ) : (
                  <span className="muted">—</span>
                )
              }
              columns={[
                {
                  id: 'status',
                  header: 'status',
                  cell: (l) => <span className={['badge', `badge--${loanStatusBadgeVariant(l.status)}`].join(' ')}>{l.status}</span>,
                  sortValue: (l) => l.status,
                  width: 120,
                },
                {
                  id: 'bibliographic_title',
                  header: 'bib',
                  cell: (l) => (
                    <Link href={`/orgs/${params.orgId}/bibs/${l.bibliographic_id}`}>
                      <span style={{ fontWeight: 700 }}>{l.bibliographic_title}</span>
                    </Link>
                  ),
                  sortValue: (l) => l.bibliographic_title,
                },
                {
                  id: 'borrower',
                  header: 'borrower',
                  cell: (l) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div>{l.user_name}</div>
                      <div className="muted">
                        <code>{l.user_external_id}</code> · {l.user_role}
                      </div>
                    </div>
                  ),
                  sortValue: (l) => l.user_external_id,
                  width: 220,
                },
                {
                  id: 'item',
                  header: 'item',
                  cell: (l) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div>
                        <Link href={`/orgs/${params.orgId}/items/${l.item_id}`}>{l.item_barcode}</Link>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={['badge', `badge--${itemStatusBadgeVariant(l.item_status)}`].join(' ')}>
                          {l.item_status}
                        </span>
                        <span className="muted">{l.item_call_number}</span>
                      </div>
                    </div>
                  ),
                  sortValue: (l) => l.item_barcode,
                  width: 240,
                },
                {
                  id: 'due_at',
                  header: 'due_at',
                  cell: (l) => (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <code className={l.is_overdue ? 'error' : undefined}>{l.due_at}</code>
                      {l.is_overdue ? <span className="badge badge--danger">逾期</span> : <span className="muted">—</span>}
                    </div>
                  ),
                  sortValue: (l) => l.due_at,
                  width: 190,
                },
                {
                  id: 'renewed_count',
                  header: 'renewed',
                  cell: (l) => <code>{l.renewed_count}</code>,
                  sortValue: (l) => l.renewed_count,
                  align: 'right',
                  width: 120,
                },
              ]}
            />

            <CursorPagination
              showing={loans.length}
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              loading={loadingLoans}
              onLoadMore={() => void loadMoreLoans()}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
