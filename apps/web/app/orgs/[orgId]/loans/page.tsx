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
    status?: 'open' | 'closed' | 'all';
    user_external_id?: string;
    item_barcode?: string;
    limit?: number;
  } | null>(null);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // filters（對應 API query params）
  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');
  const [userExternalId, setUserExternalId] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [limit, setLimit] = useState('200');

  // renew 狀態（避免同時多筆按鈕一起送）
  const [renewingLoanId, setRenewingLoanId] = useState<string | null>(null);

  // 共用訊息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRenewResult, setLastRenewResult] = useState<RenewResult | null>(null);

  async function refreshLoans(overrides?: Partial<{ status: 'open' | 'closed' | 'all' }>) {
    setLoadingLoans(true);
    setError(null);
    setSuccess(null);

    try {
      // limit：空字串視為未提供；否則轉 int。
      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const filters = {
        status: overrides?.status ?? status,
        user_external_id: userExternalId.trim() || undefined,
        item_barcode: itemBarcode.trim() || undefined,
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
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Loans</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Loans</h1>
          <p className="error">
            這頁需要 staff 登入才能查詢/續借。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Loans</h1>
        <p className="muted">
          查詢對應 API：<code>GET /api/v1/orgs/:orgId/loans</code>；續借對應 API：
          <code>POST /api/v1/orgs/:orgId/circulation/renew</code>
        </p>

        <p className="muted">
          借閱歷史保存期限（US-061）屬於系統管理作業：請到{' '}
          <Link href={`/orgs/${params.orgId}/loans/maintenance`}>Loans Maintenance</Link> 先預覽（preview）再套用（apply），
          並可在 <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 用 action{' '}
          <code>loan.purge_history</code> 追溯清理紀錄。
        </p>

        <p className="muted">
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
        {lastRenewResult ? (
          <p className="muted">
            renew 結果：loan_id={lastRenewResult.loan_id} · renewed_count={lastRenewResult.renewed_count} · due_at=
            {lastRenewResult.due_at}
          </p>
        ) : null}

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <form onSubmit={onSearch} className="stack">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'open' | 'closed' | 'all')}
              >
                <option value="open">open（未歸還）</option>
                <option value="closed">closed（已歸還）</option>
                <option value="all">all（全部）</option>
              </select>
            </label>

            <label>
              user_external_id（精確）
              <input
                value={userExternalId}
                onChange={(e) => setUserExternalId(e.target.value)}
                placeholder="例：S1130123"
              />
            </label>

            <label>
              item_barcode（精確）
              <input
                value={itemBarcode}
                onChange={(e) => setItemBarcode(e.target.value)}
                placeholder="例：LIB-00001234"
              />
            </label>
          </div>

          <label style={{ maxWidth: 240 }}>
            limit（預設 200）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loadingLoans}>
              {loadingLoans ? '查詢中…' : '查詢'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus('open');
                setUserExternalId('');
                setItemBarcode('');
                setLimit('200');
                void refreshLoans({ status: 'open' });
              }}
              disabled={loadingLoans}
            >
              清除
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>
        {loadingLoans ? <p className="muted">載入中…</p> : null}
        {!loadingLoans && loans && loans.length === 0 ? <p className="muted">沒有符合條件的 loans。</p> : null}

        {!loadingLoans && loans && loans.length > 0 ? (
          <div className="stack">
            <ul>
              {loans.map((l) => (
                <li key={l.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div>
                      <Link href={`/orgs/${params.orgId}/bibs/${l.bibliographic_id}`}>
                        <span style={{ fontWeight: 700 }}>{l.bibliographic_title}</span>
                      </Link>{' '}
                      <span className="muted">({l.status})</span>
                    </div>

                    <div className="muted">
                      borrower：{l.user_name} · external_id={l.user_external_id} · role={l.user_role}
                    </div>

                    <div className="muted">
                      item：{' '}
                      <Link href={`/orgs/${params.orgId}/items/${l.item_id}`}>{l.item_barcode}</Link> · status=
                      {l.item_status} · call_number={l.item_call_number}
                    </div>

                    <div className={l.is_overdue ? 'error' : 'muted'}>
                      due_at={l.due_at}
                      {l.is_overdue ? '（逾期）' : ''}
                      {' · '}
                      renewed_count={l.renewed_count}
                    </div>

                    <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      loan_id={l.id}
                    </div>

                    {/* 只有 open loans 才顯示續借按鈕 */}
                    {l.returned_at === null ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => void onRenew(l.id)}
                          disabled={renewingLoanId === l.id}
                        >
                          {renewingLoanId === l.id ? '續借中…' : '續借'}
                        </button>
                      </div>
                    ) : (
                      <div className="muted">returned_at={l.returned_at}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {nextCursor ? (
              <button type="button" onClick={() => void loadMoreLoans()} disabled={loadingMore || loadingLoans}>
                {loadingMore ? '載入中…' : '載入更多'}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
