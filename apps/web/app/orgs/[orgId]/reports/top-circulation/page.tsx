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
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { SkeletonTable } from '../../../../components/ui/skeleton';
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

  const rankByBibId = useMemo(() => {
    // 讓「#（API rank）」即使在使用者切換排序後仍保持一致：
    // - API 預設已依 loan_count desc 排序
    // - UI 若讓使用者改用其他欄位排序，rank 仍可作為「回到原始排行」的參考
    //
    // 重要：這個 useMemo 必須放在「登入門檻 return」之前。
    // - 因為 React hooks 需要「每次 render 的呼叫順序一致」
    // - 若把 useMemo 放在 `if (!session) return ...` 之後，初次 render（session 尚未 ready）會少跑這個 hook，
    //   下一次 render（session ready）又多跑一個 hook → 觸發 React minified error #310（hooks mismatch）。
    const m = new Map<string, number>();
    (rows ?? []).forEach((r, idx) => m.set(r.bibliographic_id, idx + 1));
    return m;
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
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查詢/下載。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
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

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>查詢條件</h2>

        <Form onSubmit={onSearch} style={{ marginTop: 12 }}>
          <FormSection title="條件" description="from/to 以本地時間顯示，送出時會轉成 ISO（UTC）給後端比較。">
            <div className="grid3">
              <Field label="from（本地時間顯示）" htmlFor="top_from">
                <input id="top_from" type="datetime-local" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
              </Field>

              <Field label="to（本地時間顯示）" htmlFor="top_to">
                <input id="top_to" type="datetime-local" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
              </Field>

              <Field label="limit（前 N 名；預設 50）" htmlFor="top_limit">
                <input id="top_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '查詢中…' : '查詢'}
              </button>
              <button type="button" className="btnSmall" onClick={() => void onDownloadCsv()} disabled={downloading || loading}>
                {downloading ? '下載中…' : '下載 CSV'}
              </button>
              <button
                type="button"
                className="btnSmall"
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
            </FormActions>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>

        {loading && !rows ? <SkeletonTable columns={5} rows={8} /> : null}

        {!loading && !rows ? (
          <EmptyState title="尚未查詢" description="請先設定查詢條件後按「查詢」。" />
        ) : null}

        {!loading && rows && rows.length === 0 ? (
          <EmptyState title="沒有資料" description="此期間沒有任何借出（loans.checked_out_at）。" />
        ) : null}

        {!loading && rows && rows.length > 0 ? (
          <div className="stack">
            <div className="muted">
              總借出筆數（僅加總本頁排行）：<code>{totalLoans}</code>
            </div>

            <DataTable
              rows={rows}
              getRowKey={(r) => r.bibliographic_id}
              initialSort={{ columnId: 'loan_count', direction: 'desc' }}
              sortHint="本報表一次載入全部資料；排序會即時套用在目前結果。"
              columns={[
                {
                  id: 'rank',
                  header: '#（API rank）',
                  cell: (r) => <code>{rankByBibId.get(r.bibliographic_id) ?? '—'}</code>,
                  sortValue: (r) => rankByBibId.get(r.bibliographic_id) ?? 0,
                  align: 'right',
                  width: 120,
                },
                {
                  id: 'title',
                  header: 'title',
                  cell: (r) => (
                    <Link href={`/orgs/${params.orgId}/bibs/${r.bibliographic_id}`}>
                      <span style={{ fontWeight: 800 }}>{r.bibliographic_title}</span>
                    </Link>
                  ),
                  sortValue: (r) => r.bibliographic_title,
                },
                {
                  id: 'loan_count',
                  header: 'loan_count',
                  cell: (r) => <code>{r.loan_count}</code>,
                  sortValue: (r) => r.loan_count,
                  align: 'right',
                  width: 140,
                },
                {
                  id: 'unique_borrowers',
                  header: 'unique_borrowers',
                  cell: (r) => <code>{r.unique_borrowers}</code>,
                  sortValue: (r) => r.unique_borrowers,
                  align: 'right',
                  width: 170,
                },
                {
                  id: 'bib',
                  header: 'bib',
                  cell: (r) => <code>{r.bibliographic_id}</code>,
                  sortValue: (r) => r.bibliographic_id,
                  width: 310,
                },
              ]}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
