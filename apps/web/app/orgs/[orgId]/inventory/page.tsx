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
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Inventory</h1>
          <p className="error">
            這頁需要 staff 登入才能操作。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
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

        {loadingLocations ? <p className="muted">載入 locations 中…</p> : null}
        {loadingSessions ? <p className="muted">載入盤點 sessions 中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => void refreshSessionsList()} disabled={loadingSessions}>
            Refresh sessions
          </button>
          <Link href={`/orgs/${params.orgId}/audit-events`}>前往 Audit Events</Link>
        </div>
      </section>

      {/* 選擇 session（回看/切換） */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>選擇盤點 session</h2>

        {/* sessions filters：小缺口補齊（location/status） */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void refreshSessionsList();
          }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}
        >
          <label>
            篩選 location（選填）
            <select value={sessionsLocationFilter} onChange={(e) => setSessionsLocationFilter(e.target.value)}>
              <option value="">（全部 locations）</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.name}
                  {l.status === 'inactive' ? '（inactive）' : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            篩選 status
            <select
              value={sessionsStatusFilter}
              onChange={(e) => setSessionsStatusFilter(e.target.value as 'all' | 'open' | 'closed')}
            >
              <option value="all">all（全部）</option>
              <option value="open">open（未關閉）</option>
              <option value="closed">closed（已關閉）</option>
            </select>
          </label>

          <label>
            limit（最近 N 筆）
            <input value={sessionsLimit} onChange={(e) => setSessionsLimit(e.target.value)} placeholder="50" />
          </label>

          <button type="submit" disabled={loadingSessions}>
            {loadingSessions ? '查詢中…' : '套用篩選'}
          </button>
        </form>

        <label>
          最近 sessions（最新在最上方）
          <select
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
        </label>

        {currentSession ? (
          <div className="muted" style={{ marginTop: 12, wordBreak: 'break-all' }}>
            session_id=<code>{currentSession.id}</code> · location={currentSession.location_code} · started_at=
            {currentSession.started_at}
            {currentSession.closed_at ? ` · closed_at=${currentSession.closed_at}` : ''}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            請先開始一個盤點 session。
          </p>
        )}
      </section>

      {/* 開始新 session */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>開始新盤點</h2>

        <form onSubmit={onStartSession} className="stack" style={{ marginTop: 12 }}>
          <label>
            盤點 location（建議一次盤點只做一個分區/書架）
            <select
              value={newLocationId}
              onChange={(e) => setNewLocationId(e.target.value)}
              disabled={loadingLocations}
            >
              <option value="">（請選擇）</option>
              {activeLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            note（選填；寫入 audit metadata）
            <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="例：113-1 期末盤點（A 區）" />
          </label>

          <button type="submit" disabled={creatingSession}>
            {creatingSession ? '建立 session 中…' : '開始盤點（Create session）'}
          </button>
        </form>
      </section>

      {/* 掃描工作台（只有 open session 才顯示） */}
      {currentSession && !currentSession.closed_at ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>掃描盤點（Scan）</h2>
          <p className="muted">
            本次盤點地點：{currentSession.location_code} · {currentSession.location_name}
          </p>

          <form onSubmit={onScan} className="stack" style={{ marginTop: 12 }}>
            <label>
              item_barcode（冊條碼）
              <input
                ref={(node) => {
                  scanInputRef.current = node;
                }}
                value={scanBarcode}
                onChange={(e) => setScanBarcode(e.target.value)}
                placeholder="例：LIB-00001234"
                autoFocus
              />
            </label>
            <button type="submit" disabled={scanning}>
              {scanning ? '掃描中…' : '掃描'}
            </button>
          </form>

          {lastScan ? (
            <div style={{ marginTop: 12 }}>
              <p className="muted" style={{ marginBottom: 6 }}>
                最近掃描：{lastScan.item.barcode} · {lastScan.item.bibliographic_title}
              </p>

              {lastScan.flags.location_mismatch ? (
                <p className="error">
                  位置不一致：系統顯示 <code>{lastScan.item.location_code}</code>，但你正在盤點{' '}
                  <code>{lastScan.session_location.code}</code>
                </p>
              ) : null}

              {lastScan.flags.status_unexpected ? (
                <p className="error">
                  狀態異常：此冊狀態為 <code>{lastScan.item.status}</code>（盤點在架預期為 <code>available</code>）
                </p>
              ) : null}

              {!lastScan.flags.location_mismatch && !lastScan.flags.status_unexpected ? (
                <p className="success">此冊符合在架期待（available + location 正確）</p>
              ) : null}
            </div>
          ) : null}

          {scanHistory.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p className="muted">最近 {scanHistory.length} 筆掃描紀錄（僅 UI 顯示；權威資料在 DB）</p>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>scanned_at</th>
                      <th>barcode</th>
                      <th>title</th>
                      <th>status</th>
                      <th>location</th>
                      <th>flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanHistory.map((s) => (
                      <tr key={s.scan_id}>
                        <td>{s.scanned_at}</td>
                        <td>
                          <code>{s.item.barcode}</code>
                        </td>
                        <td>{s.item.bibliographic_title}</td>
                        <td>
                          <code>{s.item.status}</code>
                        </td>
                        <td>
                          {s.item.location_code} · {s.item.location_name}
                        </td>
                        <td>
                          {s.flags.location_mismatch ? 'location_mismatch ' : ''}
                          {s.flags.status_unexpected ? 'status_unexpected' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <h3 style={{ marginTop: 0 }}>結束盤點（Close session）</h3>
          <p className="muted">
            關閉後會寫入 <code>audit_events</code>，並可在下方產出差異清單/CSV。
          </p>

          <label>
            note（選填；寫入 audit metadata）
            <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="例：盤點完成（有 3 本找不到）" />
          </label>

          <button type="button" onClick={() => void onCloseSession()} disabled={closingSession}>
            {closingSession ? '關閉中…' : '關閉 session'}
          </button>

          {closeResult ? (
            <p className="muted" style={{ marginTop: 12 }}>
              close summary：expected_available={closeResult.summary.expected_available_count} · scanned=
              {closeResult.summary.scanned_count} · missing={closeResult.summary.missing_count} · unexpected=
              {closeResult.summary.unexpected_count} · audit_event_id={closeResult.audit_event_id}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 差異清單 / CSV（open/closed session 都可看；open 時結果會隨掃描變動） */}
      {currentSession ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>差異清單（Inventory Diff）</h2>
          <p className="muted">
            對應 API：<code>GET /reports/inventory-diff</code>（JSON/CSV）
          </p>

          <label>
            limit（避免一次拉太大；預設 5000）
            <input value={diffLimit} onChange={(e) => setDiffLimit(e.target.value)} placeholder="5000" />
          </label>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" onClick={() => void runDiff()} disabled={loadingDiff}>
              {loadingDiff ? '產生中…' : '產生/刷新差異清單'}
            </button>
            <button type="button" onClick={() => void onDownloadCsv()} disabled={downloadingCsv}>
              {downloadingCsv ? '下載中…' : '下載 CSV'}
            </button>
          </div>

          {diff ? (
            <div style={{ marginTop: 12 }}>
              <p className="muted">
                summary：expected_available={diff.summary.expected_available_count} · scanned={diff.summary.scanned_count} · missing=
                {diff.summary.missing_count} · unexpected={diff.summary.unexpected_count}
              </p>

              {/* missing */}
              <h3 style={{ marginTop: 16 }}>在架但未掃（missing）</h3>
              <p className="muted">
                定義：該 location 內 <code>status=available</code> 的冊，但在本 session 沒有掃到。
              </p>

              {diff.missing.length === 0 ? (
                <p className="muted">（目前沒有 missing）</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>barcode</th>
                        <th>call_number</th>
                        <th>title</th>
                        <th>last_inventory_at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.missing.map((r) => (
                        <tr key={r.item_id}>
                          <td>
                            <code>{r.item_barcode}</code>
                          </td>
                          <td>{r.item_call_number}</td>
                          <td>{r.bibliographic_title}</td>
                          <td>{r.last_inventory_at ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* unexpected */}
              <h3 style={{ marginTop: 16 }}>掃到但系統顯示非在架（unexpected）</h3>
              <p className="muted">
                定義：本 session 掃到的冊，但 <code>status != available</code> 或系統 <code>location</code> 與盤點 location 不一致。
              </p>

              {diff.unexpected.length === 0 ? (
                <p className="muted">（目前沒有 unexpected）</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>scanned_at</th>
                        <th>barcode</th>
                        <th>title</th>
                        <th>status</th>
                        <th>location</th>
                        <th>flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.unexpected.map((r) => (
                        <tr key={r.scan_id}>
                          <td>{r.scanned_at}</td>
                          <td>
                            <code>{r.item_barcode}</code>
                          </td>
                          <td>{r.bibliographic_title}</td>
                          <td>
                            <code>{r.item_status}</code>
                          </td>
                          <td>
                            {r.item_location_code} · {r.item_location_name}
                          </td>
                          <td>
                            {r.location_mismatch ? 'location_mismatch ' : ''}
                            {r.status_unexpected ? 'status_unexpected' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              尚未產生差異清單。你可以在盤點中途刷新（結果會變），或關閉 session 後產出最終清單。
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
