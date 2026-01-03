/**
 * Inventory Workbench（/orgs/:orgId/inventory）
 *
 * 目標：把 MVP-SPEC.md 的「盤點」流程落地成可用的工作台：
 * - 開始盤點：建立 inventory session（選 location）
 * - 掃描冊條碼：記錄 inventory_scans + 更新 item.last_inventory_at
 * - 結束盤點：關閉 session（寫 audit），並產出差異清單（missing/unexpected）+ CSV
 *
 * 對應 API（操作）：
 * - POST /api/v1/orgs/:orgId/inventory/sessions
 * - GET  /api/v1/orgs/:orgId/inventory/sessions
 * - POST /api/v1/orgs/:orgId/inventory/sessions/:sessionId/scan
 * - POST /api/v1/orgs/:orgId/inventory/sessions/:sessionId/close
 *
 * 對應 API（輸出/報表）：
 * - GET /api/v1/orgs/:orgId/reports/inventory-diff?inventory_session_id=...&format=json|csv
 *
 * Auth/權限（重要）：
 * - 盤點是 staff 工作台，因此需要先在 `/orgs/:orgId/login` 登入取得 Bearer token
 * - actor_user_id 由 staff session 推導（session.user.id）
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';

import type {
  CloseInventorySessionResult,
  InventoryDiffResult,
  InventoryScanResult,
  InventorySessionWithDetails,
  Location,
} from '../../../lib/api';
import {
  closeInventorySession,
  createInventorySession,
  downloadInventoryDiffReportCsv,
  getInventoryDiffReport,
  listInventorySessions,
  listLocations,
  scanInventoryItem,
} from '../../../lib/api';
import { Alert } from '../../../components/ui/alert';
import { DataTable } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../components/ui/form';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

// OPAC 也會用到 isActiveLocation；但這裡是 staff 盤點工作台，因此仍沿用相同判斷
function isActiveLocation(location: Location) {
  return location.status === 'active';
}

/**
 * 下載文字檔（CSV）
 *
 * 我們沿用 Users CSV Import 的做法：
 * - 前端拿到文字（CSV）後，用 Blob 觸發瀏覽器下載
 * - 不需要另外做「下載端點」的跳轉頁
 */
function downloadText(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InventoryPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) staff session（登入者 / 操作者）
  // ----------------------------

  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 2) master data：locations / inventory sessions
  // ----------------------------

  const [locations, setLocations] = useState<Location[] | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const activeLocations = useMemo(() => (locations ?? []).filter(isActiveLocation), [locations]);

  const [sessions, setSessions] = useState<InventorySessionWithDetails[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // sessions filters（查詢條件）
  // - API 支援 location_id/status/limit，但 MVP UI 先前只固定抓最近 50 筆
  // - scale seed 下 sessions 可能很多；加上 filter 才能更快定位要回看的那一次盤點
  const [sessionsLocationFilter, setSessionsLocationFilter] = useState(''); // '' = all
  const [sessionsStatusFilter, setSessionsStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [sessionsLimit, setSessionsLimit] = useState('50');

  // currentSessionId：目前正在操作/查看的 session（可以是 open 或 closed）
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  const currentSession = useMemo(() => {
    if (!sessions) return null;
    if (!currentSessionId) return null;
    return sessions.find((s) => s.id === currentSessionId) ?? null;
  }, [sessions, currentSessionId]);

  // ----------------------------
  // 3) 開始新 session（表單）
  // ----------------------------

  const [newLocationId, setNewLocationId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  // ----------------------------
  // 4) 掃描狀態（session open 時）
  // ----------------------------

  const [scanBarcode, setScanBarcode] = useState('');
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<InventoryScanResult | null>(null);

  // scanHistory：保留最近 N 筆掃描結果（只做 UI 顯示，不當作權威資料）
  // - 權威資料在 DB：inventory_scans
  const [scanHistory, setScanHistory] = useState<InventoryScanResult[]>([]);

  // ----------------------------
  // 5) 關閉 session（寫 audit）
  // ----------------------------

  const [closingSession, setClosingSession] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const [closeResult, setCloseResult] = useState<CloseInventorySessionResult | null>(null);

  // ----------------------------
  // 6) 差異清單 / CSV
  // ----------------------------

  const [diff, setDiff] = useState<InventoryDiffResult | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // diffLimit：避免一次拉爆（預設 5000）
  const [diffLimit, setDiffLimit] = useState('5000');
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  // ----------------------------
  // 7) 共用訊息
  // ----------------------------

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ----------------------------
  // helpers：refresh locations/sessions
  // ----------------------------

  async function refreshLocations() {
    setLoadingLocations(true);
    setError(null);
    try {
      const result = await listLocations(params.orgId);
      setLocations(result);

      // UX：若尚未選盤點 location，就預設第一個 active location
      if (!newLocationId) {
        const first = result.find(isActiveLocation);
        if (first) setNewLocationId(first.id);
      }
    } catch (e) {
      setLocations(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingLocations(false);
    }
  }

  async function refreshSessionsList(overrides?: {
    location_id?: string; // '' = all
    status?: 'all' | 'open' | 'closed';
    limit?: number;
  }) {
    setLoadingSessions(true);
    setError(null);
    try {
      // 重要：React state 更新是「非同步」的。
      // - 像 onStartSession/onCloseSession 會先 setSessionsStatusFilter(...) 再 refresh；
      // - 若 refreshSessionsList 只讀 state，會讀到舊值，造成「UI 顯示的 filter 與實際查詢不一致」。
      // 因此這裡支援 overrides：需要立即套用的 filter 用參數傳進來，並同步更新 state。
      const effectiveLocationId =
        overrides?.location_id !== undefined ? overrides.location_id : sessionsLocationFilter;
      const effectiveStatus =
        overrides?.status !== undefined ? overrides.status : sessionsStatusFilter;

      if (overrides?.location_id !== undefined) setSessionsLocationFilter(overrides.location_id);
      if (overrides?.status !== undefined) setSessionsStatusFilter(overrides.status);
      if (overrides?.limit !== undefined) setSessionsLimit(String(overrides.limit));

      // limit：避免一次拉太多（預設 50）
      let limitNumber: number | undefined = overrides?.limit;
      if (limitNumber === undefined) {
        const trimmed = sessionsLimit.trim();
        limitNumber = trimmed ? Number.parseInt(trimmed, 10) : undefined;
        if (trimmed && !Number.isFinite(limitNumber)) {
          // 這裡不直接 throw：避免在「開始/關閉 session」這種流程中因為輸入框打錯而整個中斷。
          // - 我們回報錯誤給使用者，但仍用預設值 50 繼續。
          setError('sessions limit 必須是整數（已改用預設 50）');
          limitNumber = undefined;
        }
      }

      const result = await listInventorySessions(params.orgId, {
        ...(effectiveLocationId ? { location_id: effectiveLocationId } : {}),
        ...(effectiveStatus !== 'all' ? { status: effectiveStatus } : {}),
        ...(limitNumber ? { limit: limitNumber } : { limit: 50 }),
      });
      setSessions(result);

      // UX：確保 currentSessionId 永遠指向「清單內存在的那一筆」：
      // - 使用者改了 filter 之後，舊的 currentSessionId 可能不在清單內
      // - 這時自動切到第一筆（最新）會比顯示空白更可用
      setCurrentSessionId((prev) => {
        if (result.length === 0) return '';
        if (!prev) return result[0]!.id;
        return result.some((s) => s.id === prev) ? prev : result[0]!.id;
      });
    } catch (e) {
      setSessions(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingSessions(false);
    }
  }

  // 初次載入：抓 locations + sessions
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refreshLocations();
    void refreshSessionsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  // ----------------------------
  // handlers：start / scan / close / diff / csv
  // ----------------------------

  async function onStartSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLastScan(null);
    setScanHistory([]);
    setCloseResult(null);
    setDiff(null);

    if (!actorUserId) {
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    const locationId = newLocationId.trim();
    if (!locationId) {
      setError('請先選擇盤點 location');
      return;
    }

    setCreatingSession(true);
    try {
      const created = await createInventorySession(params.orgId, {
        actor_user_id: actorUserId,
        location_id: locationId,
        ...(newNote.trim() ? { note: newNote.trim() } : {}),
      });

      // 1) 重新抓 sessions（讓清單與統計一致）
      // UX：開始盤點後，sessions 篩選自動切到「此 location 的 open sessions」
      // - 讓新建的 session 一定會出現在清單內，也更符合櫃台實際使用（只關注正在盤點的地點）
      await refreshSessionsList({ location_id: locationId, status: 'open' });

      // 2) 切換目前 session（立即進入掃描模式）
      setCurrentSessionId(created.id);
      setSuccess(`已開始盤點：session_id=${created.id}`);

      // 3) UX：開始盤點後，把焦點移到條碼輸入框（貼近櫃台掃碼工作流）
      setTimeout(() => scanInputRef.current?.focus(), 0);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreatingSession(false);
    }
  }

  async function onScan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCloseResult(null);

    if (!actorUserId) {
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    if (!currentSession) {
      setError('請先選擇或開始一個盤點 session');
      return;
    }

    if (currentSession.closed_at) {
      setError('此盤點 session 已關閉，無法再掃描');
      return;
    }

    const trimmedBarcode = scanBarcode.trim();
    if (!trimmedBarcode) {
      setError('item_barcode 不可為空');
      return;
    }

    setScanning(true);
    try {
      const result = await scanInventoryItem(params.orgId, currentSession.id, {
        actor_user_id: actorUserId,
        item_barcode: trimmedBarcode,
      });

      setLastScan(result);

      // 只保留最近 20 筆（避免 UI 無限長）
      setScanHistory((prev) => [result, ...prev].slice(0, 20));

      // 成功後清空條碼並 focus（方便連續掃描）
      setScanBarcode('');
      scanInputRef.current?.focus();

      // sessions 清單的 scanned_count/unexpected_count 來自後端聚合：
      // - 每次 scan 後都 refresh 會比較重（尤其掃 1000 本時）
      // - MVP 先採「手動刷新」：由使用者按 Refresh 或關閉 session 後再看統計
      setSuccess(
        result.flags.location_mismatch || result.flags.status_unexpected
          ? '已掃描（但此冊可能有異常，請查看提示）'
          : '已掃描',
      );
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setScanning(false);
    }
  }

  async function onCloseSession() {
    setError(null);
    setSuccess(null);
    setLastScan(null);

    if (!actorUserId) {
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    if (!currentSession) {
      setError('請先選擇要關閉的 session');
      return;
    }

    if (currentSession.closed_at) {
      setError('此 session 已關閉');
      return;
    }

    const ok = window.confirm(
      `確認要關閉盤點 session 嗎？\n\n` +
        `session_id：${currentSession.id}\n` +
        `location：${currentSession.location_code} · ${currentSession.location_name}\n\n` +
        `關閉後將無法再掃描，但可產出差異清單與 CSV。`,
    );
    if (!ok) return;

    setClosingSession(true);
    try {
      const result = await closeInventorySession(params.orgId, currentSession.id, {
        actor_user_id: actorUserId,
        ...(closeNote.trim() ? { note: closeNote.trim() } : {}),
      });

      setCloseResult(result);
      setSuccess(`已關閉盤點：audit_event_id=${result.audit_event_id}`);

      // 重新整理 sessions 清單（讓 closed_at、統計更新）
      // UX：關閉 session 後，sessions 可能從 open → closed；
      // 若使用者先前用 status=open 篩選，關閉後會「消失」造成看不到結果。
      // 因此我們自動切回 all，確保能回看剛關閉的那一次盤點與差異清單。
      await refreshSessionsList({ status: 'all' });

      // UX：關閉後自動拉一次差異清單（讓使用者立即看到結果）
      await runDiff();
    } catch (e) {
      setCloseResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setClosingSession(false);
    }
  }

  async function runDiff() {
    setError(null);
    setSuccess(null);
    setLoadingDiff(true);

    if (!actorUserId) {
      setLoadingDiff(false);
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    if (!currentSession) {
      setLoadingDiff(false);
      setError('請先選擇一個 session');
      return;
    }

    try {
      const trimmed = diffLimit.trim();
      const limitNumber = trimmed ? Number.parseInt(trimmed, 10) : undefined;
      if (trimmed && !Number.isFinite(limitNumber)) throw new Error('limit 必須是整數');

      const result = await getInventoryDiffReport(params.orgId, {
        actor_user_id: actorUserId,
        inventory_session_id: currentSession.id,
        ...(limitNumber ? { limit: limitNumber } : {}),
      });

      setDiff(result);
      setSuccess(
        `差異清單已產出：missing=${result.missing.length} · unexpected=${result.unexpected.length}（summary missing=${result.summary.missing_count}）`,
      );
    } catch (e) {
      setDiff(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingDiff(false);
    }
  }

  async function onDownloadCsv() {
    setError(null);
    setSuccess(null);

    if (!actorUserId) {
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    if (!currentSession) {
      setError('請先選擇一個 session');
      return;
    }

    setDownloadingCsv(true);
    try {
      const trimmed = diffLimit.trim();
      const limitNumber = trimmed ? Number.parseInt(trimmed, 10) : undefined;
      if (trimmed && !Number.isFinite(limitNumber)) throw new Error('limit 必須是整數');

      const csvText = await downloadInventoryDiffReportCsv(params.orgId, {
        actor_user_id: actorUserId,
        inventory_session_id: currentSession.id,
        ...(limitNumber ? { limit: limitNumber } : {}),
      });

      const safeDate = new Date().toISOString().slice(0, 10);
      const filename = `inventory-diff-${safeDate}-${currentSession.id.slice(0, 8)}.csv`;
      downloadText(filename, csvText, 'text/csv;charset=utf-8');
      setSuccess('已下載 CSV');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setDownloadingCsv(false);
    }
  }

  // ----------------------------
  // Login gate（放在所有 hooks 之後）
  // ----------------------------

  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Inventory</h1>
          <Alert variant="info" title="載入登入狀態中…" role="status" />
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Inventory</h1>
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能操作。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </section>
      </div>
    );
  }

  // ----------------------------
  // Render
  // ----------------------------

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Inventory（盤點工作台）</h1>
        <p className="muted">
          對應 API：<code>POST /inventory/sessions</code>、<code>POST /inventory/sessions/:id/scan</code>、{' '}
          <code>POST /inventory/sessions/:id/close</code>、<code>GET /reports/inventory-diff</code>
        </p>

        <p className="muted">
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

        {loadingLocations ? <Alert variant="info" title="載入 locations 中…" role="status" /> : null}
        {loadingSessions ? <Alert variant="info" title="載入盤點 sessions 中…" role="status" /> : null}
        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}

        <div className="toolbar">
          <div className="toolbarLeft">
            <button type="button" className="btnSmall" onClick={() => void refreshSessionsList()} disabled={loadingSessions}>
              Refresh sessions
            </button>
          </div>
          <div className="toolbarRight">
            <Link href={`/orgs/${params.orgId}/audit-events`}>前往 Audit Events</Link>
          </div>
        </div>
      </section>

      {/* 選擇 session（回看/切換） */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>選擇盤點 session</h2>

        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void refreshSessionsList();
          }}
        >
          <FormSection title="篩選條件" description="用 location/status/limit 快速定位要回看的那一次盤點。">
            <div className="grid3">
              <Field label="篩選 location（選填）" htmlFor="inventory_sessions_location">
                <select
                  id="inventory_sessions_location"
                  value={sessionsLocationFilter}
                  onChange={(e) => setSessionsLocationFilter(e.target.value)}
                  disabled={loadingSessions}
                >
                  <option value="">（全部 locations）</option>
                  {(locations ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} · {l.name}
                      {l.status === 'inactive' ? '（inactive）' : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="篩選 status" htmlFor="inventory_sessions_status">
                <select
                  id="inventory_sessions_status"
                  value={sessionsStatusFilter}
                  onChange={(e) => setSessionsStatusFilter(e.target.value as 'all' | 'open' | 'closed')}
                  disabled={loadingSessions}
                >
                  <option value="all">all（全部）</option>
                  <option value="open">open（未關閉）</option>
                  <option value="closed">closed（已關閉）</option>
                </select>
              </Field>

              <Field label="limit（最近 N 筆）" htmlFor="inventory_sessions_limit" hint="預設 50">
                <input
                  id="inventory_sessions_limit"
                  value={sessionsLimit}
                  onChange={(e) => setSessionsLimit(e.target.value)}
                  placeholder="50"
                  disabled={loadingSessions}
                />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loadingSessions}>
                {loadingSessions ? '查詢中…' : '套用篩選'}
              </button>
            </FormActions>
          </FormSection>

          <FormSection title="最近 sessions（最新在最上方）" description="切換 session 後會清空掃描/差異清單的 UI 狀態。">
            <Field label="選擇 session" htmlFor="inventory_current_session_id">
              <select
                id="inventory_current_session_id"
                value={currentSessionId}
                onChange={(e) => {
                  setCurrentSessionId(e.target.value);
                  setLastScan(null);
                  setScanHistory([]);
                  setCloseResult(null);
                  setDiff(null);
                  setError(null);
                  setSuccess(null);
                }}
                disabled={!sessions || sessions.length === 0}
              >
                {!sessions || sessions.length === 0 ? <option value="">（尚無盤點 session）</option> : null}
                {(sessions ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.closed_at ? 'closed' : 'open'} · {s.location_code} · {s.started_at} · scanned={s.scanned_count} · unexpected=
                    {s.unexpected_count} · {s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </Field>

            {currentSession ? (
              <Alert variant="info" title="目前 session" role="status">
                <span style={{ wordBreak: 'break-all' }}>
                  session_id=<code>{currentSession.id}</code> · location=<code>{currentSession.location_code}</code> · started_at=
                  <code>{currentSession.started_at}</code>
                  {currentSession.closed_at ? (
                    <>
                      {' '}
                      · closed_at=<code>{currentSession.closed_at}</code>
                    </>
                  ) : null}
                </span>
              </Alert>
            ) : (
              <EmptyState title="尚未選擇 session" description="請先開始一個盤點 session。" />
            )}
          </FormSection>
        </Form>
      </section>

      {/* 開始新 session */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>開始新盤點</h2>

        <Form onSubmit={onStartSession} style={{ marginTop: 12 }}>
          <FormSection title="建立 session" description="建議一次盤點只做一個分區/書架（location）。">
            {activeLocations.length === 0 ? (
              <Alert variant="warning" title="沒有可用的 locations">
                你目前沒有任何 <code>active</code> locations。請先到 <Link href={`/orgs/${params.orgId}/locations`}>Locations</Link> 建立地點。
              </Alert>
            ) : null}

            <div className="grid2">
              <Field label="盤點 location" htmlFor="inventory_new_location_id">
                <select
                  id="inventory_new_location_id"
                  value={newLocationId}
                  onChange={(e) => setNewLocationId(e.target.value)}
                  disabled={loadingLocations || creatingSession}
                >
                  <option value="">（請選擇）</option>
                  {activeLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} · {l.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="note（選填；寫入 audit metadata）" htmlFor="inventory_new_note" hint="例：113-1 期末盤點（A 區）">
                <input
                  id="inventory_new_note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="例：113-1 期末盤點（A 區）"
                  disabled={creatingSession}
                />
              </Field>
            </div>

            <FormActions>
              <button
                type="submit"
                className="btnPrimary"
                disabled={creatingSession || loadingLocations || activeLocations.length === 0 || !newLocationId}
              >
                {creatingSession ? '建立 session 中…' : '開始盤點（Create session）'}
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </section>

      {/* 掃描工作台（只有 open session 才顯示） */}
      {currentSession && !currentSession.closed_at ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>掃描盤點（Scan）</h2>
          <p className="muted">
            本次盤點地點：{currentSession.location_code} · {currentSession.location_name}
          </p>

          <Form onSubmit={onScan} style={{ marginTop: 12 }}>
            <FormSection title="掃描" description="建議使用條碼掃描器；掃描成功後會自動清空輸入框並 focus，方便連續掃描。">
              <Field label="item_barcode（冊條碼）" htmlFor="inventory_scan_barcode" hint="例：LIB-00001234">
                <input
                  id="inventory_scan_barcode"
                  ref={(node) => {
                    scanInputRef.current = node;
                  }}
                  value={scanBarcode}
                  onChange={(e) => setScanBarcode(e.target.value)}
                  placeholder="例：LIB-00001234"
                  autoFocus
                  disabled={scanning || closingSession}
                />
              </Field>

              <FormActions>
                <button type="submit" className="btnPrimary" disabled={scanning || closingSession}>
                  {scanning ? '掃描中…' : '掃描'}
                </button>
              </FormActions>
            </FormSection>
          </Form>

          {lastScan ? (
            <div className="stack">
              <Alert variant="info" title="最近掃描" role="status">
                <code>{lastScan.item.barcode}</code> · {lastScan.item.bibliographic_title}
              </Alert>

              {lastScan.flags.location_mismatch ? (
                <Alert variant="danger" title="位置不一致">
                  系統顯示 <code>{lastScan.item.location_code}</code>，但你正在盤點 <code>{lastScan.session_location.code}</code>。
                </Alert>
              ) : null}

              {lastScan.flags.status_unexpected ? (
                <Alert variant="danger" title="狀態異常">
                  此冊狀態為 <code>{lastScan.item.status}</code>（盤點在架預期為 <code>available</code>）。
                </Alert>
              ) : null}

              {!lastScan.flags.location_mismatch && !lastScan.flags.status_unexpected ? (
                <Alert variant="success" title="在架期待符合" role="status">
                  available + location 正確
                </Alert>
              ) : null}
            </div>
          ) : null}

          {scanHistory.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p className="muted">最近 {scanHistory.length} 筆掃描紀錄（僅 UI 顯示；權威資料在 DB）</p>
              <DataTable
                rows={scanHistory}
                getRowKey={(r) => r.scan_id}
                columns={[
                  { id: 'scanned_at', header: 'scanned_at', sortValue: (r) => r.scanned_at, cell: (r) => r.scanned_at, width: 180 },
                  {
                    id: 'barcode',
                    header: 'barcode',
                    sortValue: (r) => r.item.barcode,
                    cell: (r) => <code>{r.item.barcode}</code>,
                    width: 160,
                  },
                  {
                    id: 'title',
                    header: 'title',
                    sortValue: (r) => r.item.bibliographic_title,
                    cell: (r) => r.item.bibliographic_title,
                  },
                  {
                    id: 'status',
                    header: 'status',
                    sortValue: (r) => r.item.status,
                    cell: (r) => <code>{r.item.status}</code>,
                    width: 130,
                  },
                  {
                    id: 'location',
                    header: 'location',
                    sortValue: (r) => `${r.item.location_code} ${r.item.location_name}`,
                    cell: (r) => (
                      <span className="muted">
                        {r.item.location_code} · {r.item.location_name}
                      </span>
                    ),
                    width: 220,
                  },
                  {
                    id: 'flags',
                    header: 'flags',
                    cell: (r) => (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {r.flags.location_mismatch ? <span className="badge badge--danger">location_mismatch</span> : null}
                        {r.flags.status_unexpected ? <span className="badge badge--warning">status_unexpected</span> : null}
                        {!r.flags.location_mismatch && !r.flags.status_unexpected ? <span className="badge badge--success">ok</span> : null}
                      </div>
                    ),
                    width: 220,
                  },
                ]}
              />
            </div>
          ) : null}

          <hr className="divider" />

          <h3 style={{ marginTop: 0 }}>結束盤點（Close session）</h3>
          <p className="muted">
            關閉後會寫入 <code>audit_events</code>，並可在下方產出差異清單/CSV。
          </p>

          <Form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 12 }}>
            <FormSection title="關閉 session" description="關閉後將無法再掃描；但仍可回看與匯出差異清單。">
              <Field label="note（選填；寫入 audit metadata）" htmlFor="inventory_close_note" hint="例：盤點完成（有 3 本找不到）">
                <input
                  id="inventory_close_note"
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="例：盤點完成（有 3 本找不到）"
                  disabled={closingSession}
                />
              </Field>

              <FormActions>
                <button type="button" className="btnPrimary" onClick={() => void onCloseSession()} disabled={closingSession}>
                  {closingSession ? '關閉中…' : '關閉 session'}
                </button>
              </FormActions>

              {closeResult ? (
                <Alert variant="info" title="close summary" role="status">
                  expected_available=<code>{closeResult.summary.expected_available_count}</code> · scanned=
                  <code>{closeResult.summary.scanned_count}</code> · missing=<code>{closeResult.summary.missing_count}</code> · unexpected=
                  <code>{closeResult.summary.unexpected_count}</code> · audit_event_id=<code>{closeResult.audit_event_id}</code>
                </Alert>
              ) : null}
            </FormSection>
          </Form>
        </section>
      ) : null}

      {/* 差異清單 / CSV（open/closed session 都可看；open 時結果會隨掃描變動） */}
      {currentSession ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>差異清單（Inventory Diff）</h2>
          <p className="muted">
            對應 API：<code>GET /reports/inventory-diff</code>（JSON/CSV）
          </p>

          <Form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 12 }}>
            <FormSection title="產出/匯出" description="open session 時可隨掃描刷新；closed session 可視為最終結果。">
              <Field label="limit（避免一次拉太大；預設 5000）" htmlFor="inventory_diff_limit" hint="留空代表用預設值（5000）。">
                <input
                  id="inventory_diff_limit"
                  value={diffLimit}
                  onChange={(e) => setDiffLimit(e.target.value)}
                  placeholder="5000"
                  disabled={loadingDiff || downloadingCsv}
                />
              </Field>

              <FormActions>
                <button type="button" className="btnPrimary" onClick={() => void runDiff()} disabled={loadingDiff || downloadingCsv}>
                  {loadingDiff ? '產生中…' : '產生/刷新差異清單'}
                </button>
                <button type="button" className="btnSmall" onClick={() => void onDownloadCsv()} disabled={downloadingCsv || loadingDiff}>
                  {downloadingCsv ? '下載中…' : '下載 CSV'}
                </button>
              </FormActions>

              {loadingDiff ? <Alert variant="info" title="產生差異清單中…" role="status" /> : null}
              {downloadingCsv ? <Alert variant="info" title="下載中…" role="status" /> : null}
            </FormSection>
          </Form>

          {diff ? (
            <div className="stack">
              <Alert variant="info" title="summary" role="status">
                expected_available=<code>{diff.summary.expected_available_count}</code> · scanned=<code>{diff.summary.scanned_count}</code> ·
                missing=<code>{diff.summary.missing_count}</code> · unexpected=<code>{diff.summary.unexpected_count}</code>
              </Alert>

              {/* missing */}
              <div>
                <h3 style={{ marginTop: 0 }}>在架但未掃（missing）</h3>
                <p className="muted">
                  定義：該 location 內 <code>status=available</code> 的冊，但在本 session 沒有掃到。
                </p>

                {diff.missing.length === 0 ? (
                  <EmptyState title="目前沒有 missing" description="代表「系統預期在架」的冊都有被掃到。" />
                ) : (
                  <DataTable
                    rows={diff.missing}
                    getRowKey={(r) => r.item_id}
                    columns={[
                      { id: 'barcode', header: 'barcode', sortValue: (r) => r.item_barcode, cell: (r) => <code>{r.item_barcode}</code>, width: 160 },
                      { id: 'call_number', header: 'call_number', sortValue: (r) => r.item_call_number, cell: (r) => r.item_call_number, width: 180 },
                      { id: 'title', header: 'title', sortValue: (r) => r.bibliographic_title, cell: (r) => r.bibliographic_title },
                      { id: 'last_inventory_at', header: 'last_inventory_at', sortValue: (r) => r.last_inventory_at ?? '', cell: (r) => r.last_inventory_at ?? '—', width: 180 },
                    ]}
                  />
                )}
              </div>

              {/* unexpected */}
              <div>
                <h3 style={{ marginTop: 0 }}>掃到但系統顯示非在架（unexpected）</h3>
                <p className="muted">
                  定義：本 session 掃到的冊，但 <code>status != available</code> 或系統 <code>location</code> 與盤點 location 不一致。
                </p>

                {diff.unexpected.length === 0 ? (
                  <EmptyState title="目前沒有 unexpected" description="代表掃到的冊都符合「在架」期待。" />
                ) : (
                  <DataTable
                    rows={diff.unexpected}
                    getRowKey={(r) => r.scan_id}
                    columns={[
                      { id: 'scanned_at', header: 'scanned_at', sortValue: (r) => r.scanned_at, cell: (r) => r.scanned_at, width: 180 },
                      { id: 'barcode', header: 'barcode', sortValue: (r) => r.item_barcode, cell: (r) => <code>{r.item_barcode}</code>, width: 160 },
                      { id: 'title', header: 'title', sortValue: (r) => r.bibliographic_title, cell: (r) => r.bibliographic_title },
                      { id: 'status', header: 'status', sortValue: (r) => r.item_status, cell: (r) => <code>{r.item_status}</code>, width: 130 },
                      {
                        id: 'location',
                        header: 'location',
                        sortValue: (r) => `${r.item_location_code} ${r.item_location_name}`,
                        cell: (r) => (
                          <span className="muted">
                            {r.item_location_code} · {r.item_location_name}
                          </span>
                        ),
                        width: 220,
                      },
                      {
                        id: 'flags',
                        header: 'flags',
                        cell: (r) => (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {r.location_mismatch ? <span className="badge badge--danger">location_mismatch</span> : null}
                            {r.status_unexpected ? <span className="badge badge--warning">status_unexpected</span> : null}
                          </div>
                        ),
                        width: 220,
                      },
                    ]}
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              title="尚未產生差異清單"
              description="你可以在盤點中途刷新（結果會變），或關閉 session 後產出最終清單。"
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
