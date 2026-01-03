/**
 * Circulation Page（/orgs/:orgId/circulation）
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/circulation/checkout
 * - POST /api/v1/orgs/:orgId/circulation/checkin
 * - POST /api/v1/orgs/:orgId/holds/:holdId/fulfill（取書借出）
 *
 * 這頁後續會提供：
 * - 借出：user_external_id + item_barcode + actor_user_id
 * - 歸還：item_barcode + actor_user_id
 * - 取書借出：item_barcode → 找到 ready hold → fulfill（actor_user_id）
 *
 * Auth/權限（重要）：
 * - 本頁是 staff 工作台，因此需要先在 `/orgs/:orgId/login` 登入取得 Bearer token
 * - actor_user_id 不再由下拉選單選擇，而是由「登入者本人」推導（session.user.id）
 * - API 端 StaffAuthGuard 也會驗證：request 中的 actor_user_id 必須等於 token.sub（避免冒用）
 */

// 這頁需要表單互動，並且需要讀取 localStorage 的 staff session，因此用 Client Component。
'use client';

import { useState } from 'react';

import Link from 'next/link';

import type { CheckinResult, CheckoutResult, FulfillHoldResult, HoldWithDetails } from '../../../lib/api';
import { checkin, checkout, fulfillHold, listHolds } from '../../../lib/api';
import { Alert } from '../../../components/ui/alert';
import { DataTable } from '../../../components/ui/data-table';
import { Field, Form, FormActions, FormSection } from '../../../components/ui/form';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

export default function CirculationPage({ params }: { params: { orgId: string } }) {
  // Staff session：登入後才允許使用本頁（API 端點已被 StaffAuthGuard 保護）。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：由登入者本人推導（避免 UI 任意選 actor 造成冒用）。
  const actorUserId = session?.user.id ?? '';

  // checkout 表單
  const [borrowerExternalId, setBorrowerExternalId] = useState('');
  const [checkoutBarcode, setCheckoutBarcode] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);

  // checkin 表單
  const [checkinBarcode, setCheckinBarcode] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);

  // fulfill（取書借出 / Ready Hold → Loan）
  // - 現場常見流程：讀者到館，館員從取書架拿到該冊，直接掃描冊條碼完成「取書借出」
  // - 技術上 fulfill 需要 hold_id；因此我們會先用條碼查 ready holds，再執行 fulfill
  const [fulfillBarcode, setFulfillBarcode] = useState('');
  const [findingHold, setFindingHold] = useState(false);
  const [fulfillCandidates, setFulfillCandidates] = useState<HoldWithDetails[] | null>(null);
  const [fulfillingHoldId, setFulfillingHoldId] = useState<string | null>(null);
  const [fulfillResult, setFulfillResult] = useState<FulfillHoldResult | null>(null);

  // 共用訊息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 先做「登入門檻」：
  // - 本頁所有核心 API 都被 StaffAuthGuard 保護
  // - 若未登入就繼續顯示表單，使用者會一直撞 401/403，體驗較差
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Circulation</h1>
          <Alert variant="info" title="載入登入狀態中…" role="status" />
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Circulation</h1>
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能操作。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </section>
      </div>
    );
  }

  async function onCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCheckoutResult(null);
    setCheckinResult(null);
    setFulfillCandidates(null);
    setFulfillResult(null);

    const trimmedBorrower = borrowerExternalId.trim();
    const trimmedBarcode = checkoutBarcode.trim();

    if (!actorUserId) {
      setError('缺少 actor_user_id（請重新登入）');
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
    setFulfillCandidates(null);
    setFulfillResult(null);

    const trimmedBarcode = checkinBarcode.trim();

    if (!actorUserId) {
      setError('缺少 actor_user_id（請重新登入）');
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

  /**
   * 取書借出（掃冊條碼 → 找到 ready hold → fulfill）
   *
   * 設計重點：
   * - 取書架上的冊通常是 `item_copies.status=on_hold`
   * - fulfills 是「以 hold_id 為主鍵」的動作端點
   * - 因此我們用 `GET /holds?status=ready&item_barcode=...` 先找到對應 hold，再呼叫 fulfill
   */
  async function onFulfillByBarcode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCheckoutResult(null);
    setCheckinResult(null);
    setFulfillResult(null);

    const trimmedBarcode = fulfillBarcode.trim();

    if (!actorUserId) {
      setError('缺少 actor_user_id（請重新登入）');
      return;
    }
    if (!trimmedBarcode) {
      setError('item_barcode 不可為空');
      return;
    }

    setFindingHold(true);
    try {
      // 1) 先查「這個冊條碼目前對應到哪一筆 ready hold」
      // - 正常情況應該只會有 1 筆
      // - 若回傳多筆（資料不一致或歷史資料），我們讓館員手動選要 fulfill 哪一筆
      const page = await listHolds(params.orgId, {
        status: 'ready',
        item_barcode: trimmedBarcode,
        limit: 5,
      });
      const candidates = page.items;

      setFulfillCandidates(candidates);

      if (candidates.length === 0) {
        throw new Error(
          `找不到對應的 ready hold（請確認此冊是否在取書架／是否已被取消／是否已過期需要跑 maintenance）`,
        );
      }

      if (candidates.length > 1) {
        setSuccess(`找到 ${candidates.length} 筆 ready holds，請從清單選擇要 fulfill 的那一筆。`);
        return;
      }

      // 2) 若只有一筆：直接 fulfill
      const hold = candidates[0]!;
      setFulfillingHoldId(hold.id);

      const result = await fulfillHold(params.orgId, hold.id, { actor_user_id: actorUserId });
      setFulfillResult(result);
      setSuccess(`取書借出成功：loan_id=${result.loan_id} · due_at=${result.due_at}`);

      // 3) 成功後清掉 UI 狀態，方便下一位讀者
      setFulfillBarcode('');
      setFulfillCandidates(null);
    } catch (e) {
      setFulfillResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setFindingHold(false);
      setFulfillingHoldId(null);
    }
  }

  async function onFulfillHoldId(holdId: string) {
    setError(null);
    setSuccess(null);
    setCheckoutResult(null);
    setCheckinResult(null);
    setFulfillResult(null);

    if (!actorUserId) {
      setError('缺少 actor_user_id（請重新登入）');
      return;
    }

    setFulfillingHoldId(holdId);
    try {
      const result = await fulfillHold(params.orgId, holdId, { actor_user_id: actorUserId });
      setFulfillResult(result);
      setSuccess(`取書借出成功：loan_id=${result.loan_id} · due_at=${result.due_at}`);

      // fulfill 成功後，清掉候選清單（避免重複按）
      setFulfillCandidates(null);
      setFulfillBarcode('');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setFulfillingHoldId(null);
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
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </section>

      {/* 取書借出（Fulfill ready hold） */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>取書借出（Fulfill / 掃冊條碼）</h2>
        <p className="muted">
          現場流程：讀者到館取書 → 館員從取書架拿到該冊 → 掃描冊條碼 → 系統找到對應的 <code>ready hold</code> →{' '}
          執行 <code>fulfill</code>（建立 loan）。
        </p>

        <p className="muted">
          對應 API：<code>GET /api/v1/orgs/:orgId/holds?status=ready&amp;item_barcode=...</code> +{' '}
          <code>POST /api/v1/orgs/:orgId/holds/:holdId/fulfill</code>
        </p>

        <Form onSubmit={onFulfillByBarcode} style={{ marginTop: 12 }}>
          <FormSection title="掃冊條碼" description="先查 ready holds；若命中多筆再由你手動選擇要 fulfill 的那一筆。">
            <Field label="item_barcode（取書冊條碼）" htmlFor="fulfill_item_barcode" hint="例：LIB-00001234">
              <input
                id="fulfill_item_barcode"
                value={fulfillBarcode}
                onChange={(e) => setFulfillBarcode(e.target.value)}
                placeholder="例：LIB-00001234"
                disabled={findingHold || Boolean(fulfillingHoldId)}
              />
            </Field>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={findingHold || Boolean(fulfillingHoldId)}>
                {findingHold ? '查找 ready hold 中…' : fulfillingHoldId ? '取書借出中…' : '取書借出'}
              </button>
            </FormActions>
          </FormSection>
        </Form>

        {fulfillResult ? (
          <Alert variant="info" title="Fulfill 結果" role="status">
            hold_id=<code>{fulfillResult.hold_id}</code> · loan_id=<code>{fulfillResult.loan_id}</code> · due_at=
            <code>{fulfillResult.due_at}</code>
          </Alert>
        ) : null}

        {fulfillCandidates && fulfillCandidates.length > 1 ? (
          <div style={{ marginTop: 12 }}>
            <p className="muted">
              這個條碼對應到多筆 <code>ready</code> holds（不常見，通常代表資料不一致）。請手動選擇要 fulfill 哪一筆：
            </p>

            <DataTable
              rows={fulfillCandidates}
              getRowKey={(r) => r.id}
              columns={[
                {
                  id: 'borrower',
                  header: 'borrower',
                  sortValue: (r) => `${r.user_name} ${r.user_external_id}`,
                  cell: (r) => (
                    <>
                      {r.user_name} <span className="muted">({r.user_external_id})</span>
                    </>
                  ),
                },
                {
                  id: 'title',
                  header: 'title',
                  sortValue: (r) => r.bibliographic_title,
                  cell: (r) => r.bibliographic_title,
                },
                {
                  id: 'ready_until',
                  header: 'ready_until',
                  sortValue: (r) => r.ready_until ?? '',
                  cell: (r) => r.ready_until ?? '—',
                  width: 160,
                },
                {
                  id: 'hold_id',
                  header: 'hold_id',
                  sortValue: (r) => r.id,
                  cell: (r) => <code style={{ fontSize: 12 }}>{r.id}</code>,
                  width: 220,
                },
                {
                  id: 'action',
                  header: 'action',
                  cell: (r) => (
                    <button type="button" className="btnPrimary" onClick={() => void onFulfillHoldId(r.id)} disabled={Boolean(fulfillingHoldId)}>
                      {fulfillingHoldId === r.id ? '取書借出中…' : 'Fulfill'}
                    </button>
                  ),
                  width: 140,
                },
              ]}
            />
          </div>
        ) : null}
      </section>

      {/* 借出 */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>借出（Checkout）</h2>
        <Form onSubmit={onCheckout} style={{ marginTop: 12 }}>
          <FormSection title="掃描借出" description="借出會建立 loan；若此冊有 hold/狀態異常，後端會回傳錯誤。">
            <div className="grid2">
              <Field label="user_external_id（借閱者：學號/員編）" htmlFor="checkout_user_external_id" hint="例：S1130123">
                <input
                  id="checkout_user_external_id"
                  value={borrowerExternalId}
                  onChange={(e) => setBorrowerExternalId(e.target.value)}
                  placeholder="例：S1130123"
                  disabled={checkingOut}
                />
              </Field>

              <Field label="item_barcode（冊條碼）" htmlFor="checkout_item_barcode" hint="例：LIB-00001234">
                <input
                  id="checkout_item_barcode"
                  value={checkoutBarcode}
                  onChange={(e) => setCheckoutBarcode(e.target.value)}
                  placeholder="例：LIB-00001234"
                  disabled={checkingOut}
                />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={checkingOut}>
                {checkingOut ? '借出中…' : '借出'}
              </button>
            </FormActions>
          </FormSection>
        </Form>

        {checkoutResult ? (
          <Alert variant="info" title="Checkout 結果" role="status">
            loan_id=<code>{checkoutResult.loan_id}</code> · due_at=<code>{checkoutResult.due_at}</code>
          </Alert>
        ) : null}
      </section>

      {/* 歸還 */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>歸還（Check-in）</h2>
        <Form onSubmit={onCheckin} style={{ marginTop: 12 }}>
          <FormSection title="掃描歸還" description="歸還後可能自動指派 hold（變成 ready/on_hold），並更新 item status。">
            <Field label="item_barcode（冊條碼）" htmlFor="checkin_item_barcode" hint="例：LIB-00001234">
              <input
                id="checkin_item_barcode"
                value={checkinBarcode}
                onChange={(e) => setCheckinBarcode(e.target.value)}
                placeholder="例：LIB-00001234"
                disabled={checkingIn}
              />
            </Field>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={checkingIn}>
                {checkingIn ? '歸還中…' : '歸還'}
              </button>
            </FormActions>
          </FormSection>
        </Form>

        {checkinResult ? (
          <Alert variant="info" title="Check-in 結果" role="status">
            item_status=<code>{checkinResult.item_status}</code>
            {checkinResult.hold_id ? (
              <>
                {' '}
                · hold_id=<code>{checkinResult.hold_id}</code>
              </>
            ) : null}
            {checkinResult.ready_until ? (
              <>
                {' '}
                · ready_until=<code>{checkinResult.ready_until}</code>
              </>
            ) : null}
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
