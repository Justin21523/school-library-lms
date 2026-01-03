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
 * Auth/權限（重要）：
 * - 報表通常含敏感資料，因此 API 端點受 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id（查詢者）由登入者本人推導（session.user.id），不再提供下拉選擇（避免冒用）
 */

'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type { CirculationSummaryRow } from '../../../../lib/api';
import {
  downloadCirculationSummaryReportCsv,
  listCirculationSummaryReport,
} from '../../../../lib/api';
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { SkeletonTable } from '../../../../components/ui/skeleton';
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

function isoDateForFilename(iso: string) {
  return iso.slice(0, 10);
}

export default function CirculationSummaryPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) staff session（登入者 / 查詢者）
  // ----------------------------

  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const actorUserId = session?.user.id ?? '';

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
      if (!actorUserId) throw new Error('缺少 actor_user_id（請重新登入）');

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

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="流通摘要（Circulation Summary）" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader
          title="流通摘要（Circulation Summary）"
          description="這頁需要 staff 登入（StaffAuthGuard），才能查詢/下載報表。"
          actions={
            <Link className="btnSmall btnPrimary" href={`/orgs/${params.orgId}/login`}>
              前往登入
            </Link>
          }
        >
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查詢/下載。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  function setPresetDays(days: number) {
    const now = new Date();
    const d = new Date();
    d.setDate(now.getDate() - days);
    setFromLocal(toDateTimeLocalValue(d));
    setToLocal(toDateTimeLocalValue(now));
  }

  return (
    <div className="stack">
      <PageHeader
        title="流通摘要（Circulation Summary）"
        description={
          <>
            對應 API：<code>GET /api/v1/orgs/:orgId/reports/circulation-summary</code>；統計基準：<code>loans.checked_out_at</code>
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/reports/overdue`}>
              Overdue
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/reports/top-circulation`}>
              Top Circulation
            </Link>
          </>
        }
      >
        <div className="muted">
          actor_user_id（查詢者）：<code>{session.user.id}</code>（{session.user.name} / {session.user.role}）
        </div>
        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="查詢" description="from/to 以本地時間顯示；送出時轉成 ISO（UTC）供後端比較。" />

        <Form onSubmit={onSearch} style={{ marginTop: 12 }}>
          <FormSection title="條件" description="from/to 以本地時間顯示，送出時會轉成 ISO（UTC）給後端比較。">
            <div className="grid3">
              <Field label="from（本地時間顯示）" htmlFor="summary_from">
                <input
                  id="summary_from"
                  type="datetime-local"
                  value={fromLocal}
                  onChange={(e) => setFromLocal(e.target.value)}
                />
              </Field>

              <Field label="to（本地時間顯示）" htmlFor="summary_to">
                <input
                  id="summary_to"
                  type="datetime-local"
                  value={toLocal}
                  onChange={(e) => setToLocal(e.target.value)}
                />
              </Field>

              <Field label="group_by（彙總顆粒度）" htmlFor="summary_group_by">
                <select
                  id="summary_group_by"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                >
                  <option value="day">day（日）</option>
                  <option value="week">week（週）</option>
                  <option value="month">month（月）</option>
                </select>
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '查詢中…' : '查詢'}
              </button>
              <button type="button" className="btnSmall" onClick={() => void onDownloadCsv()} disabled={downloading || loading}>
                {downloading ? '下載中…' : '下載 CSV'}
              </button>

              {/* 小工具：快速切換常用期間（學校現場常用） */}
              <button type="button" className="btnSmall" onClick={() => setPresetDays(7)} disabled={loading || downloading}>
                近 7 天
              </button>
              <button type="button" className="btnSmall" onClick={() => setPresetDays(30)} disabled={loading || downloading}>
                近 30 天
              </button>
              <button type="button" className="btnSmall" onClick={() => setPresetDays(180)} disabled={loading || downloading}>
                近 180 天（約一學期）
              </button>

              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  setPresetDays(30);
                  setGroupBy('day');
                  void refresh();
                }}
                disabled={loading || downloading}
              >
                重設
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader
          title="結果"
          description={rows ? `bucket=${rows.length} · total_loans=${totalLoans}` : undefined}
        />

        {loading && !rows ? <SkeletonTable columns={2} rows={8} /> : null}

        {!loading && !rows ? <EmptyState title="尚未查詢" description="請先設定查詢條件後按「查詢」。" /> : null}

        {!loading && rows && rows.length === 0 ? (
          <EmptyState title="沒有資料" description="此期間沒有任何借出（loans.checked_out_at）。" />
        ) : null}

        {!loading && rows && rows.length > 0 ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <DataTable<CirculationSummaryRow>
              rows={rows}
              getRowKey={(r) => r.bucket_start}
              initialSort={{ columnId: 'bucket_start', direction: 'asc' }}
              sortHint="本報表一次載入全部資料；排序會即時套用在目前結果。"
              columns={[
                {
                  id: 'bucket_start',
                  header: 'bucket_start',
                  cell: (r) => <code>{r.bucket_start}</code>,
                  sortValue: (r) => r.bucket_start,
                },
                {
                  id: 'loan_count',
                  header: 'loan_count',
                  cell: (r) => <code>{r.loan_count}</code>,
                  sortValue: (r) => r.loan_count,
                  align: 'right',
                  width: 160,
                },
              ]}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
