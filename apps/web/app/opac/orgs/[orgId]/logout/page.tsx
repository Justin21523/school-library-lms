/**
 * OPAC Logout Page（/opac/orgs/:orgId/logout）
 *
 * 目的：
 * - 清除 localStorage 裡的 OPAC session（Patron Bearer token）
 * - 導回 login 頁，避免停留在需要 /me token 的頁面一直報 401
 *
 * 設計取捨：
 * - 我們目前的 token 是「自製 HMAC token」，沒有 server-side session store
 * - 因此 logout 的 MVP 行為只能做到「前端清掉 token」
 * - 若未來導入 refresh token / token blacklist，logout 可再補「後端撤銷」流程
 */

'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { clearOpacSession } from '../../../../lib/opac-session';

export default function OpacLogoutPage({ params }: { params: { orgId: string } }) {
  const router = useRouter();

  // done：避免 useEffect 觸發前 UI 空白；同時讓使用者知道 logout 成功。
  const [done, setDone] = useState(false);

  useEffect(() => {
    clearOpacSession(params.orgId);
    setDone(true);

    // UX：小延遲讓使用者看到「已登出」提示，再導回 login。
    const t = window.setTimeout(() => {
      router.replace(`/opac/orgs/${params.orgId}/login`);
    }, 200);

    return () => window.clearTimeout(t);
  }, [params.orgId, router]);

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Logout</h1>

        {done ? <p className="success">已清除 OPAC session，正在返回登入頁…</p> : <p className="muted">登出中…</p>}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/opac/orgs/${params.orgId}/login`}>前往 Login</Link>
          <Link href={`/opac/orgs/${params.orgId}`}>回到搜尋</Link>
        </div>
      </section>
    </div>
  );
}

