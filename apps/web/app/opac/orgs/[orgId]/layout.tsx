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
        <div className="toolbar">
          <div className="toolbarLeft" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 900 }}>OPAC · Organization</div>
              <span className="muted" style={{ wordBreak: 'break-all' }}>
                orgId：<code>{params.orgId}</code>
              </span>
            </div>
          </div>
          <div className="toolbarRight">
            <Link className="btnSmall" href="/opac/orgs">
              切換學校
            </Link>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <div className="toolbarLeft">
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}`}>
              搜尋與預約
            </Link>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/loans`}>
              我的借閱
            </Link>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/holds`}>
              我的預約
            </Link>
          </div>
          <div className="toolbarRight">
            <Link className="btnSmall" href="/orgs">
              Web Console
            </Link>
          </div>
        </div>

        <hr className="divider" />

        {/* Session 狀態是瀏覽器端資料（localStorage），因此必須用 Client Component 顯示。 */}
        <OpacSessionNav orgId={params.orgId} />
      </section>

      {children}
    </div>
  );
}
