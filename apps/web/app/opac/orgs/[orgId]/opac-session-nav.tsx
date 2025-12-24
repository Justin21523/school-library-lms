/**
 * OpacSessionNav（OPAC org layout 的登入狀態區塊）
 *
 * 為什麼需要 Client Component？
 * - OPAC token 存在 localStorage（瀏覽器端）
 * - layout.tsx 是 Server Component（不能直接讀 window/localStorage）
 *
 * 本元件提供：
 * - 讀者是否已登入（姓名/角色/external_id）
 * - token 過期時自動清除（避免一直打 /me 401）
 * - Login/Logout 入口（以及「我的借閱/我的預約」快捷連結）
 */

'use client';

import { useMemo } from 'react';

import Link from 'next/link';

import { useOpacSession } from '../../../lib/use-opac-session';

export default function OpacSessionNav({ orgId }: { orgId: string }) {
  const { ready, session } = useOpacSession(orgId);

  // 顯示用：把 expires_at 轉成「本地時間」較容易閱讀。
  const expiresLabel = useMemo(() => {
    if (!session) return null;
    const date = new Date(session.expires_at);
    if (Number.isNaN(date.getTime())) return session.expires_at;
    return date.toLocaleString();
  }, [session]);

  return (
    <section aria-label="OPAC Session" style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>OPAC Account</div>

      {!ready ? <div className="muted">載入登入狀態中…</div> : null}

      {ready && session ? (
        <>
          <div className="muted" style={{ lineHeight: 1.4 }}>
            已登入：{session.user.name}（{session.user.role}） · {session.user.external_id}
            <br />
            <span className="muted">expires_at：{expiresLabel}</span>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={`/opac/orgs/${orgId}/logout`}>Logout</Link>
          </div>
        </>
      ) : null}

      {ready && !session ? (
        <>
          <div className="muted" style={{ lineHeight: 1.4 }}>
            未登入：若要使用「我的借閱 / 我的預約」請先登入（student/teacher）。
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={`/opac/orgs/${orgId}/login`}>Login</Link>
          </div>
        </>
      ) : null}
    </section>
  );
}

