/**
 * OPAC：我的借閱（/opac/orgs/:orgId/loans）
 *
 * 目的：
 * - 讓讀者登入後查看自己的借閱清單（open/closed/all）
 *
 * 對應 API（PatronAuthGuard）：
 * - GET /api/v1/orgs/:orgId/me/loans?status=&limit=
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
import { formatErrorMessage } from '../../../../lib/error';
import { useOpacSession } from '../../../../lib/use-opac-session';

export default function OpacMyLoansPage({ params }: { params: { orgId: string } }) {
  // OPAC session：/me 端點需要 PatronAuthGuard，因此必須先登入。
  const { ready: sessionReady, session } = useOpacSession(params.orgId);

  const [loans, setLoans] = useState<LoanWithDetails[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');
  const [limit, setLimit] = useState('200');

  const [error, setError] = useState<string | null>(null);

  const meLabel = useMemo(() => {
    if (!session) return null;
    return `${session.user.name}（${session.user.role}）· ${session.user.external_id}`;
  }, [session]);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const result = await listMyLoans(params.orgId, {
        status,
        limit: limitNumber,
      });

      setLoans(result);
    } catch (e) {
      setLoans(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
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
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>我的借閱</h1>
        <p className="muted">載入登入狀態中…</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>我的借閱</h1>
        <p className="error">
          這頁需要讀者登入才能查看。請先前往 <Link href={`/opac/orgs/${params.orgId}/login`}>/login</Link>。
        </p>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>我的借閱</h1>
        <p className="muted">
          目前使用者：{meLabel}；對應 API：<code>GET /api/v1/orgs/:orgId/me/loans</code>
        </p>

        <form onSubmit={onSearch} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
            <label>
              status
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="open">open（未歸還）</option>
                <option value="closed">closed（已歸還）</option>
                <option value="all">all（全部）</option>
              </select>
            </label>

            <label>
              limit（預設 200）
              <input value={limit} onChange={(e) => setLimit(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loading}>
              {loading ? '查詢中…' : '查詢'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus('open');
                setLimit('200');
                void refresh();
              }}
              disabled={loading}
            >
              清除
            </button>
          </div>
        </form>

        {error ? <p className="error">錯誤：{error}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>

        {loading ? <p className="muted">載入中…</p> : null}
        {!loading && loans && loans.length === 0 ? <p className="muted">沒有符合條件的借閱。</p> : null}

        {!loading && loans && loans.length > 0 ? (
          <ul>
            {loans.map((l) => (
              <li key={l.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{l.bibliographic_title}</span>{' '}
                    <span className="muted">
                      ({l.status}
                      {l.is_overdue ? ' · overdue' : ''})
                    </span>
                  </div>

                  <div className="muted">
                    item_barcode={l.item_barcode} · call_number={l.item_call_number}
                  </div>

                  <div className="muted">checked_out_at={l.checked_out_at}</div>
                  <div className="muted">due_at={l.due_at}</div>

                  <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    loan_id={l.id}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

