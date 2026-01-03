'use client';

/**
 * Console Index（/orgs/:orgId/index）
 *
 * 你希望把「導覽」從大量文字連結，改成：
 * - 以卡片/容器（tiles）呈現：icon + title + 一句摘要
 * - 以「分類 → 模組 Hub page → 具體功能頁」的多頁面結構導引
 * - 提供一個可搜尋的索引入口（避免只靠側邊欄或 Ctrl/Cmd+K）
 */

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { flattenOrgConsoleNav, getOrgConsoleNav, type NavIconId, type OrgConsoleNavItem } from '../../../lib/console-nav';
import { useStaffSession } from '../../../lib/use-staff-session';

import { NavIcon } from '../../../components/layout/nav-icons';
import { Alert } from '../../../components/ui/alert';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field, Form, FormSection } from '../../../components/ui/form';
import { NavTile } from '../../../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';

function includesIgnoreCase(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function matchNavItem(item: OrgConsoleNavItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  if (includesIgnoreCase(item.label, q)) return true;
  if (item.description && includesIgnoreCase(item.description, q)) return true;
  if (includesIgnoreCase(item.href, q)) return true;
  if (item.keywords?.some((k) => includesIgnoreCase(k, q))) return true;
  return false;
}

function hubHref(orgId: string, groupId: string) {
  switch (groupId) {
    case 'overview':
      return `/orgs/${orgId}`;
    case 'cataloging':
      return `/orgs/${orgId}/catalog`;
    case 'authority':
      return `/orgs/${orgId}/authority`;
    case 'holdings':
      return `/orgs/${orgId}/holdings`;
    case 'circulation':
      return `/orgs/${orgId}/circulation/home`;
    case 'reports':
      return `/orgs/${orgId}/reports`;
    case 'admin':
      return `/orgs/${orgId}/admin`;
    case 'opac':
      return `/opac/orgs/${orgId}`;
    default:
      return `/orgs/${orgId}`;
  }
}

function hubDescription(groupId: string) {
  switch (groupId) {
    case 'cataloging':
      return '書目/編目、MARC、匯入匯出、欄位字典、backfill';
    case 'authority':
      return '權威詞主檔、Thesaurus、品質檢查、視覺化治理';
    case 'holdings':
      return '冊（items）、館藏地點、盤點';
    case 'circulation':
      return '借閱、預約、政策、櫃台與維護工具';
    case 'reports':
      return '逾期、熱門、摘要、可取書預約等報表';
    case 'admin':
      return '使用者、匯入、稽核、啟用流程';
    case 'opac':
      return '讀者端（查詢/預約/我的借閱）';
    default:
      return '模組';
  }
}

export default function OrgIndexPage({ params }: { params: { orgId: string } }) {
  const { ready: staffReady, session: staffSession } = useStaffSession(params.orgId);
  const nav = useMemo(() => getOrgConsoleNav(params.orgId), [params.orgId]);
  const allItems = useMemo(() => flattenOrgConsoleNav(nav), [nav]);

  const [query, setQuery] = useState('');

  const quickItems = useMemo(() => {
    const ids = [
      'catalog-home',
      'bibs',
      'marc-editor',
      'authority-home',
      'authority-terms',
      'circulation-home',
      'circulation-desk',
      'items',
      'report-overdue',
      'users',
    ];
    const map = new Map(allItems.map((i) => [i.id, i]));
    return ids.map((id) => map.get(id)).filter(Boolean) as OrgConsoleNavItem[];
  }, [allItems]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return allItems.filter((i) => matchNavItem(i, q)).slice(0, 30);
  }, [allItems, query]);

  const hubGroups = useMemo(() => nav.filter((g) => g.id !== 'overview'), [nav]);

  return (
    <div className="stack">
      <PageHeader
        title="功能索引（Index）"
        description="用卡片式視覺語言瀏覽模組與功能；也支援關鍵字搜尋（避免只靠側邊欄）。"
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}`}>
              Dashboard
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority`}>
              Authority 主控
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs`}>
              Bibs
            </Link>
          </>
        }
      >
        {!staffReady ? (
          <Alert variant="info" title="載入登入狀態中…" role="status">
            若你要進入後台治理功能（authority/backfill/MARC editor），需要 staff 登入。
          </Alert>
        ) : null}
        {staffReady && !staffSession ? (
          <Alert variant="warning" title="尚未 staff 登入">
            你仍可瀏覽索引，但多數後台頁會需要登入。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="搜尋" description="支援：功能名稱、描述、關鍵字、路由（例如：marc、650、backfill、inventory）。" />
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="Query" description="搜尋結果最多顯示 30 筆；你也可用 Ctrl/Cmd+K 開啟快捷跳轉。">
            <Field label="query" htmlFor="org_index_query">
              <input
                id="org_index_query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例：MARC / 650 / backfill / 盤點 / 稽核"
              />
            </Field>
          </FormSection>
        </Form>

        {results ? (
          results.length === 0 ? (
            <EmptyState title="沒有符合的功能" description="請改用其他關鍵字（可試：英文縮寫、tag、或中文同義詞）。" />
          ) : (
            <div className="tileGrid" style={{ marginTop: 12 }}>
              {results.map((item) => (
                <NavTile
                  key={item.id}
                  href={item.href}
                  icon={item.icon ? <NavIcon id={item.icon as NavIconId} size={20} /> : <NavIcon id="dashboard" size={20} />}
                  title={item.label}
                  description={item.description ?? item.href}
                  right={<code>{item.id}</code>}
                />
              ))}
            </div>
          )
        ) : (
          <div className="muted" style={{ marginTop: 8 }}>
            （輸入 query 後顯示搜尋結果）
          </div>
        )}
      </section>

      <section className="panel">
        <SectionHeader title="快速入口" description="把最常用的功能做成 tile，降低在側邊欄翻找的成本。" />
        {quickItems.length === 0 ? (
          <EmptyState title="尚無快速入口" description="（這通常不會發生；若發生表示 nav id 變更，需要更新 index page。）" />
        ) : (
          <div className="tileGrid">
            {quickItems.map((item) => (
              <NavTile
                key={item.id}
                href={item.href}
                icon={item.icon ? <NavIcon id={item.icon as NavIconId} size={20} /> : <NavIcon id="dashboard" size={20} />}
                title={item.label}
                description={item.description ?? '常用入口'}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <SectionHeader title="模組（Hub pages）" description="每個模組都有自己的「首頁」：用卡片/段落收納該區常見工作流與入口。" />
        <div className="tileGrid">
          {hubGroups.map((g) => (
            <NavTile
              key={g.id}
              href={hubHref(params.orgId, g.id)}
              icon={g.icon ? <NavIcon id={g.icon as NavIconId} size={20} /> : <NavIcon id="dashboard" size={20} />}
              title={g.label}
              description={hubDescription(g.id)}
              right={<span className="muted">{g.id}</span>}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

