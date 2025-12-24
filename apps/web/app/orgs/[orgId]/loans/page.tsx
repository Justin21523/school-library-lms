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
 * - 續借需要 actor_user_id（目前沒有登入）
 * - renew 以 loan_id 作為目標（因為續借本質是改 loans.due_at）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { LoanWithDetails, RenewResult, User } from '../../../lib/api';
import { listLoans, listUsers, renewLoan } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';

// MVP 的「可操作 RBAC」：actor 只能是 admin/librarian，且必須是 active。
// - 之後若加上登入，可直接由 token 推導 actor，不需要這段選單
function isActorCandidate(user: User) {
  return user.status === 'active' && (user.role === 'admin' || user.role === 'librarian');
}

export default function LoansPage({ params }: { params: { orgId: string } }) {
  // ---- actor 選擇（目前沒有 auth，所以要由使用者指定）----
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actorUserId, setActorUserId] = useState('');

  const actorCandidates = useMemo(() => (users ?? []).filter(isActorCandidate), [users]);

  // ---- loans 查詢 ----
  const [loans, setLoans] = useState<LoanWithDetails[] | null>(null);
  const [loadingLoans, setLoadingLoans] = useState(false);

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

  // 讀取 users（供 actor 選擇）
  useEffect(() => {
    async function run() {
      setLoadingUsers(true);
      setError(null);
      try {
        const result = await listUsers(params.orgId);
        setUsers(result);

        // 若尚未選 actor，就自動選第一個可用館員（提升可用性）。
        if (!actorUserId) {
          const first = result.find(isActorCandidate);
          if (first) setActorUserId(first.id);
        }
      } catch (e) {
        setUsers(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoadingUsers(false);
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

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

      const result = await listLoans(params.orgId, {
        status: overrides?.status ?? status,
        user_external_id: userExternalId.trim() || undefined,
        item_barcode: itemBarcode.trim() || undefined,
        limit: limitNumber,
      });
      setLoans(result);
    } catch (e) {
      setLoans(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingLoans(false);
    }
  }

  // 初次載入：列出 open loans（limit=200）
  useEffect(() => {
    void refreshLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refreshLoans();
  }

  async function onRenew(loanId: string) {
    setError(null);
    setSuccess(null);
    setLastRenewResult(null);

    if (!actorUserId) {
      setError('請先選擇 actor_user_id（館員/管理者）');
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

        <label>
          actor_user_id（操作者：admin/librarian）
          <select value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} disabled={loadingUsers}>
            <option value="">（請選擇）</option>
            {actorCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role}) · {u.external_id}
              </option>
            ))}
          </select>
        </label>

        {loadingUsers ? <p className="muted">載入可用操作者中…</p> : null}
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
        ) : null}
      </section>
    </div>
  );
}
