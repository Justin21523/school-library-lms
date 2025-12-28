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

import { ConsoleTopbar } from '../components/layout/console-topbar';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {/* Top bar：全域導覽 + 查詢 + 快捷跳轉 + theme */}
      <ConsoleTopbar />

      {/* children：路由頁面內容會被插進這裡。 */}
      <main className="consoleMain">{children}</main>
    </div>
  );
}
