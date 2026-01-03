/**
 * Audit Events Page（/orgs/:orgId/audit-events）
 *
 * 目的（US-060 稽核事件查詢）：
 * - 讓館員/管理者能依時間區間、操作者、事件類型等條件查詢 audit_events
 * - 用於：追溯問題、除錯、責任歸屬、以及後續報表/政策調整依據
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/audit-events?actor_user_id=...&from=...&to=...&action=...&actor_query=...
 *
 * Auth/權限（重要）：
 * - audit_events 屬於敏感資料（可追溯行為/個資線索），因此 API 端點受 StaffAuthGuard 保護
 * - 查詢時仍保留 actor_user_id（查詢者）欄位，但由登入者本人推導（session.user.id）
 * - StaffAuthGuard 會驗證：request 的 actor_user_id 必須等於 token.sub（避免冒用）
 */

'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { AuditEventRow } from '../../../lib/api';
import { listAuditEvents } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';
import { Alert } from '../../../components/ui/alert';

/**
 * datetime-local（HTML input）需要的格式：
 * - 例：2025-12-24T08:30
 */
function toDateTimeLocalValue(date: Date) {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/**
 * 把 datetime-local 值轉成 ISO 字串（UTC）
 *
 * - 使用者輸入的是本地時間（例如台北時間）
 * - `new Date("YYYY-MM-DDTHH:mm")` 會用本地時間解析
 * - 轉成 ISO 後，後端可用 timestamptz 在 DB 端正確比較 created_at
 */
function fromDateTimeLocalToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function AuditEventsPage({ params }: { params: { orgId: string } }) {
  // Staff session：本頁受 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // viewerUserId：查詢者（actor_user_id），由登入者本人推導。
  const viewerUserId = session?.user.id ?? '';

  // ----------------------------
  // 1) filters（時間/事件/操作者）
  // ----------------------------

  // 預設時間區間：最近 7 天（到現在）
  const [fromLocal, setFromLocal] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toDateTimeLocalValue(d);
  });
  const [toLocal, setToLocal] = useState(() => toDateTimeLocalValue(new Date()));

  // actor_query：用「事件操作者」的 external_id 或 name 模糊查詢（方便現場查人）
  const [actorQuery, setActorQuery] = useState('');

  // action：事件類型（例如 loan.checkout）
  const [action, setAction] = useState('');

  // entity：影響的資料（可用來查單一筆 loan/hold/item 的異動軌跡）
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');

  const [limit, setLimit] = useState('200');

  // ----------------------------
  // 3) data + 狀態
  // ----------------------------

  const [events, setEvents] = useState<AuditEventRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 由於我們已先做登入門檻（session 必存在），這裡的檢查是保險用。
      if (!viewerUserId) throw new Error('缺少 actor_user_id（請重新登入）');

      // from/to：允許留空（不限制時間）
      const fromIso = fromLocal.trim() ? fromDateTimeLocalToIso(fromLocal) : null;
      const toIso = toLocal.trim() ? fromDateTimeLocalToIso(toLocal) : null;

      if (fromLocal.trim() && !fromIso) {
        throw new Error('from 格式不正確（請重新選擇日期時間）');
      }
      if (toLocal.trim() && !toIso) {
        throw new Error('to 格式不正確（請重新選擇日期時間）');
      }

      // 前端先做一個常見錯誤檢查：from > to
      if (fromIso && toIso && fromIso > toIso) {
        throw new Error('from 不可晚於 to');
      }

      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const result = await listAuditEvents(params.orgId, {
        actor_user_id: viewerUserId,
        from: fromIso ?? undefined,
        to: toIso ?? undefined,
        actor_query: actorQuery.trim() || undefined,
        action: action.trim() || undefined,
        entity_type: entityType.trim() || undefined,
        entity_id: entityId.trim() || undefined,
        limit: limitNumber,
      });

      setEvents(result);
      setSuccess(`已載入稽核事件：${result.length} 筆`);
    } catch (e) {
      setEvents(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // 初次進頁面：自動查最近 7 天（如果 viewer 已選到）
  useEffect(() => {
    if (!sessionReady || !session) return;
    if (!viewerUserId) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerUserId, sessionReady, session]);

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Audit Events</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Audit Events</h1>
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查詢。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </section>
      </div>
    );
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refresh();
  }

  function onClear() {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    setFromLocal(toDateTimeLocalValue(sevenDaysAgo));
    setToLocal(toDateTimeLocalValue(now));
    setActorQuery('');
    setAction('');
    setEntityType('');
    setEntityId('');
    setLimit('200');

    // 直接刷新（viewer 不變）
    void refresh();
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Audit Events</h1>

        <p className="muted">
          對應 API：<code>GET /api/v1/orgs/:orgId/audit-events</code>
        </p>

        <p className="muted">
          actor_user_id（查詢者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert variant="success" title="已完成" role="status">
            {success}
          </Alert>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>查詢條件</h2>

        <form onSubmit={onSearch} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              from（開始時間，本地時間顯示；可留空）
              <input
                type="datetime-local"
                value={fromLocal}
                onChange={(e) => setFromLocal(e.target.value)}
              />
            </label>

            <label>
              to（結束時間，本地時間顯示；可留空）
              <input
                type="datetime-local"
                value={toLocal}
                onChange={(e) => setToLocal(e.target.value)}
              />
            </label>

            <label>
              limit（預設 200）
              <input value={limit} onChange={(e) => setLimit(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              actor_query（事件操作者：external_id 或姓名；選填）
              <input
                value={actorQuery}
                onChange={(e) => setActorQuery(e.target.value)}
                placeholder="例：S1130123 / 王小明"
              />
            </label>

            <label>
              action（事件類型；選填）
              <input
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="例：loan.checkout / hold.cancel"
                list="actionOptions"
              />
              {/* datalist：提供常見 action 的提示，不限制使用者輸入 */}
              <datalist id="actionOptions">
                <option value="loan.checkout" />
                <option value="loan.checkin" />
                <option value="loan.renew" />
                <option value="loan.purge_history" />
                <option value="hold.create" />
                <option value="hold.cancel" />
                <option value="hold.fulfill" />
                <option value="hold.expire" />
                <option value="user.import_csv" />
                <option value="user.update" />
                <option value="item.mark_lost" />
                <option value="item.mark_repair" />
                <option value="item.mark_withdrawn" />
              </datalist>
            </label>

            <label>
              entity_type（影響資料類型；選填）
              <input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="例：loan / hold" />
            </label>
          </div>

          <label>
            entity_id（影響資料 ID；選填）
            <input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="例：UUID / barcode" />
          </label>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" className="btnPrimary" disabled={loading}>
              {loading ? '查詢中…' : '查詢'}
            </button>
            <button type="button" className="btnSmall" onClick={onClear} disabled={loading}>
              清除
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>

        {loading ? <p className="muted">載入中…</p> : null}
        {!loading && events && events.length === 0 ? <p className="muted">沒有符合條件的稽核事件。</p> : null}

        {!loading && events && events.length > 0 ? (
          <ul>
            {events.map((ev) => (
              <li key={ev.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{ev.action}</span>{' '}
                    <span className="muted">· {ev.created_at}</span>
                  </div>

                  <div className="muted">
                    actor：{ev.actor_name} · external_id={ev.actor_external_id} · role={ev.actor_role} · status=
                    {ev.actor_status}
                  </div>

                  <div className="muted">
                    entity：{ev.entity_type} · {ev.entity_id}
                  </div>

                  {/* metadata 通常很長，預設折疊 */}
                  <details>
                    <summary className="muted">metadata（展開/收合）</summary>
                    <pre
                      style={{
                        margin: 0,
                        padding: 12,
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        overflowX: 'auto',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--text)',
                        fontSize: 12,
                      }}
                    >
                      {ev.metadata ? JSON.stringify(ev.metadata, null, 2) : 'null'}
                    </pre>
                  </details>

                  <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    audit_event_id={ev.id}
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
