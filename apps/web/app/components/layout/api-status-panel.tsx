/**
 * ApiStatusPanel（側邊欄：API 連線狀態）
 *
 * 使用者最常遇到的「頁面大量無法連線」其實是：
 * - API 沒啟動（或 port 不一致）
 * - API 起了，但 DB 沒起（第一個查詢就爆）
 * - 在 LAN/devcontainer 下，Web 跟 API host 不一致（localhost 指到錯的機器）
 *
 * 這個面板用 `/health` 做最小探測，並把「打到哪個 base URL」顯示出來，
 * 讓除錯能從 10 分鐘縮到 10 秒。
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import { getApiHealth } from '../../lib/api';
import { formatErrorMessage } from '../../lib/error';

type ApiStatus = 'unknown' | 'checking' | 'ok' | 'down';

function envApiBaseUrlForDisplay() {
  // 只讀 env：這在 SSR 與瀏覽器端都一致（不會造成 hydration mismatch）。
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim();
}

function autoApiBaseUrlFromWindow() {
  // 只在瀏覽器端才有 window.location。
  //
  // 重要：不要在「初次 render」就讀 window（例如 useMemo(() => ..., [])），原因是：
  // - Next.js App Router 會先在 server 端 SSR（產出 HTML）
  // - client 端再用同一份 HTML 做 hydration
  // - 若 server render 顯示 "(n/a)"、client 初次 render 卻顯示 "http://web:3001"，
  //   React 會直接噴：Minified React error #425（Text content does not match server-rendered HTML）
  //
  // 因此我們改成：初次 render 先用空字串，等 useEffect（只在 client 跑）再補上 auto 值。
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export function ApiStatusPanel() {
  // envBase：SSR/CSR 都一致，因此可直接在 render 讀取（不會造成 hydration mismatch）
  const envBase = useMemo(() => envApiBaseUrlForDisplay(), []);

  // autoBase：初次 render 一律為空（SSR/CSR 一致）；useEffect 後再填入（避免 hydration mismatch）
  const [autoBase, setAutoBase] = useState('');
  useEffect(() => {
    try {
      setAutoBase(autoApiBaseUrlFromWindow());
    } catch {
      setAutoBase('');
    }
  }, []);

  const [status, setStatus] = useState<ApiStatus>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [schemaOk, setSchemaOk] = useState<boolean | null>(null);
  const [schemaMissing, setSchemaMissing] = useState<string[] | null>(null);
  const [schemaHint, setSchemaHint] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  async function check() {
    setStatus('checking');
    setError(null);
    setDbOk(null);
    setDbError(null);
    setSchemaOk(null);
    setSchemaMissing(null);
    setSchemaHint(null);
    setSchemaError(null);
    try {
      const health = await getApiHealth();
      setStatus('ok');
      setDbOk(health.db?.ok ?? null);
      setDbError(health.db?.ok === false ? health.db?.error ?? 'DB probe failed' : null);
      if (health.schema) {
        setSchemaOk(health.schema.ok === true ? true : health.schema.ok === false ? false : null);
        setSchemaMissing('missing' in health.schema ? health.schema.missing : null);
        setSchemaHint('hint' in health.schema ? health.schema.hint : null);
        setSchemaError('error' in health.schema ? health.schema.error : null);
      }
      setLastCheckedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setStatus('down');
      setError(formatErrorMessage(e));
      setDbOk(null);
      setDbError(null);
      setSchemaOk(null);
      setSchemaMissing(null);
      setSchemaHint(null);
      setSchemaError(null);
      setLastCheckedAt(new Date().toLocaleTimeString());
    }
  }

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pill =
    status === 'ok'
      ? { className: 'statusPill statusPill--ok', label: 'OK' }
      : status === 'down'
        ? { className: 'statusPill statusPill--danger', label: 'Down' }
        : status === 'checking'
          ? { className: 'statusPill', label: '檢查中' }
          : { className: 'statusPill', label: '未知' };

  return (
    <section aria-label="API Status" className="sidebarStatusSection">
      <div className="sidebarStatusHeader">
        <div className="sidebarStatusTitle">API 狀態</div>
        <span className={pill.className}>{pill.label}</span>
      </div>

      <div className="muted" style={{ lineHeight: 1.35 }}>
        env：<code>{envBase || '(not set)'}</code>
        <br />
        auto：<code>{autoBase || '(n/a)'}</code>
        {dbOk !== null ? (
          <>
            <br />
            db：<code>{dbOk ? 'ok' : 'down'}</code>
          </>
        ) : null}
        {schemaOk !== null ? (
          <>
            <br />
            schema：<code>{schemaOk ? 'ok' : 'missing'}</code>
          </>
        ) : null}
        {lastCheckedAt ? (
          <>
            <br />
            last_check：{lastCheckedAt}
          </>
        ) : null}
      </div>

      {error ? <div className="fieldError">{error}</div> : null}
      {dbError ? <div className="fieldError">DB：{dbError}</div> : null}
      {schemaOk === false && schemaMissing ? (
        <div className="fieldError">
          Schema 缺漏：<code>{schemaMissing.join(', ')}</code>
          {schemaHint ? (
            <>
              <br />
              {schemaHint}
            </>
          ) : null}
        </div>
      ) : null}
      {schemaError ? <div className="fieldError">Schema：{schemaError}</div> : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btnSmall" onClick={() => void check()} disabled={status === 'checking'}>
          {status === 'checking' ? '檢查中…' : '重新檢查'}
        </button>
      </div>
    </section>
  );
}
