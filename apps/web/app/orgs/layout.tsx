/**
 * Console Layout（後台外框）
 *
 * 我們把「管理介面」的共用 UI（top bar、固定導覽）放在這個 layout：
 * - 讓 /orgs 與其子頁面自動套用同一套外觀
 * - 避免每個 page.tsx 重複寫 header/nav
 *
 * Next.js App Router 的 layout 是「巢狀可組合」的：
 * - root layout（app/layout.tsx）包住全站
 * - orgs layout（app/orgs/layout.tsx）包住 org 區域的所有頁面
 * - org layout（app/orgs/[orgId]/layout.tsx）再包住單一 org 的子頁
 */

import type { ReactNode } from 'react';

// Link：Next.js 的 client-side navigation（避免整頁 reload）。
import Link from 'next/link';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {/* Top bar：提供全站一致的「回到 org 列表」入口。 */}
      <header className="topbar">
        <div className="topbarInner">
          <div className="topbarTitle">Library System Console</div>

          <nav className="topbarNav" aria-label="Console">
            <Link href="/">首頁</Link>
            <Link href="/orgs">Organizations</Link>
          </nav>
        </div>
      </header>

      {/* children：路由頁面內容會被插進這裡。 */}
      <main className="container">{children}</main>
    </div>
  );
}
