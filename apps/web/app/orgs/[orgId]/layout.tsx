/**
 * Organization Layout（單一 organization 的導覽框架）
 *
 * 這個 layout 的目的，是把「一所學校（org）底下的功能」集中在同一個側邊導覽：
 * - locations / users / policies / bibs / items / loans / circulation
 * - URL 上用 orgId 表達多租戶邊界（對齊 API：/api/v1/orgs/:orgId/...）
 *
 * 重要：這裡不做資料抓取（fetch org name），先用 orgId 顯示即可。
 * - 原因：MVP 先把「可操作」做起來
 * - 之後若要顯示 org 名稱，可在此 layout 增加 API call 或在 dashboard 顯示
 */

import type { ReactNode } from 'react';

import Link from 'next/link';

import StaffSessionNav from './staff-session-nav';

export default function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { orgId: string };
}) {
  // orgId 來自動態路由段：/orgs/[orgId]/...
  const { orgId } = params;

  return (
    <div className="orgLayout">
      {/* 左側導覽：讓使用者在 org 範圍內快速切換功能。 */}
      <aside className="panel orgNav">
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Organization</div>
          <div className="muted" style={{ wordBreak: 'break-all' }}>
            {orgId}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/orgs">回到 org 列表</Link>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        {/* Staff session 區塊（登入狀態）：用 Client Component 讀 localStorage。 */}
        <StaffSessionNav orgId={orgId} />

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <nav aria-label="Organization">
          <ul>
            <li>
              <Link href={`/orgs/${orgId}`}>Dashboard</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/locations`}>Locations</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/users`}>Users</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/circulation-policies`}>Circulation Policies</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/bibs`}>Bibs</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/items`}>Items</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/inventory`}>Inventory</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/holds`}>Holds</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/holds/maintenance`}>Holds Maintenance</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/reports/ready-holds`}>Ready Holds</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/reports/zero-circulation`}>Zero Circulation</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/loans`}>Loans</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/loans/maintenance`}>Loans Maintenance</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/reports/overdue`}>Overdue Report</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/reports/top-circulation`}>Top Circulation</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/reports/circulation-summary`}>Circulation Summary</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/audit-events`}>Audit Events</Link>
            </li>
            <li>
              <Link href={`/orgs/${orgId}/circulation`}>Circulation</Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* 右側內容：各個功能頁面在這裡渲染。 */}
      <section className="stack">{children}</section>
    </div>
  );
}
