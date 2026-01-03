'use client';

/**
 * Admin Hub（/orgs/:orgId/admin）
 *
 * 目標：把系統管理入口集中成一頁（tiles）：
 * - 使用者/匯入
 * - 稽核
 * - 啟用流程（bootstrap set password）
 */

import Link from 'next/link';

import { useStaffSession } from '../../../lib/use-staff-session';

import { NavIcon } from '../../../components/layout/nav-icons';
import { Alert } from '../../../components/ui/alert';
import { NavTile } from '../../../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';

export default function AdminHubPage({ params }: { params: { orgId: string } }) {
  const { ready: staffReady, session: staffSession } = useStaffSession(params.orgId);

  return (
    <div className="stack">
      <PageHeader
        title="系統管理"
        description="帳號與權限、稽核追蹤、啟用流程。"
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
            系統管理屬於後台功能，需要 staff 登入（且通常需要 admin/librarian 權限）。
          </Alert>
        ) : null}
        {staffReady && !staffSession ? (
          <Alert variant="warning" title="尚未 staff 登入">
            請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="帳號與權限" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/users`}
            icon={<NavIcon id="admin" size={20} />}
            title="使用者（Users）"
            description="建立/停用帳號、角色、單位；支援大量資料與編輯。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/users/import`}
            icon={<NavIcon id="admin" size={20} />}
            title="Users CSV 匯入"
            description="批次建立使用者（preview/apply），並回傳可覆核的錯誤報表。"
          />
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="稽核與追蹤" description="所有高風險/批次操作都會寫入 audit_events。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/audit-events`}
            icon={<NavIcon id="admin" size={20} />}
            title="稽核事件（Audit Events）"
            description="查詢操作紀錄（誰在何時做了什麼），支援篩選與追溯。"
          />
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="啟用流程" description="用於初次啟用/重設密碼等流程（受 bootstrap secret 保護）。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/bootstrap-set-password`}
            icon={<NavIcon id="admin" size={20} />}
            title="Bootstrap：設定密碼"
            description="初次啟用或重設；需提供 bootstrap secret。"
          />
        </div>
      </section>
    </div>
  );
}

