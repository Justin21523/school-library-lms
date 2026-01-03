/**
 * Organizations Page（/orgs）
 *
 * 這頁是 Web Console 的入口：
 * - 列出目前所有 organizations（學校/租戶）
 * - 建立新的 organization（對應 API：POST /api/v1/orgs）
 *
 * 後續你會看到所有資源都掛在 /orgs/:orgId/...：
 * - 這與 API 的多租戶邊界完全一致，能降低「前端與後端對 org 範圍理解不同」的風險
 */

// 這頁需要表單互動與動態載入，因此使用 Client Component。
'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { Organization } from '../lib/api';
import { createOrganization, listOrganizations } from '../lib/api';
import { NavIcon } from '../components/layout/nav-icons';
import { Alert } from '../components/ui/alert';
import { DataTable } from '../components/ui/data-table';
import { EmptyState } from '../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../components/ui/form';
import { NavTile } from '../components/ui/nav-tile';
import { PageHeader, SectionHeader } from '../components/ui/page-header';
import { SkeletonTable, SkeletonTiles } from '../components/ui/skeleton';
import { formatErrorMessage } from '../lib/error';

export default function OrgsPage() {
  // orgs：目前載入到的 organizations（null 代表尚未載入）。
  const [orgs, setOrgs] = useState<Organization[] | null>(null);

  // loading/error：用來控制 UI 顯示狀態。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表單欄位（controlled inputs）。
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  // create 的狀態與結果（成功後可以提示使用者）。
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Organization | null>(null);

  // list filter：org 多時避免靠掃視（也讓 UI 更像「入口索引」而非原始資料表）
  const [listQuery, setListQuery] = useState('');

  // 載入 org 列表（抽成函式，建立成功後可重用）。
  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await listOrganizations();
      setOrgs(result);
    } catch (e) {
      setError(formatErrorMessage(e));
    setOrgs(null);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrgs = useMemo(() => {
    if (!orgs) return null;
    const q = listQuery.trim().toLowerCase();
    const items = q
      ? orgs.filter((o) => {
          if (o.name.toLowerCase().includes(q)) return true;
          if ((o.code ?? '').toLowerCase().includes(q)) return true;
          if (o.id.toLowerCase().includes(q)) return true;
          return false;
        })
      : orgs;

    // UI：卡片視圖預設以名稱排序（更符合「選擇入口」的心理模型）
    return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [listQuery, orgs]);

  // 初次進頁面就載入列表。
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 提交建立 org 表單。
  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    // 基本的前端預檢：避免送空字串造成 400。
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName) {
      setError('name 不可為空');
      return;
    }

    setCreating(true);
    setError(null);
    setCreated(null);

    try {
      const result = await createOrganization({
        name: trimmedName,
        // code 是 optional：空字串視為未提供（符合 API schema）。
        ...(trimmedCode ? { code: trimmedCode } : {}),
      });

      setCreated(result);
      setName('');
      setCode('');

      // 建立成功後重新載入列表，讓 UI 立即更新。
      await refresh();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Organizations（學校/租戶）"
        description="先選擇一個 organization 進入後台；你也可以在這裡建立新的 org（用卡片式入口降低導航成本）。"
        actions={
          <>
            <Link className="btnSmall" href="/">
              回首頁
            </Link>
            <Link className="btnSmall" href="/opac">
              OPAC
            </Link>
            <Link className="btnSmall btnPrimary" href="#create">
              建立 Org
            </Link>
          </>
        }
      >
        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}

        {created ? (
          <Alert variant="success" title="已建立 Organization" role="status">
            <Link href={`/orgs/${created.id}`}>{created.name}</Link>
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader
          title="選擇 Organization"
          description="用卡片選擇要進入的學校/租戶；可用搜尋快速定位。"
          actions={
            <button type="button" className="btnSmall" onClick={() => void refresh()} disabled={loading}>
              {loading ? '載入中…' : '重新整理'}
            </button>
          }
        />

        <div className="grid2" style={{ alignItems: 'end', marginTop: 12 }}>
          <label>
            搜尋（name / code / id）
            <input value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="例：示範國小 / demo / 550e…" />
          </label>
          <div className="muted" style={{ fontSize: 13 }}>
            {filteredOrgs ? (
              <>
                顯示 <code>{filteredOrgs.length}</code> 筆
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

        {!loading && !orgs ? (
          <EmptyState
            title="尚未載入"
            description="目前沒有資料可顯示（可能是載入失敗）。你可以重試。"
            actions={
              <button type="button" className="btnPrimary" onClick={() => void refresh()}>
                重試載入
              </button>
            }
          />
        ) : null}

        {!loading && orgs && orgs.length === 0 ? (
          <EmptyState
            title="目前沒有 organization"
            description="先建立第一個 organization（學校/租戶），再進入其後台功能。"
            actions={
              <Link className="btnSmall btnPrimary" href="#create">
                建立 Org
              </Link>
            }
          />
        ) : null}

        {!loading && filteredOrgs && filteredOrgs.length > 0 ? (
          <>
            <div className="tileGrid" style={{ marginTop: 12 }}>
              {filteredOrgs.map((o) => (
                <NavTile
                  key={o.id}
                  href={`/orgs/${o.id}`}
                  icon={<NavIcon id="dashboard" size={20} />}
                  title={o.name}
                  description={
                    <>
                      <span className="muted">code：</span>
                      <code>{o.code ?? '(no code)'}</code>
                      <span className="muted"> · id：</span>
                      <code>{o.id.slice(0, 8)}…</code>
                    </>
                  }
                  right={<span className="muted">開啟</span>}
                />
              ))}
            </div>

            {/* 進階：保留表格視圖（密集資料/複製 id） */}
            <details className="details" style={{ marginTop: 12 }}>
              <summary>
                <span>表格視圖（進階）</span>
                <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>
                  支援排序、可複製完整 id
                </span>
              </summary>
              <div className="detailsBody">
                <DataTable
                  rows={filteredOrgs}
                  getRowKey={(o) => o.id}
                  density="compact"
                  getRowHref={(o) => `/orgs/${o.id}`}
                  initialSort={{ columnId: 'name', direction: 'asc' }}
                  sortHint="排序僅影響目前已載入資料（/orgs 通常一次載入全部）。"
                  columns={[
                    {
                      id: 'name',
                      header: 'Organization',
                      cell: (o) => <Link href={`/orgs/${o.id}`}>{o.name}</Link>,
                      sortValue: (o) => o.name,
                    },
                    {
                      id: 'code',
                      header: 'code',
                      cell: (o) => <span className="muted">{o.code ?? '(no code)'}</span>,
                      sortValue: (o) => o.code ?? '',
                      width: 220,
                    },
                    {
                      id: 'id',
                      header: 'id',
                      cell: (o) => <code>{o.id}</code>,
                      sortValue: (o) => o.id,
                      width: 310,
                    },
                  ]}
                />
              </div>
            </details>
          </>
        ) : null}
      </section>

      <section className="panel" id="create">
        <SectionHeader title="建立 Organization" description="name 必填；code 選填（建議小寫/數字/dash）。" />

        {/* 建立 org 的表單（用統一的 FormSection 容器，讓段落/錯誤呈現一致） */}
        <Form onSubmit={onCreate}>
          <FormSection title="基本資料" description="建立後你就能進入該 org 的 Dashboard，並開始設定 users/locations/編目與流通。">
            <div className="grid2">
              <Field label="學校/單位名稱（name）" htmlFor="org_name">
                <input id="org_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：XX 國小" />
              </Field>

              <Field label="代碼（code，選填）" htmlFor="org_code" hint="例：xxes-001">
                <input id="org_code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例：xxes-001" />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={creating}>
                {creating ? '建立中…' : '建立 Organization'}
              </button>
              <button type="button" className="btnSmall" onClick={() => void refresh()} disabled={creating || loading}>
                重新整理列表
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </section>
    </div>
  );
}
