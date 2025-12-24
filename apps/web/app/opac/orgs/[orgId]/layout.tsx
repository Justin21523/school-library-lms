/**
 * OPAC Org Layout（/opac/orgs/:orgId/*）
 *
 * 目的：
 * - 在單一 org 範圍內提供一致的「讀者端導覽」：
 *   - 搜尋/預約（/opac/orgs/:orgId）
 *   - 我的借閱（/opac/orgs/:orgId/loans）
 *   - 我的預約（/opac/orgs/:orgId/holds）
 *   - 登入/登出（/opac/orgs/:orgId/login|logout）
 *
 * 為什麼要做成 layout？
 * - Next.js App Router：同一路徑樹下的頁面可共用外框與導覽
 * - 避免每個 page.tsx 都重複寫同一組 links / session 顯示
 *
 * Auth/安全性（重要）：
 * - OPAC Account（讀者登入）使用 Patron Bearer token（localStorage 保存）
 * - /api/v1/orgs/:orgId/me/* 端點受 PatronAuthGuard 保護，只會回傳「本人」資料
 */

import type { ReactNode } from 'react';

import Link from 'next/link';

import OpacSessionNav from './opac-session-nav';

export default function OpacOrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { orgId: string };
}) {
  return (
    <div className="stack">
      <section className="panel">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontWeight: 800 }}>OPAC · Organization</div>
          <span className="muted" style={{ wordBreak: 'break-all' }}>
            orgId：{params.orgId}
          </span>
        </div>

        <nav
          aria-label="OPAC org navigation"
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}
        >
          <Link href={`/opac/orgs/${params.orgId}`}>搜尋與預約</Link>
          <Link href={`/opac/orgs/${params.orgId}/loans`}>我的借閱</Link>
          <Link href={`/opac/orgs/${params.orgId}/holds`}>我的預約</Link>
          <Link href="/opac/orgs">切換學校</Link>
        </nav>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} />

        {/* Session 狀態是瀏覽器端資料（localStorage），因此必須用 Client Component 顯示。 */}
        <OpacSessionNav orgId={params.orgId} />
      </section>

      {children}
    </div>
  );
}

