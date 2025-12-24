/**
 * OPAC：Organizations 列表（/opac/orgs）
 *
 * 目的：
 * - 讓讀者先選擇自己的學校（org）
 * - 之後所有操作都在 org 範圍內（對齊 API 的多租戶邊界：/api/v1/orgs/:orgId/...）
 */

'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { Organization } from '../../lib/api';
import { listOrganizations } from '../../lib/api';
import { formatErrorMessage } from '../../lib/error';

export default function OpacOrgsPage() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初次載入：抓 org 列表（OPAC 不提供建立 org，僅提供選擇）。
  useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const result = await listOrganizations();
        setOrgs(result);
      } catch (e) {
        setOrgs(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, []);

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>選擇學校（Organization）</h1>
        <p className="muted">請先選擇你所在的學校，後續搜尋/預約都會在該學校範圍內進行。</p>

        {loading ? <p className="muted">載入中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}

        {!loading && orgs && orgs.length === 0 ? <p className="muted">目前沒有 organization。</p> : null}

        {!loading && orgs && orgs.length > 0 ? (
          <ul>
            {orgs.map((org) => (
              <li key={org.id} style={{ marginBottom: 8 }}>
                <Link href={`/opac/orgs/${org.id}`}>{org.name}</Link>{' '}
                <span className="muted">{org.code ? `(${org.code})` : '(no code)'}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

