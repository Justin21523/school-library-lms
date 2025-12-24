/**
 * Overdue Report Page（/orgs/:orgId/reports/overdue）
 *
 * 目的（US-044 逾期清單）：
 * - 讓館員能依「基準時間 as_of」與「班級/單位 org_unit」查詢逾期清單
 * - 並支援匯出 CSV（方便通知、對帳、留存）
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/reports/overdue?actor_user_id=...&as_of=...&org_unit=...&format=json|csv
 *
 * MVP 限制：
 * - 目前沒有登入（auth），因此必須由前端提供 actor_user_id（admin/librarian）
 * - 這是「最小可用」的權限控管：避免敏感報表完全裸奔
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import type { OverdueReportRow, User } from '../../../../lib/api';
import { downloadOverdueReportCsv, listOverdueReport, listUsers } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';

// actor 候選人：必須是 active 的 admin/librarian（對齊後端 reports 的最小 RBAC）。
function isActorCandidate(user: User) {
  return user.status === 'active' && (user.role === 'admin' || user.role === 'librarian');
}

/**
 * datetime-local（HTML input）需要的格式：
 * - 例：2025-12-24T08:30
 *
 * 我們用「本地時間」顯示給使用者；送出 API 時再轉成 ISO（UTC）字串。
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
 * - 使用者輸入的是「本地時間」
 * - `new Date("YYYY-MM-DDTHH:mm")` 在瀏覽器會以本地時間解析
 * - 轉成 ISO 後，後端可用 timestamptz 正確比較
 */
function fromDateTimeLocalToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isoDateForFilename(iso: string | null) {
  // ISO 例：2025-12-24T08:30:00.000Z → 取 YYYY-MM-DD
  if (!iso) return new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10);
}

export default function OverdueReportPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) actor（操作者）選擇
  // ----------------------------

  const [users, setUsers] = useState<User[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actorUserId, setActorUserId] = useState('');

  const actorCandidates = useMemo(() => (users ?? []).filter(isActorCandidate), [users]);

  // ----------------------------
  // 2) filters（as_of / org_unit / limit）
  // ----------------------------

  // asOfLocal：用 datetime-local 呈現給使用者（本地時間）。
  // - 預設給「現在」，讓使用者一進頁面就能查
  const [asOfLocal, setAsOfLocal] = useState(() => toDateTimeLocalValue(new Date()));

  // orgUnit：班級/單位（對應 users.org_unit）
  const [orgUnit, setOrgUnit] = useState('');

  // limit：避免一次撈太多（預設 500）
  const [limit, setLimit] = useState('500');

  // ----------------------------
  // 3) report data（rows）
  // ----------------------------

  const [rows, setRows] = useState<OverdueReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  // CSV download state
  const [downloading, setDownloading] = useState(false);

  // 共用訊息
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

        // 若尚未選 actor，就預設選第一個可用館員（提升可用性）。
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

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!actorUserId) {
        throw new Error('請先選擇 actor_user_id（館員/管理者）');
      }

      // as_of：把本地 datetime-local 轉成 ISO（UTC）
      const asOfIso = fromDateTimeLocalToIso(asOfLocal);
      if (!asOfIso) {
        throw new Error('as_of 格式不正確（請重新選擇日期時間）');
      }

      // limit：空字串視為未提供；否則轉 int
      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const result = await listOverdueReport(params.orgId, {
        actor_user_id: actorUserId,
        as_of: asOfIso,
        org_unit: orgUnit.trim() || undefined,
        limit: limitNumber,
      });

      setRows(result);
      setSuccess(`已載入逾期清單：${result.length} 筆`);
    } catch (e) {
      setRows(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refresh();
  }

  async function onDownloadCsv() {
    setDownloading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!actorUserId) {
        throw new Error('請先選擇 actor_user_id（館員/管理者）');
      }

      const asOfIso = fromDateTimeLocalToIso(asOfLocal);
      if (!asOfIso) {
        throw new Error('as_of 格式不正確（請重新選擇日期時間）');
      }

      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      // 1) 先把 CSV 內容抓回來（文字）
      const csv = await downloadOverdueReportCsv(params.orgId, {
        actor_user_id: actorUserId,
        as_of: asOfIso,
        org_unit: orgUnit.trim() || undefined,
        limit: limitNumber,
      });

      // 2) 轉成 Blob → 觸發下載
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const fileDate = isoDateForFilename(asOfIso);
      const filename = `overdue-${fileDate}.csv`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();

      URL.revokeObjectURL(url);
      setSuccess(`已下載 CSV：${filename}`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Overdue Report</h1>

        <p className="muted">
          對應 API：<code>GET /api/v1/orgs/:orgId/reports/overdue</code>
        </p>

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
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>查詢條件</h2>

        <form onSubmit={onSearch} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              as_of（基準時間，本地時間顯示）
              <input
                type="datetime-local"
                value={asOfLocal}
                onChange={(e) => setAsOfLocal(e.target.value)}
              />
            </label>

            <label>
              org_unit（班級/單位，精確比對；選填）
              <input value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)} placeholder="例：601、教務處" />
            </label>

            <label>
              limit（預設 500）
              <input value={limit} onChange={(e) => setLimit(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" disabled={loading}>
              {loading ? '查詢中…' : '查詢'}
            </button>
            <button type="button" onClick={() => void onDownloadCsv()} disabled={downloading}>
              {downloading ? '下載中…' : '下載 CSV'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>

        {loading ? <p className="muted">載入中…</p> : null}
        {!loading && rows && rows.length === 0 ? <p className="muted">沒有逾期資料。</p> : null}

        {!loading && rows && rows.length > 0 ? (
          <ul>
            {rows.map((r) => (
              <li key={r.loan_id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>{r.bibliographic_title}</div>

                  <div className="muted">
                    borrower：{r.user_name} · external_id={r.user_external_id} · org_unit={r.user_org_unit ?? '(null)'}
                  </div>

                  <div className="muted">
                    item：{r.item_barcode} · call_number={r.item_call_number} · location={r.item_location_code} ·{' '}
                    {r.item_location_name}
                  </div>

                  <div className="error">
                    due_at={r.due_at} · days_overdue={r.days_overdue}
                  </div>

                  <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    loan_id={r.loan_id}
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

