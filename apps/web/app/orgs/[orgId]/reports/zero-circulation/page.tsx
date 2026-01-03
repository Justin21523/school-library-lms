/**
 * Zero Circulation Report Page（/orgs/:orgId/reports/zero-circulation）
 *
 * 目的（US-051 零借閱清單）：
 * - 讓館員選一段期間（from/to），找出「在此期間內沒有任何借出（loans）」的書目
 * - 用於：汰舊（weeding）、館藏調整、補書決策
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/reports/zero-circulation?actor_user_id=...&from=...&to=...&limit=...&format=json|csv
 *
 * Auth/權限（重要）：
 * - 報表通常含敏感資料，因此 API 端點受 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id（查詢者）由登入者本人推導（session.user.id），不再提供下拉選擇（避免冒用）
 *
 * MVP 限制（資料模型）：
 * - USER-STORIES.md 提到「排除類型（參考書/典藏）」；但目前 DB schema 沒有 material_type/collection_type 欄位
 * - 因此本頁先提供「期間內零借閱」的核心功能；排除類型後續可擴充（例如在 bib/item 增加欄位或 tag）
 */

'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type { ZeroCirculationReportRow } from '../../../../lib/api';
import { downloadZeroCirculationReportCsv, listZeroCirculationReport } from '../../../../lib/api';
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
 */
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

export default function ZeroCirculationReportPage({ params }: { params: { orgId: string } }) {
  // Staff session：reports 端點受 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：報表查詢者（actor_user_id），由登入者本人推導。
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 2) filters（from/to/limit）
  // ----------------------------

  // 預設期間：近 1 年（到現在）
  // - 零借閱清單通常會看較長區間（例如 1~2 年）
  const [fromLocal, setFromLocal] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return toDateTimeLocalValue(d);
  });
  const [toLocal, setToLocal] = useState(() => toDateTimeLocalValue(new Date()));

  const [limit, setLimit] = useState('200');

  // ----------------------------
  // 3) data + state
  // ----------------------------

  const [rows, setRows] = useState<ZeroCirculationReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rankByBibId = useMemo(() => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r, idx) => m.set(r.bibliographic_id, idx + 1));
    return m;
  }, [rows]);

  // 登入門檻：未登入就不顯示報表 UI，避免一直撞 401/403。
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Zero Circulation</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Zero Circulation</h1>
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查詢/下載。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </section>
      </div>
    );
  }

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

      const result = await listZeroCirculationReport(params.orgId, {
        actor_user_id: actorUserId,
        from: fromIso,
        to: toIso,
        limit: limitNumber,
      });

      setRows(result);
      setSuccess(`已載入零借閱清單：${result.length} 筆`);
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

      const csv = await downloadZeroCirculationReportCsv(params.orgId, {
        actor_user_id: actorUserId,
        from: fromIso,
        to: toIso,
        limit: limitNumber,
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const filename = `zero-circulation-${isoDateForFilename(fromIso)}-${isoDateForFilename(toIso)}.csv`;

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
        <h1 style={{ marginTop: 0 }}>Zero Circulation</h1>

        <p className="muted">
          對應 API：<code>GET /api/v1/orgs/:orgId/reports/zero-circulation</code>
        </p>

        <p className="muted">
          本報表以「書目」為單位：只要該書目在選定期間內沒有任何借出，就會列入清單（多冊也一樣）。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/orgs/${params.orgId}/reports/top-circulation`}>→ Top Circulation</Link>
          <Link href={`/orgs/${params.orgId}/reports/circulation-summary`}>→ Circulation Summary</Link>
          <Link href={`/orgs/${params.orgId}/reports/ready-holds`}>→ Ready Holds</Link>
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
          <FormSection title="條件" description="zero-circulation 會找出「期間內完全沒有借出」的書目清單。">
            <div className="grid3">
              <Field label="from（本地時間顯示）" htmlFor="zero_from">
                <input
                  id="zero_from"
                  type="datetime-local"
                  value={fromLocal}
                  onChange={(e) => setFromLocal(e.target.value)}
                />
              </Field>

              <Field label="to（本地時間顯示）" htmlFor="zero_to">
                <input id="zero_to" type="datetime-local" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
              </Field>

              <Field label="limit（預設 200）" htmlFor="zero_limit">
                <input id="zero_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '查詢中…' : '查詢'}
              </button>
              <button type="button" className="btnSmall" onClick={() => void onDownloadCsv()} disabled={downloading || loading}>
                {downloading ? '下載中…' : '下載 CSV'}
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>

        {loading && !rows ? <SkeletonTable columns={8} rows={8} /> : null}

        {!loading && !rows ? <EmptyState title="尚未查詢" description="請先設定查詢條件後按「查詢」。" /> : null}

        {!loading && rows && rows.length === 0 ? (
          <EmptyState title="沒有資料" description="此期間內每本書都至少借出過一次。" />
        ) : null}

        {!loading && rows && rows.length > 0 ? (
          <DataTable
            rows={rows}
            getRowKey={(r) => r.bibliographic_id}
            initialSort={{ columnId: 'last_checked_out_at', direction: 'asc' }}
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
                id: 'classification',
                header: 'classification',
                cell: (r) => <span className="muted">{r.classification ?? '—'}</span>,
                sortValue: (r) => r.classification ?? null,
                width: 160,
              },
              {
                id: 'isbn',
                header: 'isbn',
                cell: (r) => <span className="muted">{r.isbn ?? '—'}</span>,
                sortValue: (r) => r.isbn ?? null,
                width: 190,
              },
              {
                id: 'total_items',
                header: 'total_items',
                cell: (r) => <code>{r.total_items}</code>,
                sortValue: (r) => r.total_items,
                align: 'right',
                width: 140,
              },
              {
                id: 'available_items',
                header: 'available_items',
                cell: (r) => <code>{r.available_items}</code>,
                sortValue: (r) => r.available_items,
                align: 'right',
                width: 170,
              },
              {
                id: 'last_checked_out_at',
                header: 'last_checked_out_at',
                cell: (r) => <code>{r.last_checked_out_at ?? '—'}</code>,
                sortValue: (r) => r.last_checked_out_at,
                width: 200,
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
        ) : null}
      </section>
    </div>
  );
}
