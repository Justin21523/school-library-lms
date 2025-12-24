/**
 * OPAC：我的預約（/opac/orgs/:orgId/holds）
 *
 * 讀者在這裡可以：
 * - 以 user_external_id 查詢自己的 holds
 * - 取消 queued/ready holds
 *
 * MVP 限制（重要）：
 * - 目前沒有登入；因此任何人只要知道 external_id，就能查/取消
 * - 這是「可用但不安全」的暫時方案，之後需要改成 auth（token/SSO）
 */

'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { HoldStatus, HoldWithDetails } from '../../../../lib/api';
import { cancelHold, listHolds } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';

export default function OpacHoldsPage({ params }: { params: { orgId: string } }) {
  const searchParams = useSearchParams();

  // 讀者輸入（可由 query string 預填，提升跨頁體驗）
  const [userExternalId, setUserExternalId] = useState('');

  // status filter：OPAC 預設看全部（ready 會被排在最前面）
  const [status, setStatus] = useState<HoldStatus | 'all'>('all');

  // list 結果與狀態
  const [holds, setHolds] = useState<HoldWithDetails[] | null>(null);
  const [loading, setLoading] = useState(false);

  // cancel 動作狀態
  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);

  // 共用訊息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 初次載入：若 URL 有 user_external_id，就預填。
  useEffect(() => {
    const fromQuery = searchParams.get('user_external_id')?.trim();
    if (fromQuery && !userExternalId) setUserExternalId(fromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function refresh() {
    const trimmed = userExternalId.trim();
    if (!trimmed) {
      setError('請輸入 user_external_id（學號/員編）');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await listHolds(params.orgId, {
        status,
        user_external_id: trimmed,
        limit: 200,
      });
      setHolds(result);
    } catch (e) {
      setHolds(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refresh();
  }

  async function onCancel(holdId: string) {
    setError(null);
    setSuccess(null);

    setCancellingHoldId(holdId);
    try {
      // OPAC 取消不傳 actor_user_id：後端會把 actor 視為 hold owner（MVP 暫時方案）
      const result = await cancelHold(params.orgId, holdId, {});
      setSuccess(`已取消：hold_id=${result.id}`);
      await refresh();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCancellingHoldId(null);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>我的預約（Holds）</h1>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/opac/orgs/${params.orgId}`}>回到搜尋</Link>
          <span className="muted" style={{ wordBreak: 'break-all' }}>
            orgId：{params.orgId}
          </span>
        </div>

        <p className="muted">
          MVP 尚未實作登入：請輸入 <code>user_external_id</code> 查詢你的預約，並可取消 queued/ready 預約。
        </p>

        <form onSubmit={onSearch} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              user_external_id（學號/員編）
              <input
                value={userExternalId}
                onChange={(e) => setUserExternalId(e.target.value)}
                placeholder="例：S1130123"
              />
            </label>

            <label>
              status
              <select value={status} onChange={(e) => setStatus(e.target.value as HoldStatus | 'all')}>
                <option value="all">all（全部）</option>
                <option value="ready">ready（可取書）</option>
                <option value="queued">queued（排隊中）</option>
                <option value="fulfilled">fulfilled（已取書借出）</option>
                <option value="cancelled">cancelled（已取消）</option>
                <option value="expired">expired（已逾期）</option>
              </select>
            </label>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? '查詢中…' : '查詢'}
          </button>
        </form>

        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>

        {loading ? <p className="muted">載入中…</p> : null}
        {!loading && holds && holds.length === 0 ? <p className="muted">沒有符合條件的預約。</p> : null}

        {!loading && holds && holds.length > 0 ? (
          <ul>
            {holds.map((h) => (
              <li key={h.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{h.bibliographic_title}</span>{' '}
                    <span className="muted">({h.status})</span>
                  </div>

                  <div className="muted">
                    pickup：{h.pickup_location_code} · {h.pickup_location_name}
                  </div>

                  <div className="muted">
                    assigned_item：
                    {h.assigned_item_barcode ? ` ${h.assigned_item_barcode} · ${h.assigned_item_status}` : '（尚未指派）'}
                  </div>

                  <div className="muted">
                    placed_at={h.placed_at}
                    {h.ready_until ? ` · ready_until=${h.ready_until}` : ''}
                  </div>

                  <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    hold_id={h.id}
                  </div>

                  {h.status === 'queued' || h.status === 'ready' ? (
                    <div>
                      <button type="button" onClick={() => void onCancel(h.id)} disabled={cancellingHoldId === h.id}>
                        {cancellingHoldId === h.id ? '取消中…' : '取消'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

