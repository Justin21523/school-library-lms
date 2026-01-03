/**
 * Ready Holds Report Page（/orgs/:orgId/reports/ready-holds）
 *
 * 目的（最貼近學校現場的每日工作）：
 * - 取書架清單：列出「目前可取書（holds.status=ready）」的保留
 * - 讓館員能：
 *   1) 對照取書架上的書：要給誰（讀者）、什麼書、哪一冊（barcode）
 *   2) 找出「已過期但仍在 ready」的保留（提醒跑 Holds Maintenance）
 *   3) 匯出 CSV 或列印小條（紙本工作流仍很常見）
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/reports/ready-holds?actor_user_id=...&as_of=...&pickup_location_id=...&limit=...&format=json|csv
 *
 * Auth/權限（重要）：
 * - 報表可能包含敏感資訊（讀者名單、借閱行為線索），因此 API 端點受 StaffAuthGuard 保護
 * - actor_user_id（查詢者）由登入者本人推導（session.user.id），不再提供下拉選擇（避免冒用）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { Location, ReadyHoldsReportRow } from '../../../../lib/api';
import { downloadReadyHoldsReportCsv, listLocations, listReadyHoldsReport } from '../../../../lib/api';
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { SkeletonTable } from '../../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

// location 也可能被停用；報表通常只看 active 即可，但仍提供「全部」選項。
function isActiveLocation(location: Location) {
  return location.status === 'active';
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
 * - 轉成 ISO 後，後端用 timestamptz 正確比較 ready_until 與 as_of
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

/**
 * 小工具：HTML escape（用在列印小條的 HTML 模板）
 *
 * - 我們的資料來源是 DB，但仍不建議把原字串直接塞進 HTML
 * - 這裡做最基本的 escape，避免意外字元破壞版面或造成 XSS 風險
 */
function escapeHtml(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDaysLabel(days: number | null) {
  if (days === null) return '（未知）';
  if (days < 0) return `已過期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天到期';
  return `剩餘 ${days} 天`;
}

function buildSlipHtml(options: {
  orgId: string;
  asOfIso: string;
  pickupLocationLabel: string;
  rows: ReadyHoldsReportRow[];
}) {
  const { asOfIso, pickupLocationLabel, rows } = options;

  // 列印策略：
  // - 使用「白底黑字」避免深色主題印出來浪費墨水
  // - 每張小條用 border 分隔，並用 page-break-inside 避免被切半
  // - 這是 MVP 版本的「最小可用列印」，後續可再做條碼/版面尺寸設定
  const style = `
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 12mm; color: #111; }
    h1 { font-size: 16pt; margin: 0 0 6mm 0; }
    .meta { margin: 0 0 8mm 0; font-size: 10pt; color: #333; }
    .grid { display: grid; gap: 6mm; }
    .slip { border: 1px solid #111; border-radius: 6px; padding: 6mm; page-break-inside: avoid; }
    .title { font-size: 14pt; font-weight: 700; margin-bottom: 2mm; }
    .row { font-size: 11pt; margin: 1mm 0; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10pt; color: #333; }
    .danger { color: #b00020; font-weight: 700; }
    @media print {
      body { margin: 0; }
      .slip { break-inside: avoid; }
    }
  `;

  const slips = rows
    .map((r) => {
      const title = escapeHtml(r.bibliographic_title);
      const who = `${escapeHtml(r.user_name)}（${escapeHtml(r.user_external_id)}）`;
      const orgUnit = r.user_org_unit ? escapeHtml(r.user_org_unit) : '';
      const barcode = r.assigned_item_barcode ? escapeHtml(r.assigned_item_barcode) : '（無冊條碼）';
      const callNumber = r.assigned_item_call_number ? escapeHtml(r.assigned_item_call_number) : '';
      const pickup = `${escapeHtml(r.pickup_location_name)}（${escapeHtml(r.pickup_location_code)}）`;
      const readyUntil = r.ready_until ? escapeHtml(r.ready_until) : '（未知）';
      const days = formatDaysLabel(r.days_until_expire);
      const statusLabel = r.is_expired ? `<span class="danger">${escapeHtml(days)}</span>` : escapeHtml(days);

      return `
        <section class="slip">
          <div class="title">取書保留單（Ready Hold）</div>
          <div class="row"><b>書名：</b>${title}</div>
          <div class="row"><b>讀者：</b>${who}${orgUnit ? ` · <b>班級/單位：</b>${orgUnit}` : ''}</div>
          <div class="row"><b>冊條碼：</b>${barcode}${callNumber ? ` · <b>索書號：</b>${callNumber}` : ''}</div>
          <div class="row"><b>取書地點：</b>${pickup}</div>
          <div class="row"><b>取書期限：</b>${readyUntil} · ${statusLabel}</div>
          <div class="mono">hold_id=${escapeHtml(r.hold_id)}</div>
        </section>
      `;
    })
    .join('\n');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ready Holds</title>
        <style>${style}</style>
      </head>
      <body>
        <h1>取書架清單（Ready Holds）小條</h1>
        <p class="meta">as_of=${escapeHtml(asOfIso)} · pickup_location=${escapeHtml(pickupLocationLabel)} · count=${rows.length}</p>
        <div class="grid">${slips || '<p>（沒有資料）</p>'}</div>
        <script>
          // 等 DOM 就緒後自動呼叫列印；讓館員一鍵列印更順手
          window.addEventListener('load', () => { window.focus(); window.print(); });
        </script>
      </body>
    </html>
  `;
}

export default function ReadyHoldsReportPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) staff session（登入者 / 查詢者）
  // ----------------------------

  // reports 端點受 StaffAuthGuard 保護，因此需要先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：報表查詢者（actor_user_id），由登入者本人推導。
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 2) locations（取書地點）資料
  // ----------------------------

  const [locations, setLocations] = useState<Location[] | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const activeLocations = useMemo(() => (locations ?? []).filter(isActiveLocation), [locations]);

  // ----------------------------
  // 3) filters（as_of / pickup_location_id / limit）
  // ----------------------------

  // asOfLocal：預設現在；用本地時間顯示，送 API 時轉成 ISO（UTC）
  const [asOfLocal, setAsOfLocal] = useState(() => toDateTimeLocalValue(new Date()));

  // pickupLocationId：
  // - 空字串代表「全部」
  // - 其他則是 location UUID
  const [pickupLocationId, setPickupLocationId] = useState('');

  const [limit, setLimit] = useState('200');

  // ----------------------------
  // 4) data + 狀態（查詢/下載/列印）
  // ----------------------------

  const [rows, setRows] = useState<ReadyHoldsReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 初次載入：抓 locations（讓你選取書地點）
  useEffect(() => {
    // 未登入時不抓資料；避免一進頁面就撞 401/403 造成困惑。
    if (!sessionReady || !session) return;

    async function run() {
      setLoadingLocations(true);
      setError(null);

      try {
        const locationsResult = await listLocations(params.orgId);
        setLocations(locationsResult);

        // 若尚未選取書地點：
        // - 有 active location → 預設第一個（常見情境：學校只有一個取書櫃台/圖書館）
        // - 沒有 active → 留空代表全部（或等待你建立 location）
        if (!pickupLocationId) {
          const firstActive = locationsResult.find(isActiveLocation);
          if (firstActive) setPickupLocationId(firstActive.id);
        }
      } catch (e) {
        setLocations(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoadingLocations(false);
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  function buildRequestFilters() {
    // 由於本頁端點受 StaffAuthGuard 保護，未登入不應走到這裡；此檢查是保險用。
    if (!actorUserId) throw new Error('缺少 actor_user_id（請重新登入）');

    // as_of：把本地 datetime-local 轉成 ISO（UTC）
    const asOfIso = fromDateTimeLocalToIso(asOfLocal);
    if (!asOfIso) throw new Error('as_of 格式不正確（請重新選擇日期時間）');

    // limit：空字串視為未提供；否則轉 int
    const trimmedLimit = limit.trim();
    const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
    if (trimmedLimit && !Number.isFinite(limitNumber)) throw new Error('limit 必須是整數');

    return {
      asOfIso,
      filters: {
        actor_user_id: actorUserId,
        as_of: asOfIso,
        ...(pickupLocationId ? { pickup_location_id: pickupLocationId } : {}),
        ...(limitNumber ? { limit: limitNumber } : {}),
      },
    };
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { filters } = buildRequestFilters();
      const result = await listReadyHoldsReport(params.orgId, filters);
      setRows(result);

      const expiredCount = result.filter((r) => r.is_expired).length;
      if (result.length === 0) {
        setSuccess('目前沒有 ready holds（取書架清單為空）。');
      } else if (expiredCount > 0) {
        setSuccess(`已載入取書架清單：${result.length} 筆（其中 ${expiredCount} 筆已過期；建議跑 Holds Maintenance）`);
      } else {
        setSuccess(`已載入取書架清單：${result.length} 筆`);
      }
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
      const { asOfIso, filters } = buildRequestFilters();

      // 1) 先把 CSV 內容抓回來（文字）
      const csv = await downloadReadyHoldsReportCsv(params.orgId, filters);

      // 2) 轉成 Blob → 觸發下載
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const fileDate = isoDateForFilename(asOfIso);
      const pickupSuffix = pickupLocationId ? `-${pickupLocationId.slice(0, 8)}` : '';
      const filename = `ready-holds-${fileDate}${pickupSuffix}.csv`;

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

  async function onPrintSlips() {
    // UX：列印會開新視窗（避免 popup blocker），因此先同步開窗，再做 async fetch
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) {
      setError('瀏覽器阻擋開新視窗，請允許此網站開啟彈出視窗後再試一次。');
      return;
    }

    setPrinting(true);
    setError(null);
    setSuccess(null);

    // 先塞一個 loading 畫面，避免新視窗一片空白造成困惑
    win.document.open();
    win.document.write('<p style="font-family: system-ui; padding: 16px;">Loading…</p>');
    win.document.close();

    try {
      const { asOfIso, filters } = buildRequestFilters();

      // 列印用的資料：以「當下 filters 再抓一次」確保最新（而不是用可能過時的 state）
      const result = await listReadyHoldsReport(params.orgId, filters);

      const pickupLabel = pickupLocationId
        ? (() => {
            const loc = (locations ?? []).find((l) => l.id === pickupLocationId);
            if (!loc) return pickupLocationId;
            return `${loc.name} (${loc.code})`;
          })()
        : 'ALL';

      const html = buildSlipHtml({
        orgId: params.orgId,
        asOfIso,
        pickupLocationLabel: pickupLabel,
        rows: result,
      });

      win.document.open();
      win.document.write(html);
      win.document.close();
      setSuccess(`已開啟列印小條：${result.length} 筆`);
    } catch (e) {
      // 若列印資料抓取失敗：關掉新視窗，避免留下空白頁
      try {
        win.close();
      } catch {
        // ignore
      }
      setError(formatErrorMessage(e));
    } finally {
      setPrinting(false);
    }
  }

  const expiredCount = useMemo(() => {
    if (!rows) return 0;
    return rows.filter((r) => r.is_expired).length;
  }, [rows]);

  const rankByHoldId = useMemo(() => {
    // 與其他報表一致：把 API 回傳的原始順序固定成 rank，避免使用者切換排序後順位語意混亂。
    const m = new Map<string, number>();
    (rows ?? []).forEach((r, idx) => m.set(r.hold_id, idx + 1));
    return m;
  }, [rows]);

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="可取書預約（Ready Holds）" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader
          title="可取書預約（Ready Holds）"
          description="這頁需要 staff 登入（StaffAuthGuard），才能查詢/下載/列印報表。"
          actions={
            <Link className="btnSmall btnPrimary" href={`/orgs/${params.orgId}/login`}>
              前往登入
            </Link>
          }
        >
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查詢/下載/列印。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="可取書預約（Ready Holds）"
        description={
          <>
            對應 API：<code>GET /api/v1/orgs/:orgId/reports/ready-holds</code>
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/holds`}>
              Holds 工作台
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/holds/maintenance`}>
              Holds Maintenance
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/reports/overdue`}>
              Overdue
            </Link>
          </>
        }
      >
        <div className="muted">
          actor_user_id（查詢者）：<code>{session.user.id}</code>（{session.user.name} / {session.user.role}）
        </div>
        <Alert variant="info" title="提醒">
          若清單中出現「已過期」的 hold，代表它仍卡在 <code>status=ready</code>（尚未跑到期處理）。你可以到{' '}
          <Link href={`/orgs/${params.orgId}/holds/maintenance`}>Holds Maintenance</Link> 先 preview 再 apply。
        </Alert>
        {loadingLocations ? <Alert variant="info" title="載入 locations 中…" role="status" /> : null}
        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="查詢" description="as_of 以本地時間顯示；送出時轉成 ISO（UTC）供後端推導逾期/剩餘天數。" />

        <Form onSubmit={onSearch} style={{ marginTop: 12 }}>
          <FormSection title="條件" description="as_of 以本地時間顯示，送出時會轉成 ISO（UTC）給後端推導逾期/剩餘天數。">
            <div className="grid3">
              <Field label="as_of（基準時間，本地時間顯示）" htmlFor="ready_as_of">
                <input
                  id="ready_as_of"
                  type="datetime-local"
                  value={asOfLocal}
                  onChange={(e) => setAsOfLocal(e.target.value)}
                />
              </Field>

              <Field
                label="pickup_location_id（取書地點）"
                htmlFor="ready_pickup_location_id"
                hint={activeLocations.length === 0 ? '尚未建立可用 location；可先到 Locations 建立。' : undefined}
              >
                <select
                  id="ready_pickup_location_id"
                  value={pickupLocationId}
                  onChange={(e) => setPickupLocationId(e.target.value)}
                >
                  <option value="">（全部）</option>
                  {activeLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="limit（預設 200）" htmlFor="ready_limit">
                <input id="ready_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '查詢中…' : '查詢'}
              </button>
              <button type="button" className="btnSmall" onClick={() => void onDownloadCsv()} disabled={downloading || loading}>
                {downloading ? '下載中…' : '下載 CSV'}
              </button>
              <button type="button" className="btnPrimary" onClick={() => void onPrintSlips()} disabled={printing || loading || downloading}>
                {printing ? '產生列印中…' : '列印小條'}
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="結果" description={rows ? `count=${rows.length} · expired=${expiredCount}` : undefined} />

        {loading && !rows ? <SkeletonTable columns={8} rows={8} /> : null}

        {!loading && !rows ? <EmptyState title="尚未查詢" description="請先設定查詢條件後按「查詢」。" /> : null}

        {!loading && rows && rows.length === 0 ? <EmptyState title="沒有資料" description="目前沒有 ready holds。" /> : null}

        {!loading && rows && rows.length > 0 ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <DataTable<ReadyHoldsReportRow>
              rows={rows}
              getRowKey={(r) => r.hold_id}
              initialSort={{ columnId: 'rank', direction: 'asc' }}
              sortHint="本報表一次載入全部資料；排序會即時套用在目前結果。"
              columns={[
                {
                  id: 'rank',
                  header: '#（API rank）',
                  cell: (r) => <code>{rankByHoldId.get(r.hold_id) ?? '—'}</code>,
                  sortValue: (r) => rankByHoldId.get(r.hold_id) ?? 0,
                  align: 'right',
                  width: 120,
                },
                {
                  id: 'pickup',
                  header: 'pickup',
                  cell: (r) => (
                    <span className="muted">
                      {r.pickup_location_name} ({r.pickup_location_code})
                    </span>
                  ),
                  sortValue: (r) => `${r.pickup_location_code} ${r.pickup_location_name}`,
                  width: 200,
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
                  id: 'borrower',
                  header: 'borrower',
                  cell: (r) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div>
                        {r.user_name} <span className="muted">({r.user_external_id})</span>
                      </div>
                      {r.user_org_unit ? <div className="muted">{r.user_org_unit}</div> : <div className="muted">—</div>}
                    </div>
                  ),
                  sortValue: (r) => r.user_external_id,
                  width: 220,
                },
                {
                  id: 'item',
                  header: 'item',
                  cell: (r) => (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div>
                        {r.assigned_item_id && r.assigned_item_barcode ? (
                          <Link href={`/orgs/${params.orgId}/items/${r.assigned_item_id}`}>{r.assigned_item_barcode}</Link>
                        ) : r.assigned_item_barcode ? (
                          <span>{r.assigned_item_barcode}</span>
                        ) : (
                          <span className="muted">（no item）</span>
                        )}
                      </div>
                      <div className="muted">{r.assigned_item_call_number ?? '—'}</div>
                    </div>
                  ),
                  sortValue: (r) => r.assigned_item_barcode ?? '',
                  width: 200,
                },
                {
                  id: 'ready_until',
                  header: 'ready_until',
                  cell: (r) => <code>{r.ready_until ?? '—'}</code>,
                  sortValue: (r) => r.ready_until ?? '',
                  width: 210,
                },
                {
                  id: 'days',
                  header: 'days',
                  cell: (r) => (
                    <span className={['badge', r.is_expired ? 'badge--danger' : r.days_until_expire === 0 ? 'badge--warning' : 'badge--info'].join(' ')}>
                      {formatDaysLabel(r.days_until_expire)}
                    </span>
                  ),
                  sortValue: (r) => (r.days_until_expire ?? 999999),
                  align: 'right',
                  width: 160,
                },
                {
                  id: 'hold_id',
                  header: 'hold_id',
                  cell: (r) => <code>{r.hold_id}</code>,
                  sortValue: (r) => r.hold_id,
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
