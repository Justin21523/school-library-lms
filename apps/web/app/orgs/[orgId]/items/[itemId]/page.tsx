/**
 * Item Detail Page（/orgs/:orgId/items/:itemId）
 *
 * 對應 API：
 * - GET   /api/v1/orgs/:orgId/items/:itemId
 * - PATCH /api/v1/orgs/:orgId/items/:itemId
 *
 * 這頁後續會提供：
 * - 查看冊資訊（條碼、索書號、狀態、位置）
 * - 更新冊（例如標記 lost/repair、改 location、補 notes）
 */

// 需要抓資料與更新表單，因此用 Client Component。
'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { ItemCopy, ItemStatus, Location } from '../../../../lib/api';
import { getItem, listLocations, updateItem } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';

export default function ItemDetailPage({
  params,
}: {
  params: { orgId: string; itemId: string };
}) {
  const [item, setItem] = useState<ItemCopy | null>(null);
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

  const [updateStatus, setUpdateStatus] = useState(false);
  const [status, setStatus] = useState<ItemStatus>('available');

  const [updateNotes, setUpdateNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const [updateAcquiredAt, setUpdateAcquiredAt] = useState(false);
  const [acquiredAt, setAcquiredAt] = useState('');

  const [updateLastInventoryAt, setUpdateLastInventoryAt] = useState(false);
  const [lastInventoryAt, setLastInventoryAt] = useState('');

  const [updating, setUpdating] = useState(false);

  const locationOptions = useMemo(() => locations ?? [], [locations]);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [itemResult, locationsResult] = await Promise.all([
        getItem(params.orgId, params.itemId),
        listLocations(params.orgId),
      ]);

      setItem(itemResult);
      setLocations(locationsResult);
    } catch (e) {
      setItem(null);
      setLocations(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, params.itemId]);

  // item 載入後，把目前值塞進表單（但不自動勾選更新）。
  useEffect(() => {
    if (!item) return;
    setBarcode(item.barcode);
    setCallNumber(item.call_number);
    setLocationId(item.location_id);
    setStatus(item.status);
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
      status?: ItemStatus;
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

    if (updateStatus) payload.status = status;

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
      setUpdateStatus(false);
      setUpdateNotes(false);
      setUpdateAcquiredAt(false);
      setUpdateLastInventoryAt(false);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdating(false);
    }
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
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>更新冊（PATCH）</h2>
        <p className="muted">勾選欄位 → 只送出勾選的欄位（部分更新）。</p>

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
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </label>

          <label>
            <input type="checkbox" checked={updateStatus} onChange={(e) => setUpdateStatus(e.target.checked)} /> 更新
            status
            <select value={status} onChange={(e) => setStatus(e.target.value as ItemStatus)} disabled={!updateStatus}>
              <option value="available">available</option>
              <option value="checked_out">checked_out</option>
              <option value="on_hold">on_hold</option>
              <option value="lost">lost</option>
              <option value="withdrawn">withdrawn</option>
              <option value="repair">repair</option>
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
