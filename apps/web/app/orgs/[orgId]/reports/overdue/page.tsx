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
 * Auth/權限（重要）：
 * - 報表通常含敏感資料，因此 API 端點受 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id 仍保留在 query（作為「查詢者」），但由登入者本人推導（session.user.id）
 * - StaffAuthGuard 會驗證：actor_user_id 必須等於 token.sub（避免冒用）
 */

'use client';

import { useState } from 'react';

import Link from 'next/link';

import type { OverdueReportRow } from '../../../../lib/api';
import { downloadOverdueReportCsv, listOverdueReport } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

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
  // Staff session：reports 端點受 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：報表查詢者（actor_user_id），由登入者本人推導。
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 1) filters（as_of / org_unit / limit）
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

  // 登入門檻：未登入就不顯示報表 UI，避免一直撞 401/403。
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Overdue Report</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Overdue Report</h1>
          <p className="error">
            這頁需要 staff 登入才能查詢/下載。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
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
      if (!actorUserId) throw new Error('缺少 actor_user_id（請重新登入）');

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
