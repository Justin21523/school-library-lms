'use client';

/**
 * Reports Hub（/orgs/:orgId/reports）
 *
 * 目標：把報表入口集中成一頁（tiles），避免在左側清單中迷路。
 */

import Link from 'next/link';

import { useStaffSession } from '../../../lib/use-staff-session';

import { NavIcon } from '../../../components/layout/nav-icons';
import { Alert } from '../../../components/ui/alert';
import { NavTile } from '../../../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';

export default function ReportsHubPage({ params }: { params: { orgId: string } }) {
  const { ready: staffReady, session: staffSession } = useStaffSession(params.orgId);

  return (
    <div className="stack">
      <PageHeader
        title="報表與分析"
        description="常用報表入口（逾期、熱門、摘要、可取書預約…）。"
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
            報表通常屬於後台功能，可能需要 staff 登入。
          </Alert>
        ) : null}
        {staffReady && !staffSession ? (
          <Alert variant="warning" title="尚未 staff 登入">
            你可以先瀏覽此導覽頁，但進入報表頁時可能需要登入。請前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="流通報表" description="支援大量資料情境；列表/表格皆走一致的 DataTable 操作。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/reports/overdue`}
            icon={<NavIcon id="reports" size={20} />}
            title="逾期清單（Overdue）"
            description="逾期讀者與冊；可作為催還/通知清單。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/reports/ready-holds`}
            icon={<NavIcon id="reports" size={20} />}
            title="可取書預約（Ready Holds）"
            description="列出可取書預約；支援列印取書單。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/reports/top-circulation`}
            icon={<NavIcon id="reports" size={20} />}
            title="熱門借閱（Top Circulation）"
            description="借閱次數排行；可作為採購/汰舊參考。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/reports/circulation-summary`}
            icon={<NavIcon id="reports" size={20} />}
            title="流通摘要（Summary）"
            description="整體借閱/預約統計摘要。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/reports/zero-circulation`}
            icon={<NavIcon id="reports" size={20} />}
            title="零借閱（Zero Circulation）"
            description="長期未借閱書目清單；支援汰舊/移庫決策。"
          />
        </div>
      </section>
    </div>
  );
}

