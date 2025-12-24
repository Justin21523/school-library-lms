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
 * MVP 限制：
 * - 目前沒有登入（auth），OPAC 會用 `user_external_id` 讓讀者查/下預約
 * - 這是「可用但不安全」的暫時方案；之後導入登入（例如校務 SSO）再補權限控管
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

