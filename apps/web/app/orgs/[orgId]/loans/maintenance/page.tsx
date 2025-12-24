/**
 * Loans Maintenance Page（/orgs/:orgId/loans/maintenance）
 *
 * 目的（US-061 借閱歷史保存期限）：
 * - 讓系統管理者（admin）能依「保存天數 retention_days」清理已歸還的舊借閱紀錄（loans）
 * - 避免借閱歷史無限累積造成：
 *   1) 個資/行為資料風險（不必要的長期保存）
 *   2) DB 體積膨脹（備份/查詢成本上升）
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/loans/purge-history（mode=preview|apply）
 *
 * Auth/權限（重要）：
 * - 這是「高風險刪除」操作，因此：
 *   - API 端點受 StaffAuthGuard 保護（需要 Bearer token）
 *   - 後端 RBAC 只允許 admin（active）執行
 * - actor_user_id 由登入者本人推導（session.user.id）
 * - apply 時會寫入 audit_events（action=loan.purge_history）
 */

'use client';

import { useState } from 'react';

import Link from 'next/link';

import type {
  PurgeLoanHistoryApplyResult,
  PurgeLoanHistoryPreviewResult,
} from '../../../../lib/api';
import { applyPurgeLoanHistory, previewPurgeLoanHistory } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

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

export default function LoansMaintenancePage({ params }: { params: { orgId: string } }) {
  // Staff session：本頁受 StaffAuthGuard 保護，且 RBAC 只允許 admin。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：由登入者本人推導（避免任意選 actor 冒用）。
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 1) 參數：retention_days / as_of / limit / include_audit_events / note
  // ----------------------------

  // retentionDays：預設 365 天（學校常見：最多保留 1 年；實際政策依校內規範）
  const [retentionDays, setRetentionDays] = useState('365');

  // asOfLocal：可留空；留空代表後端用 DB now()
  const [asOfLocal, setAsOfLocal] = useState(() => toDateTimeLocalValue(new Date()));

  // limit：一次最多刪多少筆（預設 500）
  const [limit, setLimit] = useState('500');

  // includeAuditEvents：是否連同 loan 的 audit_events 一起刪除（預設關閉；避免誤刪稽核）
  const [includeAuditEvents, setIncludeAuditEvents] = useState(false);

  // note：寫入 audit metadata（方便事後追溯）
  const [note, setNote] = useState('');

  // ----------------------------
  // 3) 結果：preview / apply
  // ----------------------------

  const [preview, setPreview] = useState<PurgeLoanHistoryPreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<PurgeLoanHistoryApplyResult | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 登入門檻：未登入就不顯示操作 UI，避免一直撞 401/403。
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Loans Maintenance</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Loans Maintenance</h1>
          <p className="error">
            這頁需要 staff 登入才能操作。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  // RBAC（前端提示）：後端仍會再檢查一次；這裡只是把錯誤提早變成「可讀」訊息。
  if (session.user.role !== 'admin') {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Loans Maintenance</h1>
          <p className="error">
            這頁只允許 <code>admin</code> 使用（目前登入：{session.user.name} / {session.user.role}）。
          </p>
          <p className="muted">
            若你需要執行借閱歷史保存期限清理，請改用 admin 帳號登入；或由管理者代為操作。
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={`/orgs/${params.orgId}/login`}>前往 Login</Link>
            <Link href={`/orgs/${params.orgId}/loans`}>回 Loans 查詢</Link>
          </div>
        </section>
      </div>
    );
  }

  function buildRequestInput() {
    // 由於我們已先做登入門檻與 role 檢查，這裡的檢查是保險用。
    if (!actorUserId) throw new Error('缺少 actor_user_id（請重新登入）');

    const trimmedRetention = retentionDays.trim();
    const retentionNumber = trimmedRetention ? Number.parseInt(trimmedRetention, 10) : NaN;
    if (!Number.isFinite(retentionNumber) || retentionNumber <= 0) {
      throw new Error('retention_days 必須是正整數');
    }

    const trimmedLimit = limit.trim();
    const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
    if (trimmedLimit && !Number.isFinite(limitNumber)) throw new Error('limit 必須是整數');

    const asOfIso = asOfLocal.trim() ? fromDateTimeLocalToIso(asOfLocal) : null;
    if (asOfLocal.trim() && !asOfIso) throw new Error('as_of 格式不正確（請重新選擇日期時間）');

    return {
      actor_user_id: actorUserId,
      retention_days: retentionNumber,
      ...(asOfIso ? { as_of: asOfIso } : {}),
      ...(limitNumber ? { limit: limitNumber } : {}),
      ...(includeAuditEvents ? { include_audit_events: true } : {}),
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
      const result = await previewPurgeLoanHistory(params.orgId, input);
      setPreview(result);

      if (result.candidates_total === 0) {
        setSuccess('目前沒有需要清理的借閱歷史（符合條件的 loans=0）。');
      } else {
        setSuccess(
          `預覽完成：候選 loans=${result.candidates_total}（本次顯示 ${result.loans.length}；limit=${result.limit}；cutoff=${result.cutoff}）`,
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

      const count = preview?.candidates_total ?? null;
      const ok = window.confirm(
        `確認要執行借閱歷史清理嗎？\n\n` +
          (count !== null ? `候選 loans（preview）：${count} 筆\n` : '') +
          `retention_days：${input.retention_days}\n` +
          `as_of：${input.as_of ?? 'DB now()'}\n` +
          `limit：${input.limit ?? '500'}\n` +
          `include_audit_events：${input.include_audit_events ? 'true' : 'false'}\n\n` +
          `此動作會刪除「已歸還且 returned_at < cutoff」的 loans。\n` +
          `這是不可逆操作，建議先做 DB 備份。`,
      );
      if (!ok) return;

      const result = await applyPurgeLoanHistory(params.orgId, input);
      setApplyResult(result);
      setSuccess(
        `已完成清理：deleted_loans=${result.summary.deleted_loans} · deleted_audit_events=${result.summary.deleted_audit_events}`,
      );

      // apply 後 preview 可能已過時；清掉避免誤判
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
        <h1 style={{ marginTop: 0 }}>Loans Maintenance</h1>

        <p className="muted">
          這頁提供「借閱歷史保存期限」清理（US-061）。套用後可到{' '}
          <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 用 action{' '}
          <code>loan.purge_history</code> 追溯誰做了清理。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/orgs/${params.orgId}/loans`}>← 回 Loans 查詢</Link>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <p className="muted">
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label>
            retention_days（保存天數；必填）
            <input value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} />
          </label>

          <label>
            as_of（選填；留空則使用後端 DB now()）
            <input type="datetime-local" value={asOfLocal} onChange={(e) => setAsOfLocal(e.target.value)} />
          </label>

          <label>
            limit（一次最多刪除幾筆；預設 500）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={includeAuditEvents}
              onChange={(e) => setIncludeAuditEvents(e.target.checked)}
            />{' '}
            include_audit_events（連同 loan 的 audit_events 一起刪除；慎用）
          </label>

          <label>
            note（選填；寫入 audit metadata）
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：每學期結束清理 / 依校內規範" />
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
            <div>
              cutoff：<code>{preview.cutoff}</code>
            </div>
            <div>
              candidates_total：{preview.candidates_total}（本次顯示 {preview.loans.length}；limit={preview.limit}）
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {preview.loans.length === 0 ? (
            <p className="muted">（沒有候選 loans）</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>returned_at</th>
                    <th>borrower</th>
                    <th>item</th>
                    <th>title</th>
                    <th>loan_id</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.loans.map((r) => (
                    <tr key={r.loan_id}>
                      <td>{r.returned_at}</td>
                      <td>
                        {r.user_name} ({r.user_external_id})
                        {r.user_org_unit ? <span className="muted"> · {r.user_org_unit}</span> : null}
                      </td>
                      <td>{r.item_barcode}</td>
                      <td>{r.bibliographic_title}</td>
                      <td>
                        <code style={{ fontSize: 12 }}>{r.loan_id}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              cutoff：<code>{applyResult.cutoff}</code>
            </div>
            <div>
              candidates_total={applyResult.summary.candidates_total} · deleted_loans={applyResult.summary.deleted_loans} ·
              deleted_audit_events={applyResult.summary.deleted_audit_events}
            </div>
            <div>
              audit_event_id：{applyResult.audit_event_id ? <code>{applyResult.audit_event_id}</code> : '（未寫入）'}
            </div>
          </div>

          <p className="muted" style={{ marginTop: 12 }}>
            若本次刪除筆數小於 candidates_total，代表你可能需要再跑一次（或有 SKIP LOCKED / 分批 limit 的情況）。
          </p>

          {applyResult.deleted_loan_ids.length > 0 ? (
            <details style={{ marginTop: 12 }}>
              <summary>本次刪除的 loan_id（最多 {applyResult.deleted_loan_ids.length} 筆）</summary>
              <ul>
                {applyResult.deleted_loan_ids.map((id) => (
                  <li key={id}>
                    <code style={{ fontSize: 12 }}>{id}</code>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
