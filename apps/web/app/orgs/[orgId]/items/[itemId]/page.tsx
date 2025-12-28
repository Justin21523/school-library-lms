/**
 * Item Detail Page（/orgs/:orgId/items/:itemId）
 *
 * 對應 API：
 * - GET   /api/v1/orgs/:orgId/items/:itemId
 * - PATCH /api/v1/orgs/:orgId/items/:itemId
 * - POST  /api/v1/orgs/:orgId/items/:itemId/mark-lost
 * - POST  /api/v1/orgs/:orgId/items/:itemId/mark-repair
 * - POST  /api/v1/orgs/:orgId/items/:itemId/mark-withdrawn
 *
 * 這頁後續會提供：
 * - 查看冊資訊（條碼、索書號、狀態、位置）
 * - 更新冊（改 location、補 notes 等主檔欄位）
 * - 冊異常狀態（lost/repair/withdrawn）：走 action endpoints + 寫 audit_events（可追溯）
 *
 * Auth/權限（重要）：
 * - items 相關端點屬於 staff 後台操作，受 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id（寫 audit 用）由登入者本人推導（session.user.id），不再提供下拉選擇（避免冒用）
 */

// 需要抓資料與更新表單，因此用 Client Component。
'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { ItemCopy, ItemDetail, Location } from '../../../../lib/api';
import {
  getItem,
  listLocations,
  markItemLost,
  markItemRepair,
  markItemWithdrawn,
  updateItem,
} from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

export default function ItemDetailPage({
  params,
}: {
  params: { orgId: string; itemId: string };
}) {
  // staff session：items 端點受 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：由登入者本人推導（用於冊異常狀態動作，寫入 audit_events）
  const actorUserId = session?.user.id ?? '';

  const [item, setItem] = useState<ItemCopy | null>(null);
  const [currentLoan, setCurrentLoan] = useState<ItemDetail['current_loan']>(null);
  const [assignedHold, setAssignedHold] = useState<ItemDetail['assigned_hold']>(null);
  const [locations, setLocations] = useState<Location[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ------ 更新表單（checkbox + payload）------
  const [updateBarcode, setUpdateBarcode] = useState(false);
  const [barcode, setBarcode] = useState('');

  const [updateCallNumber, setUpdateCallNumber] = useState(false);
  const [callNumber, setCallNumber] = useState('');

  const [updateLocationId, setUpdateLocationId] = useState(false);
  const [locationId, setLocationId] = useState('');

  const [updateNotes, setUpdateNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const [updateAcquiredAt, setUpdateAcquiredAt] = useState(false);
  const [acquiredAt, setAcquiredAt] = useState('');

  const [updateLastInventoryAt, setUpdateLastInventoryAt] = useState(false);
  const [lastInventoryAt, setLastInventoryAt] = useState('');

  const [updating, setUpdating] = useState(false);

  // ------ 冊異常狀態（lost/repair/withdrawn）------
  const [actionNote, setActionNote] = useState('');
  const [marking, setMarking] = useState<'lost' | 'repair' | 'withdrawn' | null>(null);

  const locationOptions = useMemo(() => locations ?? [], [locations]);
  const assignedHoldPickupLocation = useMemo(() => {
    if (!assignedHold || !locations) return null;
    return locations.find((l) => l.id === assignedHold.pickup_location_id) ?? null;
  }, [assignedHold, locations]);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [itemResult, locationsResult] = await Promise.all([
        getItem(params.orgId, params.itemId),
        listLocations(params.orgId),
      ]);

      setItem(itemResult.item);
      setCurrentLoan(itemResult.current_loan);
      setAssignedHold(itemResult.assigned_hold);
      setLocations(locationsResult);
    } catch (e) {
      setItem(null);
      setCurrentLoan(null);
      setAssignedHold(null);
      setLocations(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !session) return;
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, params.itemId, sessionReady, session]);

  // item 載入後，把目前值塞進表單（但不自動勾選更新）。
  useEffect(() => {
    if (!item) return;
    setBarcode(item.barcode);
    setCallNumber(item.call_number);
    setLocationId(item.location_id);
    setNotes(item.notes ?? '');
    setAcquiredAt(item.acquired_at ?? '');
    setLastInventoryAt(item.last_inventory_at ?? '');
  }, [item]);

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();

    const payload: {
      barcode?: string;
      call_number?: string;
      location_id?: string;
      notes?: string | null;
      acquired_at?: string | null;
      last_inventory_at?: string | null;
    } = {};

    if (updateBarcode) {
      const trimmed = barcode.trim();
      if (!trimmed) {
        setError('barcode 不可為空（若不想改 barcode，請取消勾選）');
        return;
      }
      payload.barcode = trimmed;
    }

    if (updateCallNumber) {
      const trimmed = callNumber.trim();
      if (!trimmed) {
        setError('call_number 不可為空（若不想改 call_number，請取消勾選）');
        return;
      }
      payload.call_number = trimmed;
    }

    if (updateLocationId) {
      if (!locationId) {
        setError('請選擇 location（或取消勾選 location_id）');
        return;
      }
      payload.location_id = locationId;
    }

    // notes/acquired_at/last_inventory_at：schema 允許 nullable；空字串視為 null。
    if (updateNotes) payload.notes = notes.trim() ? notes.trim() : null;
    if (updateAcquiredAt) payload.acquired_at = acquiredAt.trim() ? acquiredAt.trim() : null;
    if (updateLastInventoryAt)
      payload.last_inventory_at = lastInventoryAt.trim() ? lastInventoryAt.trim() : null;

    if (Object.keys(payload).length === 0) {
      setError('請至少勾選一個要更新的欄位');
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      await updateItem(params.orgId, params.itemId, payload);
      setSuccess('已更新冊');
      await refreshAll();

      // 更新成功後取消勾選，避免下一次誤送。
      setUpdateBarcode(false);
      setUpdateCallNumber(false);
      setUpdateLocationId(false);
      setUpdateNotes(false);
      setUpdateAcquiredAt(false);
      setUpdateLastInventoryAt(false);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  }

  // ----------------------------
  // 冊異常狀態：快捷按鈕（寫 audit_events）
  // ----------------------------

  async function runStatusAction(
    action: 'lost' | 'repair' | 'withdrawn',
    fn: () => Promise<void>,
  ) {
    setError(null);
    setSuccess(null);

    // 這些動作必須帶 actor_user_id（館員/管理者），後端才允許並寫 audit
    if (!actorUserId) {
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    // withdrawn（報廢）通常是不可逆；前端做一次確認，降低誤點風險
    if (action === 'withdrawn') {
      const ok = window.confirm(
        '確認要把此冊標記為 withdrawn（報廢/下架）嗎？此動作會影響流通與報表，通常不可逆。',
      );
      if (!ok) return;
    }

    setMarking(action);
    try {
      await fn();
      await refreshAll();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setMarking(null);
    }
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Item Detail</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Item Detail</h1>
          <p className="error">
            這頁需要 staff 登入才能查看/操作 item。請先前往{' '}
            <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Item Detail</h1>
        <p className="muted">
          對應 API：<code>GET/PATCH /api/v1/orgs/:orgId/items/:itemId</code>
        </p>

        <div className="muted" style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <div>
            orgId：<code>{params.orgId}</code>
          </div>
          <div>
            itemId：<code>{params.itemId}</code>
          </div>
        </div>

        {loading ? <p className="muted">載入中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        {item ? (
          <div className="stack" style={{ marginTop: 16 }}>
            <div>
              <div className="muted">barcode</div>
              <div style={{ fontWeight: 700 }}>{item.barcode}</div>
            </div>

            <div className="muted">
              status={item.status} · call_number={item.call_number}
            </div>

            <div className="muted">
              bibliographic_id：{' '}
              <Link href={`/orgs/${params.orgId}/bibs/${item.bibliographic_id}`}>{item.bibliographic_id}</Link>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0' }} />

            <div>
              <div className="muted">組合狀態（Item + Circulation）</div>

              {currentLoan ? (
                <div className="muted" style={{ marginTop: 6 }}>
                  open loan：borrower={currentLoan.user_name} · external_id={currentLoan.user_external_id} · due_at=
                  {currentLoan.due_at}
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 6 }}>
                  open loan：無
                </div>
              )}

              {assignedHold ? (
                <div className="muted" style={{ marginTop: 6 }}>
                  assigned ready hold：user={assignedHold.user_name} · external_id={assignedHold.user_external_id}
                  {assignedHold.ready_until ? ` · ready_until=${assignedHold.ready_until}` : ''}
                  {assignedHoldPickupLocation
                    ? ` · pickup=${assignedHoldPickupLocation.code} · ${assignedHoldPickupLocation.name}`
                    : ` · pickup_location_id=${assignedHold.pickup_location_id}`}
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 6 }}>
                  assigned ready hold：無
                </div>
              )}

              {/* 基本一致性提示：幫助你在 scale seed/測試時快速看出狀態不一致 */}
              {currentLoan && item.status !== 'checked_out' ? (
                <div className="error" style={{ marginTop: 8 }}>
                  注意：存在 open loan，但 item.status 不是 checked_out（可能有資料不一致）
                </div>
              ) : null}
              {assignedHold && item.status !== 'on_hold' ? (
                <div className="error" style={{ marginTop: 8 }}>
                  注意：存在 assigned ready hold，但 item.status 不是 on_hold（可能有資料不一致）
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>冊異常狀態（US-045）</h2>
        <p className="muted">
          這些動作會呼叫 item status action endpoints，並寫入 <code>audit_events</code>，可到{' '}
          <code>/orgs/:orgId/audit-events</code> 追溯誰改的。
        </p>

        <p className="muted">
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

        <label>
          note（選填：寫入 audit metadata）
          <input
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="例：盤點找不到、封面破損送修、淘汰報廢"
          />
        </label>

        {item ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              type="button"
              onClick={() =>
                void runStatusAction('lost', async () => {
                  await markItemLost(params.orgId, params.itemId, {
                    actor_user_id: actorUserId,
                    note: actionNote.trim() || undefined,
                  });
                  setSuccess('已標記為 lost');
                })
              }
              disabled={
                !actorUserId ||
                marking !== null ||
                !(item.status === 'available' || item.status === 'checked_out')
              }
            >
              {marking === 'lost' ? '標記中…' : '標記遺失（lost）'}
            </button>

            <button
              type="button"
              onClick={() =>
                void runStatusAction('repair', async () => {
                  await markItemRepair(params.orgId, params.itemId, {
                    actor_user_id: actorUserId,
                    note: actionNote.trim() || undefined,
                  });
                  setSuccess('已標記為 repair');
                })
              }
              disabled={!actorUserId || marking !== null || item.status !== 'available'}
            >
              {marking === 'repair' ? '標記中…' : '標記修復（repair）'}
            </button>

            <button
              type="button"
              onClick={() =>
                void runStatusAction('withdrawn', async () => {
                  await markItemWithdrawn(params.orgId, params.itemId, {
                    actor_user_id: actorUserId,
                    note: actionNote.trim() || undefined,
                  });
                  setSuccess('已標記為 withdrawn');
                })
              }
              disabled={
                !actorUserId ||
                marking !== null ||
                !(item.status === 'available' || item.status === 'repair' || item.status === 'lost')
              }
            >
              {marking === 'withdrawn' ? '標記中…' : '標記報廢（withdrawn）'}
            </button>
          </div>
        ) : null}

        {item ? (
          <p className="muted" style={{ marginTop: 12 }}>
            目前狀態：<code>{item.status}</code>。若按鈕被停用，代表前端已先做基本防呆；更完整規則仍以後端為準。
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>更新冊（PATCH）</h2>
        <p className="muted">
          勾選欄位 → 只送出勾選的欄位（部分更新）。冊狀態（lost/repair/withdrawn）請用上方「冊異常狀態」按鈕。
        </p>

        <form onSubmit={onUpdate} className="stack" style={{ marginTop: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={updateBarcode}
              onChange={(e) => setUpdateBarcode(e.target.checked)}
            />{' '}
            更新 barcode
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={!updateBarcode} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateCallNumber}
              onChange={(e) => setUpdateCallNumber(e.target.checked)}
            />{' '}
            更新 call_number
            <input value={callNumber} onChange={(e) => setCallNumber(e.target.value)} disabled={!updateCallNumber} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateLocationId}
              onChange={(e) => setUpdateLocationId(e.target.checked)}
            />{' '}
            更新 location_id
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!updateLocationId}>
              <option value="">（請選擇）</option>
              {locationOptions.map((loc) => (
                <option key={loc.id} value={loc.id} disabled={loc.status !== 'active'}>
                  {loc.name} ({loc.code}){loc.status !== 'active' ? '（inactive）' : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            <input type="checkbox" checked={updateNotes} onChange={(e) => setUpdateNotes(e.target.checked)} /> 更新 notes
            （留空代表清空）
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!updateNotes} rows={3} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateAcquiredAt}
              onChange={(e) => setUpdateAcquiredAt(e.target.checked)}
            />{' '}
            更新 acquired_at（ISO 8601；留空代表清空）
            <input
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
              disabled={!updateAcquiredAt}
              placeholder="例：2025-12-24T12:34:56.000Z"
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateLastInventoryAt}
              onChange={(e) => setUpdateLastInventoryAt(e.target.checked)}
            />{' '}
            更新 last_inventory_at（ISO 8601；留空代表清空）
            <input
              value={lastInventoryAt}
              onChange={(e) => setLastInventoryAt(e.target.value)}
              disabled={!updateLastInventoryAt}
              placeholder="例：2025-12-24T12:34:56.000Z"
            />
          </label>

          <button type="submit" disabled={updating}>
            {updating ? '更新中…' : '送出 PATCH'}
          </button>
        </form>
      </section>
    </div>
  );
}
