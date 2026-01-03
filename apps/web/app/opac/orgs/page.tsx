/**
 * OPAC：Organizations 列表（/opac/orgs）
 *
 * 目的：
 * - 讓讀者先選擇自己的學校（org）
 * - 之後所有操作都在 org 範圍內（對齊 API 的多租戶邊界：/api/v1/orgs/:orgId/...）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { Organization } from '../../lib/api';
import { listOrganizations } from '../../lib/api';
import { NavIcon } from '../../components/layout/nav-icons';
import { Alert } from '../../components/ui/alert';
import { NavTile } from '../../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../../components/ui/page-header';
import { SkeletonTiles } from '../../components/ui/skeleton';
import { formatErrorMessage } from '../../lib/error';

export default function OpacOrgsPage() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => {
    if (!orgs) return null;
    const q = query.trim().toLowerCase();
    const items = q
      ? orgs.filter((o) => o.name.toLowerCase().includes(q) || (o.code ?? '').toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
      : orgs;
    return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [orgs, query]);

  return (
    <div className="stack">
      <PageHeader
        title="選擇學校（Organization）"
        description="請先選擇你所在的學校；後續搜尋/預約/我的借閱與預約都會在該學校範圍內進行。"
        actions={
          <>
            <Link className="btnSmall" href="/opac">
              OPAC 首頁
            </Link>
            <Link className="btnSmall" href="/orgs">
              Web Console
            </Link>
          </>
        }
      >
        {error ? (
          <Alert variant="danger" title="載入失敗">
            {error}
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="清單" description="可用搜尋快速定位（name/code/id）。" />

        <div className="grid2" style={{ alignItems: 'end', marginTop: 12 }}>
          <label>
            搜尋
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：示範國小 / demo / 550e…" />
          </label>
          <div className="muted" style={{ fontSize: 13 }}>
            {filtered ? (
              <>
                顯示 <code>{filtered.length}</code> 筆
              </>
            ) : (
              <>尚未載入</>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ marginTop: 12 }}>
            <SkeletonTiles count={6} />
          </div>
        ) : null}

        {!loading && orgs && orgs.length === 0 ? <Alert variant="warning" title="目前沒有 organization" /> : null}

        {!loading && filtered && filtered.length > 0 ? (
          <div className="tileGrid" style={{ marginTop: 12 }}>
            {filtered.map((org) => (
              <NavTile
                key={org.id}
                href={`/opac/orgs/${org.id}`}
                icon={<NavIcon id="opac" size={20} />}
                title={org.name}
                description={
                  <>
                    <span className="muted">code：</span>
                    <code>{org.code ?? '(no code)'}</code>
                    <span className="muted"> · id：</span>
                    <code>{org.id.slice(0, 8)}…</code>
                  </>
                }
                right={<span className="muted">進入</span>}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
