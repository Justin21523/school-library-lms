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
        </div>
      ) : null}
    </section>
  );
}
