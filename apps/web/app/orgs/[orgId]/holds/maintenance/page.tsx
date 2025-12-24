/**
 * Holds Maintenance Page（/orgs/:orgId/holds/maintenance）
 *
 * 目的：
 * - 這頁放「館員每日例行作業」：最先落地的是「到書未取 → 逾期處理」
 * - 把 ready_until 過期的 holds 標記為 expired，並釋放/轉派冊
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/holds/expire-ready（mode=preview|apply）
 *
 * 重要：MVP 尚未做登入（auth）
 * - 這類批次維運操作一定要有操作者，因此必須提供 actor_user_id（admin/librarian）
 * - 後端會寫入 audit_events（action=hold.expire），讓你事後可追溯「誰處理了哪些到期」
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type {
  ExpireReadyHoldsApplyResult,
  ExpireReadyHoldsPreviewResult,
  HoldWithDetails,
  User,
} from '../../../../lib/api';
import { applyExpireReadyHolds, listUsers, previewExpireReadyHolds } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';

function isActorCandidate(user: User) {
  return user.status === 'active' && (user.role === 'admin' || user.role === 'librarian');
}

function toDateTimeLocalValue(date: Date) {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDateTimeLocalToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatHoldLabel(hold: HoldWithDetails) {
  const who = `${hold.user_name} (${hold.user_external_id})`;
  const what = hold.bibliographic_title;
  const item = hold.assigned_item_barcode ? ` · item=${hold.assigned_item_barcode}` : '';
  return `${who} · ${what}${item}`;
}

export default function HoldsMaintenancePage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) actor（操作者）選擇
  // ----------------------------

  const [users, setUsers] = useState<User[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actorUserId, setActorUserId] = useState('');

  const actorCandidates = useMemo(() => (users ?? []).filter(isActorCandidate), [users]);

  // ----------------------------
  // 2) 參數：as_of / limit / note
  // ----------------------------

  // asOfLocal：可留空；留空代表「由後端用 DB now() 判定」
  // - 預設給現在，讓你直接按 preview 就能看到清單
  const [asOfLocal, setAsOfLocal] = useState(() => toDateTimeLocalValue(new Date()));

  const [limit, setLimit] = useState('200');
  const [note, setNote] = useState('');

  // ----------------------------
  // 3) 結果：preview / apply
  // ----------------------------

  const [preview, setPreview] = useState<ExpireReadyHoldsPreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ExpireReadyHoldsApplyResult | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 初次載入：抓 users（讓館員選 actor）
  useEffect(() => {
    async function run() {
      setLoadingUsers(true);
      setError(null);
      try {
        const result = await listUsers(params.orgId);
        setUsers(result);

        // 若尚未選 actor，就預設第一個可用館員（提升可用性）
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

  function buildRequestInput() {
    if (!actorUserId) throw new Error('請先選擇 actor_user_id（館員/管理者）');

    const trimmedLimit = limit.trim();
    const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
    if (trimmedLimit && !Number.isFinite(limitNumber)) throw new Error('limit 必須是整數');

    // as_of：允許留空 → 不送，讓後端用 DB now()
    const asOfIso = asOfLocal.trim() ? fromDateTimeLocalToIso(asOfLocal) : null;
    if (asOfLocal.trim() && !asOfIso) throw new Error('as_of 格式不正確（請重新選擇日期時間）');

    return {
      actor_user_id: actorUserId,
      ...(asOfIso ? { as_of: asOfIso } : {}),
      ...(limitNumber ? { limit: limitNumber } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
  }

  async function runPreview() {
    setPreviewing(true);
    setError(null);
    setSuccess(null);
    setApplyResult(null);

    try {
      const input = buildRequestInput();
      const result = await previewExpireReadyHolds(params.orgId, input);
      setPreview(result);

      if (result.candidates_total === 0) {
        setSuccess('目前沒有已過期的 ready holds。');
      } else {
        setSuccess(
          `預覽完成：已過期 ${result.candidates_total} 筆（本次顯示 ${result.holds.length} 筆；limit=${result.limit}；as_of=${result.as_of}）`,
        );
      }
    } catch (e) {
      setPreview(null);
      setError(formatErrorMessage(e));
    } finally {
      setPreviewing(false);
    }
  }

  async function runApply() {
    setApplying(true);
    setError(null);
    setSuccess(null);
    setApplyResult(null);

    try {
      const input = buildRequestInput();

      // UX：若有 preview 結果，套用前用 preview 的摘要做確認（降低誤操作）
      const count = preview?.candidates_total ?? null;
      const ok = window.confirm(
        `確認要執行到期處理嗎？\n\n` +
          (count !== null ? `已過期（preview）：${count} 筆\n` : '') +
          `limit：${input.limit ?? '200'}\n` +
          `as_of：${input.as_of ?? 'DB now()'}\n\n` +
          `此動作會：\n` +
          `- 把過期 ready hold → expired\n` +
          `- 釋放冊回 available 或轉派給下一位 queued\n` +
          `- 寫入 audit_events（hold.expire）`,
      );
      if (!ok) return;

      const result = await applyExpireReadyHolds(params.orgId, input);
      setApplyResult(result);
      setSuccess(
        `已完成到期處理：processed=${result.summary.processed} · transferred=${result.summary.transferred} · released=${result.summary.released} · skipped_item_action=${result.summary.skipped_item_action}`,
      );

      // apply 後，preview 可能已過期；清掉避免誤判
      setPreview(null);
    } catch (e) {
      setApplyResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Holds Maintenance</h1>
        <p className="muted">
          這頁是「館員每日例行作業」入口：先提供到期處理（ready_until → expired）。套用後可到{' '}
          <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 用 action{' '}
          <code>hold.expire</code> 查追溯。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/orgs/${params.orgId}/holds`}>← 回 Holds 工作台</Link>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

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

        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label>
            as_of（選填；留空則使用後端 DB now()）
            <input
              type="datetime-local"
              value={asOfLocal}
              onChange={(e) => setAsOfLocal(e.target.value)}
            />
          </label>

          <label>
            limit（一次最多處理幾筆；預設 200）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>

          <label>
            note（選填；寫入 audit metadata）
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：每日到期處理 / 連假後補處理" />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" onClick={() => void runPreview()} disabled={previewing}>
            {previewing ? '預覽中…' : '預覽（Preview）'}
          </button>
          <button type="button" onClick={() => void runApply()} disabled={applying}>
            {applying ? '套用中…' : '套用（Apply）'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setApplyResult(null);
              setError(null);
              setSuccess(null);
            }}
            disabled={previewing || applying}
          >
            清除結果
          </button>
        </div>

        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
      </section>

      {preview ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Preview 結果</h2>
          <div className="muted" style={{ display: 'grid', gap: 6 }}>
            <div>
              as_of：<code>{preview.as_of}</code>
            </div>
            <div>candidates_total：{preview.candidates_total}</div>
            <div>
              本次顯示：{preview.holds.length}（limit={preview.limit}）
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {preview.holds.length === 0 ? (
            <p className="muted">（沒有需要處理的 holds）</p>
          ) : (
            <ul>
              {preview.holds.map((h) => (
                <li key={h.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>{formatHoldLabel(h)}</div>
                    <div className="muted">
                      status={h.status} · ready_until={h.ready_until ?? '-'} · pickup={h.pickup_location_name} (
                      {h.pickup_location_code})
                    </div>
                    <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      hold_id={h.id}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {applyResult ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Apply 結果</h2>
          <div className="muted" style={{ display: 'grid', gap: 6 }}>
            <div>
              as_of：<code>{applyResult.as_of}</code>
            </div>
            <div>
              candidates_total={applyResult.summary.candidates_total} · processed={applyResult.summary.processed} ·
              transferred={applyResult.summary.transferred} · released={applyResult.summary.released} ·
              skipped_item_action={applyResult.summary.skipped_item_action}
            </div>
          </div>

          <p className="muted" style={{ marginTop: 12 }}>
            你可以到 <Link href={`/orgs/${params.orgId}/holds`}>Holds 工作台</Link>（status=ready/queued/expired）確認結果，
            或到 <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 查 action <code>hold.expire</code>。
          </p>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {applyResult.results.length === 0 ? (
            <p className="muted">（本次沒有處理任何 holds；可能已被其他人 fulfill/cancel，或被鎖住而 SKIP LOCKED）</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>hold_id</th>
                    <th>item_barcode</th>
                    <th>item_before</th>
                    <th>item_after</th>
                    <th>transferred_to_hold_id</th>
                    <th>audit_event_id</th>
                  </tr>
                </thead>
                <tbody>
                  {applyResult.results.map((r) => (
                    <tr key={r.audit_event_id}>
                      <td>
                        <code style={{ fontSize: 12 }}>{r.hold_id}</code>
                      </td>
                      <td>{r.assigned_item_barcode ?? ''}</td>
                      <td>{r.item_status_before ?? ''}</td>
                      <td>{r.item_status_after ?? ''}</td>
                      <td>
                        {r.transferred_to_hold_id ? (
                          <code style={{ fontSize: 12 }}>{r.transferred_to_hold_id}</code>
                        ) : (
                          ''
                        )}
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{r.audit_event_id}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

