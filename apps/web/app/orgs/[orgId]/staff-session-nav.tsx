/**
 * StaffSessionNav（Organization side nav 的登入狀態區塊）
 *
 * 為什麼需要這個元件？
 * - 我們的 Staff Auth token 存在 localStorage（瀏覽器端）
 * - 但 `/orgs/[orgId]/layout.tsx` 是 Server Component（不能直接讀 window/localStorage）
 *
 * 因此我們把「顯示登入狀態 / 提供 Login/Logout 入口」做成 Client Component，
 * 讓使用者在側邊欄就能看見：
 * - 目前是否已登入（誰登入、角色是什麼）
 * - token 是否已過期（過期就清掉，避免一直拿舊 token 打 API）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { StaffSession } from '../../lib/staff-session';
import { clearStaffSession, loadStaffSession } from '../../lib/staff-session';

export default function StaffSessionNav({ orgId }: { orgId: string }) {
  // ready：代表我們已在「瀏覽器端」嘗試讀取 localStorage。
  // - 用它來避免 SSR/初次 hydration 時就顯示「未登入」造成閃爍。
  const [ready, setReady] = useState(false);

  // session：localStorage 中保存的 staff session（若未登入則為 null）。
  const [session, setSession] = useState<StaffSession | null>(null);

  // 只要 orgId 改變（切換到另一個 org），就重新讀取一次 session。
  useEffect(() => {
    const loaded = loadStaffSession(orgId);

    // 若 token 已過期：直接清掉，避免 UI 以為已登入但實際 API 都會 401。
    if (loaded && isExpired(loaded.expires_at)) {
      clearStaffSession(orgId);
      setSession(null);
    } else {
      setSession(loaded);
    }

    setReady(true);
  }, [orgId]);

  // 顯示用：把 expires_at 轉成「本地時間」較容易閱讀。
  const expiresLabel = useMemo(() => {
    if (!session) return null;
    const date = new Date(session.expires_at);
    if (Number.isNaN(date.getTime())) return session.expires_at;
    return date.toLocaleString();
  }, [session]);

  return (
    <section aria-label="Staff Session" style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Staff Session</div>

      {!ready ? <div className="muted">載入登入狀態中…</div> : null}

      {ready && session ? (
        <>
          <div className="muted" style={{ lineHeight: 1.4 }}>
            已登入：{session.user.name}（{session.user.role}） · {session.user.external_id}
            <br />
            <span className="muted">expires_at：{expiresLabel}</span>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={`/orgs/${orgId}/logout`}>Logout</Link>
          </div>
        </>
      ) : null}

      {ready && !session ? (
        <>
          <div className="muted" style={{ lineHeight: 1.4 }}>
            未登入：Web Console（staff）多數功能需要 <code>Authorization: Bearer</code> token。
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={`/orgs/${orgId}/login`}>Login</Link>
          </div>
        </>
      ) : null}
    </section>
  );
}

function isExpired(expiresAtIso: string) {
  // expires_at 來自 API（ISO string）；若 parse 失敗，就保守視為過期。
  const ms = Date.parse(expiresAtIso);
  if (Number.isNaN(ms)) return true;
  return ms <= Date.now();
}

