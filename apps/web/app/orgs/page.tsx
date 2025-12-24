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

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { Organization } from '../lib/api';
import { createOrganization, listOrganizations } from '../lib/api';
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
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Organizations</h1>

        <p className="muted">
          這裡對應 API：<code>/api/v1/orgs</code>。先建立一個 organization（學校/租戶），再進入其子功能頁。
        </p>

        {/* 建立 org 的表單 */}
        <form onSubmit={onCreate} className="stack" style={{ marginTop: 16 }}>
          <label>
            學校/單位名稱（name）
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：XX 國小" />
          </label>

          <label>
            代碼（code，選填，小寫/數字/dash）
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例：xxes-001"
            />
          </label>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={creating}>
              {creating ? '建立中…' : '建立 Organization'}
            </button>
            {created ? (
              <span className="success">
                已建立：<Link href={`/orgs/${created.id}`}>{created.name}</Link>
              </span>
            ) : null}
          </div>
        </form>

        {/* 錯誤訊息：集中顯示，避免表單每個欄位都重複。 */}
        {error ? <p className="error">錯誤：{error}</p> : null}
      </section>

      {/* 列表區：顯示所有 org，並提供進入 org dashboard 的連結 */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>列表</h2>

        {loading ? <p className="muted">載入中…</p> : null}

        {!loading && orgs && orgs.length === 0 ? <p className="muted">目前沒有 organization。</p> : null}

        {!loading && orgs && orgs.length > 0 ? (
          <ul>
            {orgs.map((org) => (
              <li key={org.id} style={{ marginBottom: 8 }}>
                <Link href={`/orgs/${org.id}`}>{org.name}</Link>{' '}
                <span className="muted">{org.code ? `(${org.code})` : '(no code)'}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
