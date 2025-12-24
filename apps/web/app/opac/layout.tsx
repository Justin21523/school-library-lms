/**
 * OPAC Layout（讀者自助外框）
 *
 * 目的：
 * - 把 OPAC（讀者端）共用的 top bar/nav 放在同一個 layout
 * - 讓 `/opac/...` 底下的頁面有一致的外觀與回到入口的方式
 *
 * 注意：OPAC 與 Web Console 在同一個 Next.js app 裡：
 * - Web Console：`/orgs/...`（館員/管理者操作）
 * - OPAC：`/opac/...`（讀者自助）
 *
 * 版本演進：
 * - 已支援 OPAC Account（Patron login）：可安全使用 `/me/*`（我的借閱/我的預約）
 * - 仍保留 `user_external_id` 模式作為過渡（可用但不安全）
 */

import type { ReactNode } from 'react';

import Link from 'next/link';

export default function OpacLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {/* Top bar：讓使用者在 OPAC 區域中隨時回到入口/切換到後台。 */}
      <header className="topbar">
        <div className="topbarInner">
          <div className="topbarTitle">Library OPAC</div>

          <nav className="topbarNav" aria-label="OPAC">
            <Link href="/">首頁</Link>
            <Link href="/opac">OPAC</Link>
            <Link href="/opac/orgs">選擇學校</Link>
            <Link href="/orgs">Web Console</Link>
          </nav>
        </div>
      </header>

      {/* children：/opac 底下的各頁會被渲染在這裡。 */}
      <main className="container">{children}</main>
    </div>
  );
}
