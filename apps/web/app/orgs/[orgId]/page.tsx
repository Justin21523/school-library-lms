/**
 * Organization Dashboard（/orgs/:orgId）
 *
 * 這頁是「單一 org」的總覽頁：
 * - 顯示 orgId（MVP 先做到可操作）
 * - 提供下一步操作提示（locations/users/policies/bibs/items/circulation）
 *
 * 之後可擴充：
 * - 顯示 org 名稱（GET /api/v1/orgs/:orgId）
 * - 顯示近期稽核事件（需要 audit 查詢 API）
 */

// 這頁會呼叫 API 抓 org 詳細資料，因此使用 Client Component。
'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { Organization } from '../../lib/api';
import { getOrganization } from '../../lib/api';
import { formatErrorMessage } from '../../lib/error';
import { useStaffSession } from '../../lib/use-staff-session';

import { NavIcon } from '../../components/layout/nav-icons';
import { Alert } from '../../components/ui/alert';
import { NavTile } from '../../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../../components/ui/page-header';
import { SkeletonText } from '../../components/ui/skeleton';

export default function OrgDashboardPage({ params }: { params: { orgId: string } }) {
  // staff session：顯示「是否已登入」讓使用者少走一步（也能降低「為什麼一直 401」的困惑）
  const { ready: staffReady, session: staffSession } = useStaffSession(params.orgId);

  // org：單一 organization 的資料（null 代表尚未載入）。
  const [org, setOrg] = useState<Organization | null>(null);

  // loading/error：控制載入中與錯誤顯示。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 當 orgId 改變時，重新抓資料（通常是使用者切換 URL）。
  useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const result = await getOrganization(params.orgId);
        setOrg(result);
      } catch (e) {
        setOrg(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, [params.orgId]);

  const categories = useMemo(
    () => [
      {
        id: 'catalog',
        href: `/orgs/${params.orgId}/catalog`,
        icon: 'catalog' as const,
        title: '編目與目錄',
        description: '書目/編目、MARC 工具、匯入匯出、backfill',
      },
      {
        id: 'authority',
        href: `/orgs/${params.orgId}/authority`,
        icon: 'authority' as const,
        title: '權威控制（Authority）',
        description: '主檔、Thesaurus、品質檢查、視覺化治理',
      },
      {
        id: 'holdings',
        href: `/orgs/${params.orgId}/holdings`,
        icon: 'holdings' as const,
        title: '館藏管理',
        description: 'Items / Locations / Inventory',
      },
      {
        id: 'circulation',
        href: `/orgs/${params.orgId}/circulation/home`,
        icon: 'circulation' as const,
        title: '流通服務',
        description: '櫃台、借閱、預約、政策、維護工具',
      },
      {
        id: 'reports',
        href: `/orgs/${params.orgId}/reports`,
        icon: 'reports' as const,
        title: '報表與分析',
        description: '逾期、熱門、摘要、可取書預約…',
      },
      {
        id: 'admin',
        href: `/orgs/${params.orgId}/admin`,
        icon: 'admin' as const,
        title: '系統管理',
        description: 'Users、匯入、稽核、啟用流程',
      },
      {
        id: 'opac',
        href: `/opac/orgs/${params.orgId}`,
        icon: 'opac' as const,
        title: '讀者端（OPAC）',
        description: '查詢/預約/我的借閱（供館員快速切換驗證）',
      },
    ],
    [params.orgId],
  );

  return (
    <div className="stack">
      <PageHeader
        title="Organization Dashboard"
        description={
          <>
            以「模組 Hub pages」做導覽：先進入分區首頁（卡片/段落），再進入具體功能頁。完整索引在 <code>/index</code>。
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/index`}>
              功能索引
            </Link>
            {staffReady && !staffSession ? (
              <Link className="btnSmall" href={`/orgs/${params.orgId}/login`}>
                Staff Login
              </Link>
            ) : null}
            {staffReady && staffSession ? (
              <Link className="btnSmall" href={`/orgs/${params.orgId}/logout`}>
                Logout
              </Link>
            ) : null}
          </>
        }
      >
        {loading ? <SkeletonText lines={2} /> : null}
        {error ? (
          <Alert variant="danger" title="載入失敗">
            {error}
          </Alert>
        ) : null}

        {org ? (
          <div className="grid3">
            <div className="callout">
              <div className="muted">名稱</div>
              <div style={{ fontWeight: 900 }}>{org.name}</div>
            </div>
            <div className="callout">
              <div className="muted">代碼</div>
              <div>{org.code ?? '(no code)'}</div>
            </div>
            <div className="callout">
              <div className="muted">orgId</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>{org.id}</div>
            </div>
          </div>
        ) : null}

        <div className="callout">
          <div style={{ fontWeight: 900 }}>Staff Session</div>
          {!staffReady ? <div className="muted">載入中…</div> : null}
          {staffReady && staffSession ? (
            <div className="muted">
              已登入：{staffSession.user.name}（{staffSession.user.role}） · {staffSession.user.external_id}
            </div>
          ) : null}
          {staffReady && !staffSession ? (
            <div className="muted">
              未登入：多數後台操作需要 staff token（否則 API 會回 <code>401</code>）。
            </div>
          ) : null}
        </div>
      </PageHeader>

      <section className="panel">
        <SectionHeader title="模組入口" description="每個分區都有自己的首頁（Hub page），用卡片/段落收納常見入口與工作流。" />

        <div className="tileGrid">
          {categories.map((c) => (
            <NavTile
              key={c.id}
              href={c.href}
              icon={<NavIcon id={c.icon} size={20} />}
              title={c.title}
              description={c.description}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="常用入口" description="把高頻功能做成 tiles（降低翻找成本；也適合給新手）。" />
        <div className="tileGrid">
          <NavTile
            href={`/orgs/${params.orgId}/bibs`}
            icon={<NavIcon id="catalog" size={20} />}
            title="書目查詢 / 編目"
            description="建立/編修書目；term-based 欄位逐步整合。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/authority`}
            icon={<NavIcon id="authority" size={20} />}
            title="Authority Control（主控入口）"
            description="Terms / Thesaurus / Backfill / MARC tools 集中入口。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/bibs/marc-editor`}
            icon={<NavIcon id="marc" size={20} />}
            title="MARC 編輯器"
            description="編輯 marc_extras；下載 MARC 檔案。"
          />
          <NavTile
            href={`/orgs/${params.orgId}/circulation`}
            icon={<NavIcon id="circulation" size={20} />}
            title="流通櫃台"
            description="借出/歸還/續借；處理預約取書。"
          />
        </div>
      </section>
    </div>
  );
}
