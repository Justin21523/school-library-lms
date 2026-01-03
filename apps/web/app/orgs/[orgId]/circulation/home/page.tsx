'use client';

/**
 * Circulation Hub（/orgs/:orgId/circulation/home）
 *
 * 目標：把流通功能（櫃台/借閱/預約/政策/維護）用「卡片式導覽」整理成入口。
 * - 讓使用者不必記路由或在側邊欄翻找很久
 */

import Link from 'next/link';

import { useStaffSession } from '../../../../lib/use-staff-session';

import { NavIcon } from '../../../../components/layout/nav-icons';
import { Alert } from '../../../../components/ui/alert';
import { NavTile } from '../../../../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';

export default function CirculationHubPage({ params }: { params: { orgId: string } }) {
  const { ready: staffReady, session: staffSession } = useStaffSession(params.orgId);

  return (
    <div className="stack">
      <PageHeader
        title="流通服務"
        description="櫃台作業、借閱/預約、政策與維護工具。"
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
            流通/政策/維護屬於後台功能，通常需要 staff 登入。
          </Alert>
        ) : null}
        {staffReady && !staffSession ? (
          <Alert variant="warning" title="尚未 staff 登入">
            你可以先瀏覽此導覽頁，但操作借閱/預約等功能需要登入。請前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="櫃台作業" description="館員常用入口：借出/歸還、查詢讀者、處理預約。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/circulation`}
            icon={<NavIcon id="circulation" size={20} />}
            title="流通櫃台（Circulation Desk）"
            description="借出/歸還/續借；處理預約取書；即時更新 items/holds/loans。"
          />
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="借閱與預約" description="清單/查詢與維護：支援大量資料與 cursor pagination。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/loans`}
            icon={<NavIcon id="circulation" size={20} />}
            title="借閱（Loans）"
            description="查詢借閱紀錄、狀態、逾期；可搭配 maintenance 做批次清理。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/holds`}
            icon={<NavIcon id="circulation" size={20} />}
            title="預約（Holds）"
            description="查詢預約狀態、可取書（ready）與排隊；可印取書單。"
          />
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="政策與維護" description="把高風險/批次操作集中成清楚入口（含 warning/preview/apply）。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/circulation-policies`}
            icon={<NavIcon id="circulation" size={20} />}
            title="流通政策（Policies）"
            description="借期/續借/罰則等規則；後續可擴充到角色/館別/館藏類型。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/holds/maintenance`}
            icon={<NavIcon id="maintenance" size={20} />}
            title="Holds Maintenance"
            description="清理/過期處理等批次作業（preview/apply）。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/loans/maintenance`}
            icon={<NavIcon id="maintenance" size={20} />}
            title="Loans Maintenance"
            description="歷史資料清理/保留策略（preview/apply）。"
          />
        </div>
      </section>
    </div>
  );
}

