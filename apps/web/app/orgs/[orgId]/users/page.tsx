/**
 * Users Page（/orgs/:orgId/users）
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/users?query=
 * - POST /api/v1/orgs/:orgId/users
 *
 * 這頁後續會提供：
 * - 搜尋與列表（external_id / name / org_unit）
 * - 建立 user（student/teacher/librarian/admin...）
 *
 * 注意：circulation 目前需要 actor_user_id，因此建立 librarian/admin 後才能借還。
 */

// 需要動態載入、搜尋與建立表單，因此用 Client Component。
'use client';

import { useEffect, useState } from 'react';

import type { User } from '../../../lib/api';
import { createUser, listUsers } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';

export default function UsersPage({ params }: { params: { orgId: string } }) {
  // users：目前載入到的 user 列表（null 代表尚未載入）。
  const [users, setUsers] = useState<User[] | null>(null);

  // loading/error：控制 UI 狀態。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 搜尋字串（query=...）。
  const [query, setQuery] = useState('');

  // 建立 user 的表單欄位。
  const [externalId, setExternalId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<User['role']>('student');
  const [orgUnit, setOrgUnit] = useState('');
  const [creating, setCreating] = useState(false);

  async function refresh(search?: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers(params.orgId, search);
      setUsers(result);
    } catch (e) {
      setUsers(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // 初次載入：列出最新 200 筆。
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    await refresh(trimmed ? trimmed : undefined);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    const trimmedExternalId = externalId.trim();
    const trimmedName = name.trim();
    const trimmedOrgUnit = orgUnit.trim();

    if (!trimmedExternalId) {
      setError('external_id 不可為空');
      return;
    }
    if (!trimmedName) {
      setError('name 不可為空');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await createUser(params.orgId, {
        external_id: trimmedExternalId,
        name: trimmedName,
        role,
        ...(trimmedOrgUnit ? { org_unit: trimmedOrgUnit } : {}),
      });

      // 成功後清空表單，並重新載入（維持 query 搜尋結果也可以；MVP 先回到全列表）。
      setExternalId('');
      setName('');
      setRole('student');
      setOrgUnit('');
      setQuery('');
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
        <h1 style={{ marginTop: 0 }}>Users</h1>
        <p className="muted">
          對應 API：<code>GET/POST /api/v1/orgs/:orgId/users</code>（可用 <code>?query=</code>{' '}
          搜尋）。
        </p>

        {/* 搜尋表單 */}
        <form onSubmit={onSearch} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ minWidth: 260 }}>
            搜尋（external_id / name / org_unit）
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：501 / 王小明 / S1130123" />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loading}>
              {loading ? '查詢中…' : '搜尋'}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                void refresh();
              }}
              disabled={loading}
            >
              清除
            </button>
          </div>
        </form>

        {/* 建立 user 表單 */}
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <form onSubmit={onCreate} className="stack">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              external_id（學號/員編；同 org 內唯一）
              <input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="例：S1130123"
              />
            </label>

            <label>
              name（姓名）
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：王小明" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              role（角色）
              <select value={role} onChange={(e) => setRole(e.target.value as User['role'])}>
                <option value="student">student（學生）</option>
                <option value="teacher">teacher（教師）</option>
                <option value="librarian">librarian（館員）</option>
                <option value="admin">admin（管理者）</option>
                <option value="guest">guest（訪客）</option>
              </select>
            </label>

            <label>
              org_unit（班級/單位，選填）
              <input value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)} placeholder="例：501" />
            </label>
          </div>

          <button type="submit" disabled={creating}>
            {creating ? '建立中…' : '建立 User'}
          </button>
        </form>

        {error ? <p className="error">錯誤：{error}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>列表</h2>

        {loading ? <p className="muted">載入中…</p> : null}
        {!loading && users && users.length === 0 ? <p className="muted">沒有符合條件的 users。</p> : null}

        {!loading && users && users.length > 0 ? (
          <ul>
            {users.map((u) => (
              <li key={u.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{u.name}</span>{' '}
                    <span className="muted">
                      ({u.role}, {u.status})
                    </span>
                  </div>
                  <div className="muted">
                    external_id={u.external_id}
                    {u.org_unit ? ` · org_unit=${u.org_unit}` : ''}
                  </div>
                  <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    id={u.id}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
