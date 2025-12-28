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

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { Organization } from '../../lib/api';
import { getOrganization } from '../../lib/api';
import { formatErrorMessage } from '../../lib/error';
import { getOrgConsoleNav, type OrgConsoleNavItem, type OrgConsoleNavNode } from '../../lib/console-nav';
import { useStaffSession } from '../../lib/use-staff-session';

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

  return (
    <div className="stack">
      <section className="panel">
        <div className="toolbar">
          <div className="toolbarLeft">
            <h1 style={{ margin: 0 }}>Dashboard</h1>
          </div>
          <div className="toolbarRight">
            {staffReady && !staffSession ? <Link href={`/orgs/${params.orgId}/login`}>Staff Login</Link> : null}
            {staffReady && staffSession ? <Link href={`/orgs/${params.orgId}/logout`}>Logout</Link> : null}
          </div>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          這頁對應 API：<code>GET /api/v1/orgs/:orgId</code> · 你也可以用 topbar 的「全域查詢」或 <code>Ctrl/Cmd + K</code> 快速跳轉功能。
        </p>

        {loading ? <p className="muted">載入中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}

        {org ? (
          <div className="grid3" style={{ marginTop: 12 }}>
            <div className="callout">
              <div className="muted">名稱</div>
              <div style={{ fontWeight: 800 }}>{org.name}</div>
            </div>
            <div className="callout">
              <div className="muted">代碼</div>
              <div>{org.code ?? '(no code)'}</div>
            </div>
            <div className="callout">
              <div className="muted">orgId</div>
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{org.id}</div>
            </div>
          </div>
        ) : null}

        <div className="callout" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Staff Session</div>
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
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>模組導覽（Taxonomy）</h2>
        <p className="muted">
          這裡把功能用「階層式分類」整理成清楚的入口；側邊欄也會用同一套分類（並支援收合/拖拉寬度/tooltip）。
        </p>

        <div className="cardGrid">
          {getOrgConsoleNav(params.orgId)
            .filter((g) => g.id !== 'overview')
            .map((group) => {
              const links = pickPreviewLinks(group.children).slice(0, 5);
              return (
                <div key={group.id} className="card">
                  <div className="cardTitle">{group.label}</div>
                  <div className="cardMeta">{describeGroup(group.id)}</div>
                  <div className="cardLinks">
                    {links.map((item) => (
                      <Link key={item.id} href={item.href}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function pickPreviewLinks(nodes: OrgConsoleNavNode[]): OrgConsoleNavItem[] {
  // dashboard 的卡片只需要「最常點」的少量入口：
  // - 我們用 DFS 取出 item（遇到 group 就往下走），並由呼叫端再 slice(0,n)
  const items: OrgConsoleNavItem[] = [];
  for (const n of nodes) {
    if (n.type === 'item') {
      items.push(n);
      continue;
    }
    items.push(...pickPreviewLinks(n.children));
  }
  return items;
}

function describeGroup(groupId: string) {
  // 這裡用「人類可讀」的摘要，讓 dashboard 卡片一眼看懂差異。
  switch (groupId) {
    case 'cataloging':
      return '書目/編目、MARC、匯入、欄位字典、backfill';
    case 'authority':
      return '權威詞主檔、Thesaurus、品質檢查、視覺化治理';
    case 'holdings':
      return '冊（items）、館藏地點、盤點';
    case 'circulation':
      return '借閱、預約、政策、櫃台、維護工具';
    case 'reports':
      return '統計/報表（逾期、熱門、摘要…）';
    case 'admin':
      return '使用者、匯入、Bootstrap、稽核';
    case 'opac':
      return '讀者端（查詢/預約/我的借閱）';
    default:
      return '模組';
  }
}
