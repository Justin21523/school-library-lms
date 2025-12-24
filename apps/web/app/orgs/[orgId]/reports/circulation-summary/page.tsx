/**
 * Circulation Summary Page（/orgs/:orgId/reports/circulation-summary）
 *
 * 目的（US-050 借閱量彙總）：
 * - 讓館員選一段期間（from/to），以 day/week/month 彙總借閱量（借出筆數）
 * - 支援匯出 CSV（方便做校內報告、閱讀推廣統計）
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/reports/circulation-summary?actor_user_id=...&from=...&to=...&group_by=day|week|month&format=json|csv
 *
 * MVP 權限策略：
 * - 目前沒有 auth（登入），因此仍要求 actor_user_id（admin/librarian）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { CirculationSummaryRow, User } from '../../../../lib/api';
import {
  downloadCirculationSummaryReportCsv,
  listCirculationSummaryReport,
  listUsers,
} from '../../../../lib/api';
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

function isoDateForFilename(iso: string) {
  return iso.slice(0, 10);
}

export default function CirculationSummaryPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) actor（操作者）選擇
  // ----------------------------

  const [users, setUsers] = useState<User[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actorUserId, setActorUserId] = useState('');

  const actorCandidates = useMemo(() => (users ?? []).filter(isActorCandidate), [users]);

  // ----------------------------
  // 2) filters（from/to/group_by）
  // ----------------------------

  const [fromLocal, setFromLocal] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateTimeLocalValue(d);
  });
  const [toLocal, setToLocal] = useState(() => toDateTimeLocalValue(new Date()));

  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // ----------------------------
  // 3) data + state
  // ----------------------------

  const [rows, setRows] = useState<CirculationSummaryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      setLoadingUsers(true);
      setError(null);
      try {
        const result = await listUsers(params.orgId);
        setUsers(result);

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
      if (!actorUserId) throw new Error('請先選擇 actor_user_id（館員/管理者）');

      const fromIso = fromDateTimeLocalToIso(fromLocal);
      const toIso = fromDateTimeLocalToIso(toLocal);
      if (!fromIso) throw new Error('from 格式不正確（請重新選擇日期時間）');
      if (!toIso) throw new Error('to 格式不正確（請重新選擇日期時間）');
      if (fromIso > toIso) throw new Error('from 不可晚於 to');

      const result = await listCirculationSummaryReport(params.orgId, {
        actor_user_id: actorUserId,
        from: fromIso,
        to: toIso,
        group_by: groupBy,
      });

      setRows(result);
      setSuccess(`已載入借閱量彙總：${result.length} 筆 bucket`);
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
      if (!actorUserId) throw new Error('請先選擇 actor_user_id（館員/管理者）');

      const fromIso = fromDateTimeLocalToIso(fromLocal);
      const toIso = fromDateTimeLocalToIso(toLocal);
      if (!fromIso) throw new Error('from 格式不正確（請重新選擇日期時間）');
      if (!toIso) throw new Error('to 格式不正確（請重新選擇日期時間）');
      if (fromIso > toIso) throw new Error('from 不可晚於 to');

      const csv = await downloadCirculationSummaryReportCsv(params.orgId, {
        actor_user_id: actorUserId,
        from: fromIso,
        to: toIso,
        group_by: groupBy,
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const filename = `circulation-summary-${groupBy}-${isoDateForFilename(fromIso)}-${isoDateForFilename(toIso)}.csv`;
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

  const totalLoans = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((sum, r) => sum + r.loan_count, 0);
  }, [rows]);

  function setPresetDays(days: number) {
    const now = new Date();
    const d = new Date();
    d.setDate(now.getDate() - days);
    setFromLocal(toDateTimeLocalValue(d));
    setToLocal(toDateTimeLocalValue(now));
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Circulation Summary</h1>
        <p className="muted">
          對應 API：<code>GET /api/v1/orgs/:orgId/reports/circulation-summary</code>
        </p>
        <p className="muted">
          這個報表用 <code>loans.checked_out_at</code> 統計「借出筆數」，並用 <code>group_by</code>{' '}
          彙總成日/週/月。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/orgs/${params.orgId}/reports/overdue`}>→ Overdue Report</Link>
          <Link href={`/orgs/${params.orgId}/reports/top-circulation`}>→ Top Circulation</Link>
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
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>查詢條件</h2>

        <form onSubmit={onSearch} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label>
              from（本地時間顯示）
              <input type="datetime-local" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
            </label>

            <label>
              to（本地時間顯示）
              <input type="datetime-local" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
            </label>

            <label>
              group_by（彙總顆粒度）
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
                <option value="day">day（日）</option>
                <option value="week">week（週）</option>
                <option value="month">month（月）</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" disabled={loading}>
              {loading ? '查詢中…' : '查詢'}
            </button>
            <button type="button" onClick={() => void onDownloadCsv()} disabled={downloading || loading}>
              {downloading ? '下載中…' : '下載 CSV'}
            </button>

            {/* 小工具：快速切換常用期間（學校現場常用） */}
            <button type="button" onClick={() => setPresetDays(7)} disabled={loading || downloading}>
              近 7 天
            </button>
            <button type="button" onClick={() => setPresetDays(30)} disabled={loading || downloading}>
              近 30 天
            </button>
            <button type="button" onClick={() => setPresetDays(180)} disabled={loading || downloading}>
              近 180 天（約一學期）
            </button>

            <button
              type="button"
              onClick={() => {
                setPresetDays(30);
                setGroupBy('day');
                void refresh();
              }}
              disabled={loading || downloading}
            >
              重設
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>

        {loading ? <p className="muted">載入中…</p> : null}
        {!loading && rows && rows.length === 0 ? <p className="muted">沒有資料（此期間沒有借出）。</p> : null}

        {!loading && rows && rows.length > 0 ? (
          <>
            <p className="muted">
              bucket 數：{rows.length} · 總借出筆數：{totalLoans}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>bucket_start</th>
                    <th>loan_count</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.bucket_start}>
                      <td>
                        <code style={{ fontSize: 12 }}>{r.bucket_start}</code>
                      </td>
                      <td>{r.loan_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
