/**
 * Staff Logout Page（/orgs/:orgId/logout）
 *
 * 目的：
 * - 清除 localStorage 裡的 staff session（Bearer token）
 * - 把使用者帶回 login 頁（避免停在需要 token 的頁面一直報 401）
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

import { clearStaffSession } from '../../../lib/staff-session';
import { Alert } from '../../../components/ui/alert';

export default function OrgLogoutPage({ params }: { params: { orgId: string } }) {
  const router = useRouter();

  // done：避免 useEffect 觸發前 UI 空白；同時讓使用者知道 logout 成功。
  const [done, setDone] = useState(false);

  useEffect(() => {
    clearStaffSession(params.orgId);
    setDone(true);

    // UX：小延遲讓使用者看到「已登出」提示，再導回 login。
    const t = window.setTimeout(() => {
      router.replace(`/orgs/${params.orgId}/login`);
    }, 200);

    return () => window.clearTimeout(t);
  }, [params.orgId, router]);

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Logout</h1>

        {done ? (
          <Alert variant="success" title="已登出" role="status">
            已清除 staff session，正在返回登入頁…
          </Alert>
        ) : (
          <p className="muted">登出中…</p>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/orgs/${params.orgId}/login`}>前往 Login</Link>
          <Link href={`/orgs/${params.orgId}`}>回到 Dashboard</Link>
        </div>
      </section>
    </div>
  );
}
