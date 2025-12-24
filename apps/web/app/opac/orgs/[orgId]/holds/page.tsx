/**
 * OPAC：我的預約（/opac/orgs/:orgId/holds）
 *
 * 讀者在這裡可以：
 * - 以 user_external_id 查詢自己的 holds
 * - 取消 queued/ready holds
 *
 * 版本演進：
 * - 早期 MVP：用 user_external_id 查詢/取消（可用但不安全）
 * - 目前：已支援 OPAC Account（Patron login）
 *   - 若已登入：使用 `/me/holds` 與 `/me/holds/:id/cancel`（安全、只允許本人）
 *   - 若未登入：仍保留 user_external_id 模式（過渡，請儘快導入登入）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { HoldStatus, HoldWithDetails } from '../../../../lib/api';
import { cancelHold, cancelMyHold, listHolds, listMyHolds } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useOpacSession } from '../../../../lib/use-opac-session';

export default function OpacHoldsPage({ params }: { params: { orgId: string } }) {
  const searchParams = useSearchParams();

  // OPAC session：若已登入，會用 /me 端點取代 user_external_id 模式。
  const { ready: sessionReady, session } = useOpacSession(params.orgId);

  // 讀者輸入（可由 query string 預填，提升跨頁體驗）
  const [userExternalId, setUserExternalId] = useState('');

  // status filter：OPAC 預設看全部（ready 會被排在最前面）
  const [status, setStatus] = useState<HoldStatus | 'all'>('all');

  // limit：避免一次載入過多（預設 200）
  const [limit, setLimit] = useState('200');

  // list 結果與狀態
  const [holds, setHolds] = useState<HoldWithDetails[] | null>(null);
  const [loading, setLoading] = useState(false);

  // cancel 動作狀態
  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);

  // 共用訊息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const meLabel = useMemo(() => {
    if (!session) return null;
    return `${session.user.name}（${session.user.role}）· ${session.user.external_id}`;
  }, [session]);

  // 初次載入：若 URL 有 user_external_id，就預填。
  useEffect(() => {
    const fromQuery = searchParams.get('user_external_id')?.trim();
    // 若已登入：不需要也不應該使用 query string 的 external_id（避免誤用）
    if (session) return;
    if (fromQuery && !userExternalId) setUserExternalId(fromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // limit：空字串視為未提供；否則轉 int。
      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      // 依登入狀態選擇 API：
      // - 已登入：/me/holds（安全）
      // - 未登入：/holds?user_external_id=...（過渡、不安全）
      const result = session
        ? await listMyHolds(params.orgId, {
            status,
            limit: limitNumber,
          })
        : await (async () => {
            const trimmed = userExternalId.trim();
            if (!trimmed) throw new Error('請輸入 user_external_id（學號/員編）');
            return await listHolds(params.orgId, {
              status,
              user_external_id: trimmed,
              limit: limitNumber,
            });
          })();

      setHolds(result);
    } catch (e) {
      setHolds(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // 初次載入（已登入）：直接列出我的 holds（避免使用者還要按一次查詢）。
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refresh();
  }

  async function onCancel(holdId: string) {
    setError(null);
    setSuccess(null);

    setCancellingHoldId(holdId);
    try {
      // 依登入狀態選擇取消方式：
      // - 已登入：/me/holds/:id/cancel（PatronAuthGuard 保證只能取消自己的 hold）
      // - 未登入：/holds/:id/cancel（過渡版本；不安全）
      const result = session
        ? await cancelMyHold(params.orgId, holdId)
        : await cancelHold(params.orgId, holdId, {});
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

        {sessionReady ? null : <p className="muted">載入登入狀態中…</p>}

        {sessionReady && session ? (
          <p className="muted">
            已登入：{meLabel}；對應 API：<code>GET/POST /api/v1/orgs/:orgId/me/holds</code>
          </p>
        ) : null}

        {sessionReady && !session ? (
          <p className="muted">
            尚未登入：你仍可用 <code>user_external_id</code> 查詢/取消（過渡模式），但安全性較低；建議先{' '}
            <Link href={`/opac/orgs/${params.orgId}/login`}>登入 OPAC Account</Link>。
          </p>
        ) : null}

        <form onSubmit={onSearch} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {!session ? (
              <label>
                user_external_id（學號/員編）
                <input
                  value={userExternalId}
                  onChange={(e) => setUserExternalId(e.target.value)}
                  placeholder="例：S1130123"
                />
              </label>
            ) : (
              <div className="muted" style={{ alignSelf: 'end' }}>
                user_external_id：<code>{session.user.external_id}</code>（由登入身分推導）
              </div>
            )}

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

          <label style={{ maxWidth: 240 }}>
            limit（預設 200）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>

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
