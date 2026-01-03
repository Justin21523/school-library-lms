'use client';

/**
 * Holdings Hub（/orgs/:orgId/holdings）
 *
 * 目標：把「館藏管理」整理成乾淨的入口（tiles）
 * - items（冊）
 * - locations（館藏地點）
 * - inventory（盤點）
 */

import Link from 'next/link';

import { useStaffSession } from '../../../lib/use-staff-session';

import { NavIcon } from '../../../components/layout/nav-icons';
import { Alert } from '../../../components/ui/alert';
import { NavTile } from '../../../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';

export default function HoldingsHubPage({ params }: { params: { orgId: string } }) {
  const { ready: staffReady, session: staffSession } = useStaffSession(params.orgId);

  return (
    <div className="stack">
      <PageHeader
        title="館藏管理"
        description="以冊（items）為中心，連結到館藏地點與盤點作業。"
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}`}>
              Dashboard
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/index`}>
              功能索引
            </Link>
          </>
        }
      >
        {!staffReady ? (
          <Alert variant="info" title="載入登入狀態中…" role="status">
            館藏管理屬於後台功能，通常需要 staff 登入。
          </Alert>
        ) : null}
        {staffReady && !staffSession ? (
          <Alert variant="warning" title="尚未 staff 登入">
            你可以先瀏覽此導覽頁，但進入 items/locations/inventory 等操作時需要登入。請前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="核心功能" description="常見工作：查冊、建冊、調整館藏地點、盤點與盤點報表。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/items`}
            icon={<NavIcon id="holdings" size={20} />}
            title="冊（Items）"
            description="查冊、狀態、條碼、借閱/預約關聯；大量資料下也能用 cursor pagination。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/locations`}
            icon={<NavIcon id="holdings" size={20} />}
            title="館藏地點（Locations）"
            description="館別/區域/書架代碼；影響 items 的上架位置與流通策略。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/inventory`}
            icon={<NavIcon id="holdings" size={20} />}
            title="盤點（Inventory）"
            description="建立盤點批次、掃描比對、產出缺失/異常清單。"
          />
        </div>
      </section>
    </div>
  );
}

