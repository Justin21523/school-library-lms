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

export default function OrgDashboardPage({ params }: { params: { orgId: string } }) {
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
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Organization Dashboard</h1>

      <p className="muted">
        這頁對應 API：<code>GET /api/v1/orgs/:orgId</code>
      </p>

      {loading ? <p className="muted">載入中…</p> : null}
      {error ? <p className="error">錯誤：{error}</p> : null}

      {org ? (
        <div className="stack">
          <div>
            <div className="muted">名稱</div>
            <div style={{ fontWeight: 700 }}>{org.name}</div>
          </div>

          <div>
            <div className="muted">代碼</div>
            <div>{org.code ?? '(no code)'}</div>
          </div>

          <div>
            <div className="muted">orgId</div>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {org.id}
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          {/* 快捷入口：把「最常需要點的面板」集中在 Dashboard，避免只靠側邊欄（也方便 demo 測試）。 */}
          <div>
            <div className="muted">快速入口（Web Console）</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              <Link href={`/orgs/${org.id}/login`}>Staff Login</Link>
              <Link href={`/orgs/${org.id}/users`}>Users</Link>
              <Link href={`/orgs/${org.id}/users/import`}>Users CSV Import</Link>
              <Link href={`/orgs/${org.id}/circulation-policies`}>Policies</Link>
              <Link href={`/orgs/${org.id}/bibs`}>Bibs</Link>
              <Link href={`/orgs/${org.id}/bibs/import`}>Catalog CSV Import</Link>
              <Link href={`/orgs/${org.id}/items`}>Items</Link>
              <Link href={`/orgs/${org.id}/inventory`}>Inventory</Link>
              <Link href={`/orgs/${org.id}/circulation`}>Circulation</Link>
              <Link href={`/orgs/${org.id}/holds`}>Holds</Link>
              <Link href={`/orgs/${org.id}/loans`}>Loans</Link>
            </div>
          </div>

          <div>
            <div className="muted">快速入口（Reports / Maintenance / Audit）</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              <Link href={`/orgs/${org.id}/reports/overdue`}>Overdue</Link>
              <Link href={`/orgs/${org.id}/reports/ready-holds`}>Ready Holds</Link>
              <Link href={`/orgs/${org.id}/reports/top-circulation`}>Top Circulation</Link>
              <Link href={`/orgs/${org.id}/reports/circulation-summary`}>Circulation Summary</Link>
              <Link href={`/orgs/${org.id}/reports/zero-circulation`}>Zero Circulation</Link>
              <Link href={`/orgs/${org.id}/holds/maintenance`}>Holds Maintenance</Link>
              <Link href={`/orgs/${org.id}/loans/maintenance`}>Loans Maintenance</Link>
              <Link href={`/orgs/${org.id}/audit-events`}>Audit Events</Link>
            </div>
          </div>

          <div>
            <div className="muted">快速入口（OPAC / 讀者端）</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              <Link href={`/opac/orgs/${org.id}`}>OPAC：搜尋與預約</Link>
              <Link href={`/opac/orgs/${org.id}/login`}>OPAC Login</Link>
              <Link href={`/opac/orgs/${org.id}/loans`}>OPAC：我的借閱</Link>
              <Link href={`/opac/orgs/${org.id}/holds`}>OPAC：我的預約</Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
