/**
 * StaffSessionPanel（側邊欄：登入狀態）
 *
 * 使用者回報「權威控制 / MARC 頁面進不去」時，最常見的根因是：
 * - 尚未 staff login（沒有 Bearer token）
 * - token 已過期（localStorage 還留著，但 API 會 401）
 *
 * 這個小面板放在 OrgShell sidebar footer，讓使用者不用猜：
 * - 目前是否已登入（誰、角色）
 * - 何時過期
 * - 一鍵前往 Login/Logout
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { StaffSession } from '../../lib/staff-session';
import { clearStaffSession, loadStaffSession } from '../../lib/staff-session';

function isExpired(expiresAtIso: string) {
  const ms = Date.parse(expiresAtIso);
  if (Number.isNaN(ms)) return true;
  return ms <= Date.now();
}

function toLocalTimeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function StaffSessionPanel({ orgId }: { orgId: string }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StaffSession | null>(null);

  // 讀取 localStorage：並監聽 storage（讓其他 tab 的 login/logout 也能同步反映）
  useEffect(() => {
    function sync() {
      const loaded = loadStaffSession(orgId);
      if (loaded && isExpired(loaded.expires_at)) {
        clearStaffSession(orgId);
        setSession(null);
        setReady(true);
        return;
      }

      setSession(loaded);
      setReady(true);
    }

    sync();
    function onStorage(e: StorageEvent) {
      // key 為 null 代表 clear()；保守起見也同步一次
      if (e.key === null || e.key === `library_system_staff_session:${orgId}`) sync();
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [orgId]);

  const expiresLabel = useMemo(() => (session ? toLocalTimeLabel(session.expires_at) : null), [session]);

  return (
    <section aria-label="Staff Session" className="sidebarStatusSection">
      <div className="sidebarStatusHeader">
        <div className="sidebarStatusTitle">登入狀態</div>
        {ready && session ? <span className="statusPill statusPill--ok">已登入</span> : ready ? <span className="statusPill statusPill--warn">未登入</span> : <span className="statusPill">讀取中</span>}
      </div>

      {!ready ? <div className="muted">載入中…</div> : null}

      {ready && session ? (
        <div className="muted" style={{ lineHeight: 1.35 }}>
          {session.user.name}（{session.user.role}） · {session.user.external_id}
          <br />
          expires_at：{expiresLabel}
        </div>
      ) : null}

      {ready && !session ? (
        <div className="muted" style={{ lineHeight: 1.35 }}>
          權威控制 / 編目工具需要 staff token（<code>Authorization: Bearer</code>）。
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {ready && session ? <Link href={`/orgs/${orgId}/logout`}>Logout</Link> : <Link href={`/orgs/${orgId}/login`}>Login</Link>}
        <Link href={`/orgs/${orgId}/authority`}>Authority Control</Link>
      </div>
    </section>
  );
}

