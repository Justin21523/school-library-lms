/**
 * Top Circulation Report Page（/orgs/:orgId/reports/top-circulation）
 *
 * 目的（US-050 熱門書）：
 * - 讓館員選一段期間（from/to），查出「借出次數最高的書」（書目層級）
 * - 支援匯出 CSV（給閱讀推廣、補書決策、校內報告）
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/reports/top-circulation?actor_user_id=...&from=...&to=...&limit=...&format=json|csv
 *
 * Auth/權限（重要）：
 * - 報表通常含敏感資料（行為資料），因此 API 端點受 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id（查詢者）由登入者本人推導（session.user.id），不再提供下拉選擇（避免冒用）
 */

'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type { TopCirculationRow } from '../../../../lib/api';
import { downloadTopCirculationReportCsv, listTopCirculationReport } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

/**
 * datetime-local（HTML input）需要的格式：YYYY-MM-DDTHH:mm
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
 * - new Date("YYYY-MM-DDTHH:mm") 會以本地時區解析
 * - toISOString() 轉成 UTC 字串，後端用 timestamptz 比較
 */
function fromDateTimeLocalToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isoDateForFilename(iso: string) {
  // ISO 例：2025-12-24T08:30:00.000Z → 取 YYYY-MM-DD
  return iso.slice(0, 10);
}

export default function TopCirculationReportPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) staff session（登入者 / 查詢者）
  // ----------------------------

  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 2) filters（from/to/limit）
  // ----------------------------

  // 預設期間：近 30 天（到現在）
  const [fromLocal, setFromLocal] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateTimeLocalValue(d);
  });
  const [toLocal, setToLocal] = useState(() => toDateTimeLocalValue(new Date()));

  const [limit, setLimit] = useState('50');

  // ----------------------------
  // 3) data + state
  // ----------------------------

  const [rows, setRows] = useState<TopCirculationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!actorUserId) throw new Error('缺少 actor_user_id（請重新登入）');

      const fromIso = fromDateTimeLocalToIso(fromLocal);
      const toIso = fromDateTimeLocalToIso(toLocal);
      if (!fromIso) throw new Error('from 格式不正確（請重新選擇日期時間）');
      if (!toIso) throw new Error('to 格式不正確（請重新選擇日期時間）');
      if (fromIso > toIso) throw new Error('from 不可晚於 to');

      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) throw new Error('limit 必須是整數');

      const result = await listTopCirculationReport(params.orgId, {
        actor_user_id: actorUserId,
        from: fromIso,
        to: toIso,
        limit: limitNumber,
      });

      setRows(result);
      setSuccess(`已載入熱門書排行：${result.length} 筆`);
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
      if (!actorUserId) throw new Error('缺少 actor_user_id（請重新登入）');

      const fromIso = fromDateTimeLocalToIso(fromLocal);
      const toIso = fromDateTimeLocalToIso(toLocal);
      if (!fromIso) throw new Error('from 格式不正確（請重新選擇日期時間）');
      if (!toIso) throw new Error('to 格式不正確（請重新選擇日期時間）');
      if (fromIso > toIso) throw new Error('from 不可晚於 to');

      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) throw new Error('limit 必須是整數');

      const csv = await downloadTopCirculationReportCsv(params.orgId, {
        actor_user_id: actorUserId,
        from: fromIso,
        to: toIso,
        limit: limitNumber,
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const filename = `top-circulation-${isoDateForFilename(fromIso)}-${isoDateForFilename(toIso)}.csv`;
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

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Top Circulation</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Top Circulation</h1>
          <p className="error">
            這頁需要 staff 登入才能查詢/下載。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Top Circulation</h1>
        <p className="muted">
          對應 API：<code>GET /api/v1/orgs/:orgId/reports/top-circulation</code>
        </p>
        <p className="muted">
          這個報表用 <code>loans.checked_out_at</code> 統計「期間內借出次數」，排序後回傳書目排行。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/orgs/${params.orgId}/reports/overdue`}>→ Overdue Report</Link>
          <Link href={`/orgs/${params.orgId}/reports/circulation-summary`}>→ Circulation Summary</Link>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <p className="muted">
          actor_user_id（查詢者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

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
              limit（前 N 名；預設 50）
              <input value={limit} onChange={(e) => setLimit(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" disabled={loading}>
              {loading ? '查詢中…' : '查詢'}
            </button>
            <button type="button" onClick={() => void onDownloadCsv()} disabled={downloading || loading}>
              {downloading ? '下載中…' : '下載 CSV'}
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const d = new Date();
                d.setDate(now.getDate() - 30);
                setFromLocal(toDateTimeLocalValue(d));
                setToLocal(toDateTimeLocalValue(now));
                setLimit('50');
                void refresh();
              }}
              disabled={loading || downloading}
            >
              重設（近 30 天）
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
            <p className="muted">總借出筆數（僅加總本頁排行）：{totalLoans}</p>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>title</th>
                    <th>loan_count</th>
                    <th>unique_borrowers</th>
                    <th>bib</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.bibliographic_id}>
                      <td>{idx + 1}</td>
                      <td>
                        <Link href={`/orgs/${params.orgId}/bibs/${r.bibliographic_id}`}>
                          {r.bibliographic_title}
                        </Link>
                      </td>
                      <td>{r.loan_count}</td>
                      <td>{r.unique_borrowers}</td>
                      <td>
                        <code style={{ fontSize: 12 }}>{r.bibliographic_id}</code>
                      </td>
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
