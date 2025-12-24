/**
 * Circulation Page（/orgs/:orgId/circulation）
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/circulation/checkout
 * - POST /api/v1/orgs/:orgId/circulation/checkin
 *
 * 這頁後續會提供：
 * - 借出：user_external_id + item_barcode + actor_user_id
 * - 歸還：item_barcode + actor_user_id
 *
 * 注意：目前沒有 auth，所以 actor_user_id 需要由前端提供（或選擇）。
 */

// 需要載入 actor 候選人（users），並提供借還表單，因此用 Client Component。
'use client';

import { useEffect, useMemo, useState } from 'react';

import type { CheckinResult, CheckoutResult, User } from '../../../lib/api';
import { checkin, checkout, listUsers } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';

// MVP 的「可操作 RBAC」：actor 只能是 admin/librarian，且必須是 active。
function isActorCandidate(user: User) {
  return user.status === 'active' && (user.role === 'admin' || user.role === 'librarian');
}

export default function CirculationPage({ params }: { params: { orgId: string } }) {
  // users：用來讓使用者選 actor_user_id（館員/管理者）。
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // actorUserId：借還操作者（目前沒有登入，所以要由前端指定）。
  const [actorUserId, setActorUserId] = useState('');

  // checkout 表單
  const [borrowerExternalId, setBorrowerExternalId] = useState('');
  const [checkoutBarcode, setCheckoutBarcode] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);

  // checkin 表單
  const [checkinBarcode, setCheckinBarcode] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);

  // 共用訊息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const actorCandidates = useMemo(() => (users ?? []).filter(isActorCandidate), [users]);

  // 初次載入：抓 users，供 actor 選擇。
  useEffect(() => {
    async function run() {
      setLoadingUsers(true);
      setError(null);
      try {
        const result = await listUsers(params.orgId);
        setUsers(result);

        // 若尚未選 actor，就預設選第一個候選人（提升可用性）。
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

  async function onCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCheckoutResult(null);
    setCheckinResult(null);

    const trimmedBorrower = borrowerExternalId.trim();
    const trimmedBarcode = checkoutBarcode.trim();

    if (!actorUserId) {
      setError('請先選擇 actor_user_id（館員/管理者）');
      return;
    }
    if (!trimmedBorrower) {
      setError('user_external_id 不可為空');
      return;
    }
    if (!trimmedBarcode) {
      setError('item_barcode 不可為空');
      return;
    }

    setCheckingOut(true);
    try {
      const result = await checkout(params.orgId, {
        actor_user_id: actorUserId,
        user_external_id: trimmedBorrower,
        item_barcode: trimmedBarcode,
      });
      setCheckoutResult(result);
      setSuccess('借出成功');

      // 借出成功後保留 borrowerExternalId（方便連續借書），清空條碼。
      setCheckoutBarcode('');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCheckingOut(false);
    }
  }

  async function onCheckin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCheckoutResult(null);
    setCheckinResult(null);

    const trimmedBarcode = checkinBarcode.trim();

    if (!actorUserId) {
      setError('請先選擇 actor_user_id（館員/管理者）');
      return;
    }
    if (!trimmedBarcode) {
      setError('item_barcode 不可為空');
      return;
    }

    setCheckingIn(true);
    try {
      const result = await checkin(params.orgId, {
        actor_user_id: actorUserId,
        item_barcode: trimmedBarcode,
      });
      setCheckinResult(result);
      setSuccess('歸還成功');
      setCheckinBarcode('');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Circulation</h1>
        <p className="muted">
          對應 API：<code>POST /api/v1/orgs/:orgId/circulation/checkout</code> 與{' '}
          <code>POST /api/v1/orgs/:orgId/circulation/checkin</code>
        </p>

        <p className="muted">
          目前尚未實作登入，因此需要由前端提供 <code>actor_user_id</code> 才能寫入 audit_events。
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
      </section>

      {/* 借出 */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>借出（Checkout）</h2>
        <form onSubmit={onCheckout} className="stack" style={{ marginTop: 12 }}>
          <label>
            user_external_id（借閱者：學號/員編）
            <input
              value={borrowerExternalId}
              onChange={(e) => setBorrowerExternalId(e.target.value)}
              placeholder="例：S1130123"
            />
          </label>

          <label>
            item_barcode（冊條碼）
            <input
              value={checkoutBarcode}
              onChange={(e) => setCheckoutBarcode(e.target.value)}
              placeholder="例：LIB-00001234"
            />
          </label>

          <button type="submit" disabled={checkingOut}>
            {checkingOut ? '借出中…' : '借出'}
          </button>
        </form>

        {checkoutResult ? (
          <div className="muted" style={{ marginTop: 12 }}>
            loan_id={checkoutResult.loan_id} · due_at={checkoutResult.due_at}
          </div>
        ) : null}
      </section>

      {/* 歸還 */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>歸還（Check-in）</h2>
        <form onSubmit={onCheckin} className="stack" style={{ marginTop: 12 }}>
          <label>
            item_barcode（冊條碼）
            <input
              value={checkinBarcode}
              onChange={(e) => setCheckinBarcode(e.target.value)}
              placeholder="例：LIB-00001234"
            />
          </label>

          <button type="submit" disabled={checkingIn}>
            {checkingIn ? '歸還中…' : '歸還'}
          </button>
        </form>

        {checkinResult ? (
          <div className="muted" style={{ marginTop: 12 }}>
            item_status={checkinResult.item_status}
            {checkinResult.hold_id ? ` · hold_id=${checkinResult.hold_id}` : ''}
            {checkinResult.ready_until ? ` · ready_until=${checkinResult.ready_until}` : ''}
          </div>
        ) : null}
      </section>
    </div>
  );
}
