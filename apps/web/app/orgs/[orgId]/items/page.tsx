/**
 * Items Page（/orgs/:orgId/items）
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/items?barcode=&status=&location_id=&bibliographic_id=
 *
 * 這頁後續會提供：
 * - 以條碼/狀態/位置/書目篩選冊
 * - 進入 item 詳細頁（/orgs/:orgId/items/:itemId）更新狀態/位置/備註
 */

// 需要篩選表單與動態載入，因此用 Client Component。
'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { ItemCopy, ItemStatus } from '../../../lib/api';
import { listItems } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

export default function ItemsPage({ params }: { params: { orgId: string } }) {
  // staff session：items 端點受 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  const [items, setItems] = useState<ItemCopy[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 篩選條件（對應 API query params）。
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<ItemStatus | ''>('');
  const [locationId, setLocationId] = useState('');
  const [bibliographicId, setBibliographicId] = useState('');

  async function refresh(filters?: {
    barcode?: string;
    status?: string;
    location_id?: string;
    bibliographic_id?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const result = await listItems(params.orgId, filters ?? {});
      setItems(result);
    } catch (e) {
      setItems(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // 初次載入：列出最新 200 筆。
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  async function onFilter(e: React.FormEvent) {
    e.preventDefault();
    await refresh({
      barcode: barcode.trim() || undefined,
      status: status || undefined,
      location_id: locationId.trim() || undefined,
      bibliographic_id: bibliographicId.trim() || undefined,
    });
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Items</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Items</h1>
          <p className="error">
            這頁需要 staff 登入才能查詢 items。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Items</h1>
        <p className="muted">
          對應 API：<code>GET /api/v1/orgs/:orgId/items</code>（支援 barcode/status/location_id/bibliographic_id 篩選）
        </p>

        <form onSubmit={onFilter} className="stack" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <label>
              barcode（模糊）
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="例：LIB-" />
            </label>

            <label>
              status
              <select value={status} onChange={(e) => setStatus(e.target.value as ItemStatus | '')}>
                <option value="">（不指定）</option>
                <option value="available">available</option>
                <option value="checked_out">checked_out</option>
                <option value="on_hold">on_hold</option>
                <option value="lost">lost</option>
                <option value="withdrawn">withdrawn</option>
                <option value="repair">repair</option>
              </select>
            </label>

            <label>
              location_id（UUID）
              <input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="例：..." />
            </label>
          </div>

          <label>
            bibliographic_id（UUID）
            <input value={bibliographicId} onChange={(e) => setBibliographicId(e.target.value)} placeholder="例：..." />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loading}>
              {loading ? '查詢中…' : '篩選'}
            </button>
            <button
              type="button"
              onClick={() => {
                setBarcode('');
                setStatus('');
                setLocationId('');
                setBibliographicId('');
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
        {!loading && items && items.length === 0 ? <p className="muted">沒有符合條件的 items。</p> : null}

        {!loading && items && items.length > 0 ? (
          <ul>
            {items.map((i) => (
              <li key={i.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <div>
                    <Link href={`/orgs/${params.orgId}/items/${i.id}`}>{i.barcode}</Link>{' '}
                    <span className="muted">({i.status})</span>
                  </div>
                  <div className="muted">call_number={i.call_number}</div>
                  <div className="muted">location_id={i.location_id}</div>
                  <div className="muted">bibliographic_id={i.bibliographic_id}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
