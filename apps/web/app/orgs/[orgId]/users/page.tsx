/**
 * Users Page（/orgs/:orgId/users）
 *
 * 對應 API：
 * - GET   /api/v1/orgs/:orgId/users?query=&role=&status=&limit=
 * - POST /api/v1/orgs/:orgId/users
 * - PATCH /api/v1/orgs/:orgId/users/:userId（US-011：停用/啟用/更正主檔）
 *
 * 這頁後續會提供：
 * - 搜尋與列表（external_id / name / org_unit）
 * - 建立 user（student/teacher/librarian/admin...）
 * - 依 role/status 篩選（US-011）
 * - 停用/啟用（US-011；寫入 audit_events）
 *
 * 注意：circulation 目前需要 actor_user_id，因此建立 librarian/admin 後才能借還。
 */

// 需要動態載入、搜尋與建立表單，因此用 Client Component。
'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { User } from '../../../lib/api';
import { createUser, listUsers, updateUser } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';

// actor 候選人：必須是 active 的 admin/librarian（對齊後端最小 RBAC）
function isActorCandidate(user: User) {
  return user.status === 'active' && (user.role === 'admin' || user.role === 'librarian');
}

export default function UsersPage({ params }: { params: { orgId: string } }) {
  // users：目前載入到的 user 列表（null 代表尚未載入）。
  const [users, setUsers] = useState<User[] | null>(null);

  // loading/error：控制 UI 狀態。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ----------------------------
  // 1) 查詢條件（US-011）
  // ----------------------------

  // query：模糊搜尋（external_id/name/org_unit）
  const [query, setQuery] = useState('');

  // role/status：精準篩選
  const [roleFilter, setRoleFilter] = useState<User['role'] | ''>('');
  const [statusFilter, setStatusFilter] = useState<User['status'] | ''>('');

  // limit：避免一次載入過多（預設 200）
  const [limit, setLimit] = useState('200');

  // ----------------------------
  // 2) actor（操作者，用於停用/啟用）
  // ----------------------------

  // 這頁「查詢 users」本身不需要 actor（MVP 尚未做 auth）；
  // 但「停用/啟用」是敏感操作，因此 PATCH 必須帶 actor_user_id（admin/librarian）。
  const [actorUsers, setActorUsers] = useState<User[] | null>(null);
  const [loadingActors, setLoadingActors] = useState(false);
  const [actorUserId, setActorUserId] = useState('');
  const actorCandidates = useMemo(() => (actorUsers ?? []).filter(isActorCandidate), [actorUsers]);

  // 停用/啟用備註（寫入 audit metadata；選填）
  const [actionNote, setActionNote] = useState('');

  // 建立 user 的表單欄位。
  const [externalId, setExternalId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<User['role']>('student');
  const [orgUnit, setOrgUnit] = useState('');
  const [creating, setCreating] = useState(false);

  // 初次載入/切換 org：抓 actor 候選人（admin/librarian）
  // - 這份清單不應該被「role/status filter」影響，否則使用者會卡住無法操作停用/啟用
  useEffect(() => {
    async function loadActors() {
      setLoadingActors(true);
      setError(null);

      try {
        // API 的 role filter 一次只能選一個，因此這裡用兩次呼叫取回 admin + librarian
        const [admins, librarians] = await Promise.all([
          listUsers(params.orgId, { role: 'admin', status: 'active', limit: 200 }),
          listUsers(params.orgId, { role: 'librarian', status: 'active', limit: 200 }),
        ]);

        const merged = [...admins, ...librarians];
        setActorUsers(merged);

        // 若尚未選 actor，就預設第一個可用館員（提升可用性）
        if (!actorUserId) {
          const first = merged.find(isActorCandidate);
          if (first) setActorUserId(first.id);
        }
      } catch (e) {
        setActorUsers(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoadingActors(false);
      }
    }

    void loadActors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const result = await listUsers(params.orgId, {
        query: query.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        limit: limitNumber,
      });

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
    await refresh();
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
    setSuccess(null);

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
      setSuccess('已建立 User');

      // UX：建立後回到「全列表」，避免使用者以為沒成功（因為被 filter 擋掉）
      setQuery('');
      setRoleFilter('');
      setStatusFilter('');
      setLimit('200');
      await refresh();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  async function toggleUserStatus(user: User) {
    setError(null);
    setSuccess(null);

    if (!actorUserId) {
      setError('請先選擇 actor_user_id（館員/管理者）');
      return;
    }

    const desired = user.status === 'active' ? 'inactive' : 'active';

    // 停用通常影響借還/預約；前端做一次確認，降低誤操作
    if (desired === 'inactive') {
      const ok = window.confirm(`確認要停用 ${user.name}（${user.external_id}）嗎？停用後將無法借書/預約。`);
      if (!ok) return;
    }

    try {
      await updateUser(params.orgId, user.id, {
        actor_user_id: actorUserId,
        status: desired,
        ...(actionNote.trim() ? { note: actionNote.trim() } : {}),
      });

      setSuccess(`已更新使用者狀態：${user.external_id} → ${desired}`);
      await refresh();
    } catch (e) {
      setError(formatErrorMessage(e));
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
        <p className="muted">
          批次名冊匯入（US-010）：<Link href={`/orgs/${params.orgId}/users/import`}>Users CSV Import</Link>
        </p>

        {/* actor（用於停用/啟用） */}
        <label>
          actor_user_id（停用/啟用用；admin/librarian）
          <select
            value={actorUserId}
            onChange={(e) => setActorUserId(e.target.value)}
            disabled={loading || loadingActors}
          >
            <option value="">（請選擇）</option>
            {actorCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role}) · {u.external_id}
              </option>
            ))}
          </select>
        </label>
        {loadingActors ? <p className="muted">載入可用 actor 中…</p> : null}

        <label>
          note（選填；寫入 audit metadata）
          <input
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="例：113-1 畢業名單停用 / 班級升級更正"
          />
        </label>

        {/* 搜尋表單 */}
        <form onSubmit={onSearch} style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ minWidth: 260 }}>
            搜尋（external_id / name / org_unit）
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：501 / 王小明 / S1130123" />
          </label>

          <label>
            role（選填）
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
              <option value="">（全部）</option>
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="librarian">librarian</option>
              <option value="admin">admin</option>
              <option value="guest">guest</option>
            </select>
          </label>

          <label>
            status（選填）
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="">（全部）</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>

          <label style={{ width: 120 }}>
            limit
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loading}>
              {loading ? '查詢中…' : '搜尋'}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setRoleFilter('');
                setStatusFilter('');
                setLimit('200');
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
        {success ? <p className="success">{success}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>列表</h2>

        {loading ? <p className="muted">載入中…</p> : null}
        {!loading && users && users.length === 0 ? <p className="muted">沒有符合條件的 users。</p> : null}

        {!loading && users && users.length > 0 ? (
          <ul>
            {users.map((u) => (
              <li key={u.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'grid', gap: 6 }}>
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

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => void toggleUserStatus(u)}
                      disabled={!actorUserId || loading}
                      title={!actorUserId ? '請先選擇 actor_user_id（館員/管理者）' : undefined}
                    >
                      {u.status === 'active' ? '停用' : '啟用'}
                    </button>
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
