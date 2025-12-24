/**
 * Holds Page（/orgs/:orgId/holds）
 *
 * 這頁是「館員後台（Web Console）」的 holds 工作台：
 * - 查詢：依 status / user_external_id / item_barcode / bibliographic_id / pickup_location_id 過濾
 * - 建立：替讀者建立預約（place hold）
 * - 取消：取消 queued/ready hold（若取消 ready，後端會釋放或轉讓冊）
 * - fulfill：讀者到館取書時，將 ready hold 轉成實際借出（建立 loan）
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/holds
 * - POST /api/v1/orgs/:orgId/holds
 * - POST /api/v1/orgs/:orgId/holds/:holdId/cancel
 * - POST /api/v1/orgs/:orgId/holds/:holdId/fulfill
 *
 * 重要：MVP 尚未做登入（auth）
 * - 我們用 actor_user_id 代表「誰在操作」（admin/librarian）
 * - 這樣 API 才能寫 audit_events，並在資料上保留最小可追溯性
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { FulfillHoldResult, HoldStatus, HoldWithDetails, Location, User } from '../../../lib/api';
import {
  cancelHold,
  createHold,
  fulfillHold,
  listHolds,
  listLocations,
  listUsers,
} from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';

// MVP 的「可操作 RBAC」：館員操作的 actor 只能是 admin/librarian，且必須是 active。
function isActorCandidate(user: User) {
  return user.status === 'active' && (user.role === 'admin' || user.role === 'librarian');
}

// location 也可能被停用；在「取書地點」下拉選單中，預設只顯示 active。
function isActiveLocation(location: Location) {
  return location.status === 'active';
}

export default function HoldsPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) actor（操作者）選擇
  // ----------------------------

  // users：抓 org 下所有 users，讓館員在 UI 選擇 actor_user_id。
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // actorUserId：目前選到的操作者（會送到 API，寫入 audit_events）。
  const [actorUserId, setActorUserId] = useState('');

  // actorCandidates：過濾出可用的館員/管理者。
  const actorCandidates = useMemo(() => (users ?? []).filter(isActorCandidate), [users]);

  // ----------------------------
  // 2) locations（取書地點）資料
  // ----------------------------

  const [locations, setLocations] = useState<Location[] | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // activeLocations：供 UI 選單使用；避免選到 inactive location。
  const activeLocations = useMemo(() => (locations ?? []).filter(isActiveLocation), [locations]);

  // ----------------------------
  // 3) holds 查詢（filters + list）
  // ----------------------------

  const [holds, setHolds] = useState<HoldWithDetails[] | null>(null);
  const [loadingHolds, setLoadingHolds] = useState(false);

  // filters（對應 API query params）
  const [status, setStatus] = useState<HoldStatus | 'all'>('ready');
  const [userExternalId, setUserExternalId] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [bibliographicId, setBibliographicId] = useState('');
  const [pickupLocationId, setPickupLocationId] = useState('');
  const [limit, setLimit] = useState('200');

  // ----------------------------
  // 4) 建立 hold 表單
  // ----------------------------

  const [createBorrowerExternalId, setCreateBorrowerExternalId] = useState('');
  const [createBibliographicId, setCreateBibliographicId] = useState('');
  const [createPickupLocationId, setCreatePickupLocationId] = useState('');

  const [creating, setCreating] = useState(false);

  // ----------------------------
  // 5) 動作狀態（避免重複點擊）
  // ----------------------------

  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);
  const [fulfillingHoldId, setFulfillingHoldId] = useState<string | null>(null);

  // ----------------------------
  // 6) 共用訊息（成功/錯誤/最近一次 fulfill 結果）
  // ----------------------------

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastFulfillResult, setLastFulfillResult] = useState<FulfillHoldResult | null>(null);

  // ----------------------------
  // 7) 初次載入：users + locations
  // ----------------------------

  useEffect(() => {
    async function run() {
      setLoadingUsers(true);
      setLoadingLocations(true);
      setError(null);

      try {
        // 並行抓取：users（選 actor）+ locations（選取書地點）
        const [usersResult, locationsResult] = await Promise.all([
          listUsers(params.orgId),
          listLocations(params.orgId),
        ]);

        setUsers(usersResult);
        setLocations(locationsResult);

        // 若尚未選 actor，就預設選第一個可用館員（提升可用性）。
        if (!actorUserId) {
          const firstActor = usersResult.find(isActorCandidate);
          if (firstActor) setActorUserId(firstActor.id);
        }

        // 建立 hold 的取書地點：若尚未選，就預設第一個 active location。
        if (!createPickupLocationId) {
          const firstLocation = locationsResult.find(isActiveLocation);
          if (firstLocation) setCreatePickupLocationId(firstLocation.id);
        }
      } catch (e) {
        setUsers(null);
        setLocations(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoadingUsers(false);
        setLoadingLocations(false);
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  // ----------------------------
  // 8) 查詢：抽成 refreshHolds，讓「初次載入 / 搜尋 / 動作後刷新」重用
  // ----------------------------

  async function refreshHolds(
    overrides?: Partial<{
      status: HoldStatus | 'all';
      userExternalId: string;
      itemBarcode: string;
      bibliographicId: string;
      pickupLocationId: string;
      limit: string;
    }>,
  ) {
    setLoadingHolds(true);
    setError(null);
    setSuccess(null);

    try {
      // 允許呼叫端用 overrides 暫時覆蓋 filters：
      // - 典型情境：按下「清除」時，setState 尚未生效，但我們希望用預設條件立即刷新
      const effectiveStatus = overrides?.status ?? status;
      const effectiveUserExternalId = overrides?.userExternalId ?? userExternalId;
      const effectiveItemBarcode = overrides?.itemBarcode ?? itemBarcode;
      const effectiveBibliographicId = overrides?.bibliographicId ?? bibliographicId;
      const effectivePickupLocationId = overrides?.pickupLocationId ?? pickupLocationId;
      const effectiveLimit = overrides?.limit ?? limit;

      // limit：空字串視為未提供；否則轉 int。
      const trimmedLimit = effectiveLimit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const result = await listHolds(params.orgId, {
        status: effectiveStatus,
        user_external_id: effectiveUserExternalId.trim() || undefined,
        item_barcode: effectiveItemBarcode.trim() || undefined,
        bibliographic_id: effectiveBibliographicId.trim() || undefined,
        pickup_location_id: effectivePickupLocationId.trim() || undefined,
        limit: limitNumber,
      });

      setHolds(result);
    } catch (e) {
      setHolds(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingHolds(false);
    }
  }

  // 初次載入：先列出 ready holds（最常需要處理的：取書借出）。
  useEffect(() => {
    void refreshHolds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refreshHolds();
  }

  function onClear() {
    // 清除 filters：回到預設（ready + limit=200）
    setStatus('ready');
    setUserExternalId('');
    setItemBarcode('');
    setBibliographicId('');
    setPickupLocationId('');
    setLimit('200');

    // 清除後立即刷新：用 overrides 避免「setState 尚未套用」導致 query 仍用舊條件。
    void refreshHolds({
      status: 'ready',
      userExternalId: '',
      itemBarcode: '',
      bibliographicId: '',
      pickupLocationId: '',
      limit: '200',
    });
  }

  // ----------------------------
  // 9) 建立 hold
  // ----------------------------

  async function onCreateHold(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSuccess(null);
    setLastFulfillResult(null);

    // Web Console：建立 hold 需要 actor_user_id（館員/管理者）
    if (!actorUserId) {
      setError('請先選擇 actor_user_id（館員/管理者）');
      return;
    }

    const borrower = createBorrowerExternalId.trim();
    const bibId = createBibliographicId.trim();
    const pickupId = createPickupLocationId.trim();

    if (!borrower) {
      setError('user_external_id 不可為空');
      return;
    }
    if (!bibId) {
      setError('bibliographic_id 不可為空');
      return;
    }
    if (!pickupId) {
      setError('pickup_location_id 不可為空');
      return;
    }

    setCreating(true);
    try {
      const result = await createHold(params.orgId, {
        actor_user_id: actorUserId,
        user_external_id: borrower,
        bibliographic_id: bibId,
        pickup_location_id: pickupId,
      });

      // 建立成功：顯示一則訊息，並刷新列表（因為可能立即變 ready）。
      setSuccess(`已建立 hold：${result.id}（status=${result.status}）`);

      // 讓館員可以連續替同一個 borrower 建立多本：保留 borrowerExternalId，清空 bibliographic_id。
      setCreateBibliographicId('');
      await refreshHolds();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  // ----------------------------
  // 10) 取消 hold（queued/ready）
  // ----------------------------

  async function onCancelHold(holdId: string) {
    setError(null);
    setSuccess(null);
    setLastFulfillResult(null);

    if (!actorUserId) {
      setError('請先選擇 actor_user_id（館員/管理者）');
      return;
    }

    setCancellingHoldId(holdId);
    try {
      const result = await cancelHold(params.orgId, holdId, { actor_user_id: actorUserId });
      setSuccess(`已取消 hold：${result.id}（status=${result.status}）`);
      await refreshHolds();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCancellingHoldId(null);
    }
  }

  // ----------------------------
  // 11) fulfill（取書借出）
  // ----------------------------

  async function onFulfillHold(holdId: string) {
    setError(null);
    setSuccess(null);
    setLastFulfillResult(null);

    if (!actorUserId) {
      setError('請先選擇 actor_user_id（館員/管理者）');
      return;
    }

    setFulfillingHoldId(holdId);
    try {
      const result = await fulfillHold(params.orgId, holdId, { actor_user_id: actorUserId });
      setLastFulfillResult(result);
      setSuccess(`已完成取書借出：loan_id=${result.loan_id}`);
      await refreshHolds();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setFulfillingHoldId(null);
    }
  }

  return (
    <div className="stack">
      {/* ---------------------------- */}
      {/* Header / actor */}
      {/* ---------------------------- */}
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Holds</h1>

        <p className="muted">
          對應 API：<code>/api/v1/orgs/:orgId/holds</code>（list/create/cancel/fulfill）
        </p>

        <p className="muted">
          MVP 尚未實作登入，因此需要由前端提供 <code>actor_user_id</code> 才能寫入 audit_events。
        </p>

        <label>
          actor_user_id（操作者：admin/librarian）
          <select
            value={actorUserId}
            onChange={(e) => setActorUserId(e.target.value)}
            disabled={loadingUsers}
          >
            <option value="">（請選擇）</option>
            {actorCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role}) · {u.external_id}
              </option>
            ))}
          </select>
        </label>

        {loadingUsers ? <p className="muted">載入可用操作者中…</p> : null}
        {loadingLocations ? <p className="muted">載入 locations 中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
        {lastFulfillResult ? (
          <p className="muted">
            fulfill 結果：hold_id={lastFulfillResult.hold_id} · loan_id={lastFulfillResult.loan_id} · due_at=
            {lastFulfillResult.due_at}
          </p>
        ) : null}
      </section>

      {/* ---------------------------- */}
      {/* Search */}
      {/* ---------------------------- */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>查詢</h2>

        <form onSubmit={onSearch} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              status
              <select value={status} onChange={(e) => setStatus(e.target.value as HoldStatus | 'all')}>
                <option value="ready">ready（可取書）</option>
                <option value="queued">queued（排隊中）</option>
                <option value="fulfilled">fulfilled（已取書借出）</option>
                <option value="cancelled">cancelled（已取消）</option>
                <option value="expired">expired（已逾期）</option>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              bibliographic_id（UUID，精確）
              <input
                value={bibliographicId}
                onChange={(e) => setBibliographicId(e.target.value)}
                placeholder="例：b_..."
              />
            </label>

            <label>
              pickup_location_id（精確）
              <select
                value={pickupLocationId}
                onChange={(e) => setPickupLocationId(e.target.value)}
                disabled={!locations}
              >
                <option value="">（不過濾）</option>
                {activeLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              limit（預設 200）
              <input value={limit} onChange={(e) => setLimit(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loadingHolds}>
              {loadingHolds ? '查詢中…' : '查詢'}
            </button>
            <button type="button" onClick={onClear} disabled={loadingHolds}>
              清除
            </button>
          </div>
        </form>
      </section>

      {/* ---------------------------- */}
      {/* Create */}
      {/* ---------------------------- */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>建立預約（Place hold）</h2>

        <p className="muted">
          提示：如果你還不知道 <code>bibliographic_id</code>，可以先到{' '}
          <Link href={`/orgs/${params.orgId}/bibs`}>Bibs</Link> 查詢後複製 UUID。
        </p>

        <form onSubmit={onCreateHold} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              user_external_id（借閱者：學號/員編）
              <input
                value={createBorrowerExternalId}
                onChange={(e) => setCreateBorrowerExternalId(e.target.value)}
                placeholder="例：S1130123"
              />
            </label>

            <label>
              bibliographic_id（書目 UUID）
              <input
                value={createBibliographicId}
                onChange={(e) => setCreateBibliographicId(e.target.value)}
                placeholder="例：b_..."
              />
            </label>

            <label>
              pickup_location_id（取書地點）
              <select
                value={createPickupLocationId}
                onChange={(e) => setCreatePickupLocationId(e.target.value)}
                disabled={!locations}
              >
                <option value="">（請選擇）</option>
                {activeLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="submit" disabled={creating}>
            {creating ? '建立中…' : '建立 Hold'}
          </button>
        </form>
      </section>

      {/* ---------------------------- */}
      {/* Results */}
      {/* ---------------------------- */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>

        {loadingHolds ? <p className="muted">載入中…</p> : null}
        {!loadingHolds && holds && holds.length === 0 ? <p className="muted">沒有符合條件的 holds。</p> : null}

        {!loadingHolds && holds && holds.length > 0 ? (
          <ul>
            {holds.map((h) => (
              <li key={h.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div>
                    <Link href={`/orgs/${params.orgId}/bibs/${h.bibliographic_id}`}>
                      <span style={{ fontWeight: 700 }}>{h.bibliographic_title}</span>
                    </Link>{' '}
                    <span className="muted">({h.status})</span>
                  </div>

                  <div className="muted">
                    borrower：{h.user_name} · external_id={h.user_external_id} · role={h.user_role}
                  </div>

                  <div className="muted">
                    pickup：{h.pickup_location_code} · {h.pickup_location_name}
                  </div>

                  <div className="muted">
                    assigned_item：
                    {h.assigned_item_id ? (
                      <>
                        {' '}
                        <Link href={`/orgs/${params.orgId}/items/${h.assigned_item_id}`}>
                          {h.assigned_item_barcode ?? h.assigned_item_id}
                        </Link>{' '}
                        · status={h.assigned_item_status ?? 'null'}
                      </>
                    ) : (
                      '（尚未指派）'
                    )}
                  </div>

                  <div className="muted">
                    placed_at={h.placed_at}
                    {h.ready_until ? ` · ready_until=${h.ready_until}` : ''}
                    {h.cancelled_at ? ` · cancelled_at=${h.cancelled_at}` : ''}
                    {h.fulfilled_at ? ` · fulfilled_at=${h.fulfilled_at}` : ''}
                  </div>

                  <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    hold_id={h.id}
                  </div>

                  {/* 動作按鈕：只對 queued/ready 顯示 cancel；只對 ready 顯示 fulfill */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {h.status === 'queued' || h.status === 'ready' ? (
                      <button
                        type="button"
                        onClick={() => void onCancelHold(h.id)}
                        disabled={cancellingHoldId === h.id || fulfillingHoldId === h.id}
                      >
                        {cancellingHoldId === h.id ? '取消中…' : '取消'}
                      </button>
                    ) : null}

                    {h.status === 'ready' ? (
                      <button
                        type="button"
                        onClick={() => void onFulfillHold(h.id)}
                        disabled={fulfillingHoldId === h.id || cancellingHoldId === h.id}
                      >
                        {fulfillingHoldId === h.id ? '取書借出中…' : '取書借出（fulfill）'}
                      </button>
                    ) : null}
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
