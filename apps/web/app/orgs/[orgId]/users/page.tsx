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
 *
 * Auth/權限（重要）：
 * - /users 端點屬於 staff 後台，受 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id（寫 audit 用）由登入者本人推導（session.user.id），不再提供下拉選擇（避免冒用）
 */

// 需要動態載入、搜尋與建立表單，因此用 Client Component。
'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { User } from '../../../lib/api';
import { createUser, listUsers, setStaffPassword, updateUser } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

export default function UsersPage({ params }: { params: { orgId: string } }) {
  // staff session：/users 端點受 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // actorUserId：用於停用/啟用（寫 audit），由登入者本人推導。
  const actorUserId = session?.user.id ?? '';

  // users：目前載入到的 user 列表（null 代表尚未載入）。
  const [users, setUsers] = useState<User[] | null>(null);

  // nextCursor：cursor pagination 的下一頁游標（null 代表沒有下一頁或尚未查詢）。
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // appliedFilters：目前列表實際採用的 filters（避免使用者改了輸入但沒按搜尋，卻拿舊 cursor 續查造成錯亂）
  const [appliedFilters, setAppliedFilters] = useState<{
    query?: string;
    role?: User['role'];
    status?: User['status'];
    limit?: number;
  } | null>(null);

  // loading/error：控制 UI 狀態。
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
  // 2) 停用/啟用備註（寫入 audit metadata；選填）
  // ----------------------------

  // 停用/啟用備註（寫入 audit metadata；選填）
  const [actionNote, setActionNote] = useState('');

  // 建立 user 的表單欄位。
  const [externalId, setExternalId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<User['role']>('student');
  const [orgUnit, setOrgUnit] = useState('');
  const [creating, setCreating] = useState(false);

  // editDraft：更正主檔（一次只編一位，避免同時展開多個表單造成混亂）
  // - 後端支援 PATCH name/role/org_unit/status（US-011）
  // - 這裡先把更正主檔落地：name/role/org_unit（status 仍保留「停用/啟用」按鈕）
  const [editDraft, setEditDraft] = useState<{
    userId: string;
    external_id: string;
    name: string;
    role: User['role'];
    org_unit: string; // UI 用 string；送出時空字串會轉成 null（清空）
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // 設定/重設密碼（避免同時點多個）
  const [settingPasswordUserId, setSettingPasswordUserId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setEditDraft(null); // 重新查詢時關閉編輯表單，避免編輯的是舊資料/舊 cursor
    try {
      const trimmedLimit = limit.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      const filters = {
        query: query.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        limit: limitNumber,
      };

      const result = await listUsers(params.orgId, filters);

      setUsers(result.items);
      setNextCursor(result.next_cursor);
      setAppliedFilters(filters);
    } catch (e) {
      setUsers(null);
      setNextCursor(null);
      setAppliedFilters(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    // 沒有 nextCursor 就代表沒有下一頁（或還沒查過）。
    if (!nextCursor || !appliedFilters) return;

    setLoadingMore(true);
    setError(null);
    setSuccess(null);

    try {
      const page = await listUsers(params.orgId, {
        ...appliedFilters,
        cursor: nextCursor,
      });

      setUsers((prev) => [...(prev ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  // 初次載入：列出最新 200 筆。
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

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

      // UX：建立後回到「全列表」，避免使用者以為沒成功（因為被 filter 擋掉）
      setQuery('');
      setRoleFilter('');
      setStatusFilter('');
      setLimit('200');
      await refresh();
      setSuccess('已建立 User');
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
      setError('缺少 actor_user_id（請先登入）');
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

      await refresh();
      setSuccess(`已更新使用者狀態：${user.external_id} → ${desired}`);
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  }

  /**
   * 更正主檔（name/role/org_unit）
   *
   * 對應 API：
   * - PATCH /api/v1/orgs/:orgId/users/:userId
   *
   * 權限提醒（對齊後端 UsersService.update）：
   * - actor 必須是 admin/librarian
   * - librarian 不可修改 staff（admin/librarian），也不可把人升級成 staff
   * - 這裡的 UI 先做「最小防呆」：librarian 看不到 staff 的編輯入口；角色選單也不提供 staff
   */
  function startEdit(user: User) {
    setError(null);
    setSuccess(null);

    setEditDraft({
      userId: user.id,
      external_id: user.external_id,
      name: user.name,
      role: user.role,
      org_unit: user.org_unit ?? '',
    });
  }

  function cancelEdit() {
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editDraft) return;

    setError(null);
    setSuccess(null);

    if (!actorUserId) {
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    const trimmedName = editDraft.name.trim();
    if (!trimmedName) {
      setError('name 不可為空');
      return;
    }

    // org_unit：空字串 → null（清空）；非空 → trim 後送出
    const trimmedOrgUnit = editDraft.org_unit.trim();
    const orgUnitOrNull = trimmedOrgUnit ? trimmedOrgUnit : null;

    setSavingEdit(true);
    try {
      await updateUser(params.orgId, editDraft.userId, {
        actor_user_id: actorUserId,
        name: trimmedName,
        role: editDraft.role,
        org_unit: orgUnitOrNull,
        ...(actionNote.trim() ? { note: actionNote.trim() } : {}),
      });

      await refresh();
      setSuccess(`已更正使用者資料：${editDraft.external_id}`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSavingEdit(false);
    }
  }

  /**
   * 設定/重設密碼（admin/librarian 動作）
   *
   * 對應 API：
   * - POST /api/v1/orgs/:orgId/auth/set-password（需 StaffAuthGuard）
   *
   * 重要：
   * - 後端已允許 target role 包含 student/teacher（用於 OPAC Account 登入）
   * - 但不允許 guest（多半沒有需要，且避免濫用）
   */
  async function onSetPassword(user: User) {
    setError(null);
    setSuccess(null);

    if (!actorUserId) {
      setError('缺少 actor_user_id（請先登入）');
      return;
    }

    if (user.role === 'guest') {
      setError('guest 帳號不支援設定密碼');
      return;
    }

    // prompt：MVP 先用最小可用方式取得新密碼（正式上線建議改成專用表單/強度檢查）
    const first = window.prompt(`請輸入要設定給 ${user.name}（${user.external_id}）的新密碼：`);
    if (first === null) return; // 使用者取消
    if (!first.trim()) {
      setError('new_password 不可為空');
      return;
    }

    const second = window.prompt('請再輸入一次新密碼（確認）：');
    if (second === null) return;
    if (second !== first) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    // 二次確認：避免誤把密碼設錯人（尤其是名冊匯入後常有大量帳號）
    const ok = window.confirm(`確認要替 ${user.name}（${user.external_id} / ${user.role}）設定/重設密碼嗎？`);
    if (!ok) return;

    setSettingPasswordUserId(user.id);
    try {
      await setStaffPassword(params.orgId, {
        actor_user_id: actorUserId,
        target_user_id: user.id,
        new_password: first,
        ...(actionNote.trim() ? { note: actionNote.trim() } : {}),
      });

      // 不回顯密碼（避免在畫面上留下敏感資訊）
      setSuccess(`已設定/重設密碼：${user.external_id}（讀者可用此密碼在 OPAC Login 登入）`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSettingPasswordUserId(null);
    }
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Users</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Users</h1>
          <p className="error">
            這頁需要 staff 登入才能管理 users。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
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

        <p className="muted">
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

        <label>
          note（選填；寫入 audit metadata：停用/啟用/重設密碼等動作都會共用這個備註）
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
          <div className="stack">
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
                    <div
                      className="muted"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                    >
                      id={u.id}
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {/* 更正主檔（name/role/org_unit） */}
                      {session.user.role === 'librarian' && (u.role === 'admin' || u.role === 'librarian') ? (
                        <button
                          type="button"
                          disabled
                          title="librarian 不可修改 staff（admin/librarian）帳號；需由 admin 操作"
                        >
                          更正資料
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          disabled={!actorUserId || loading}
                          title={!actorUserId ? '缺少 actor_user_id（請先登入）' : undefined}
                        >
                          更正資料
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void toggleUserStatus(u)}
                        disabled={
                          !actorUserId ||
                          loading ||
                          (session.user.role === 'librarian' && (u.role === 'admin' || u.role === 'librarian'))
                        }
                        title={
                          session.user.role === 'librarian' && (u.role === 'admin' || u.role === 'librarian')
                            ? 'librarian 不可修改 staff（admin/librarian）帳號；需由 admin 操作'
                            : !actorUserId
                              ? '缺少 actor_user_id（請先登入）'
                              : undefined
                        }
                      >
                        {u.status === 'active' ? '停用' : '啟用'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void onSetPassword(u)}
                        disabled={
                          !actorUserId ||
                          loading ||
                          settingPasswordUserId === u.id ||
                          u.role === 'guest'
                        }
                        title={
                          u.role === 'guest'
                            ? 'guest 不支援設定密碼'
                            : !actorUserId
                              ? '缺少 actor_user_id（請先登入）'
                              : undefined
                        }
                      >
                        {settingPasswordUserId === u.id ? '設定中…' : '設定/重設密碼'}
                      </button>
                    </div>

                    {/* 編輯表單：只展開在正在編輯的那一位 */}
                    {editDraft && editDraft.userId === u.id ? (
                      <form
                        className="stack"
                        style={{
                          marginTop: 8,
                          padding: 12,
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.03)',
                        }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveEdit();
                        }}
                      >
                        <div className="muted">
                          更正：<code>{u.external_id}</code>（external_id 不可在此頁更改）
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label>
                            name（姓名）
                            <input
                              value={editDraft.name}
                              onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            />
                          </label>

                          <label>
                            org_unit（班級/單位；留空=清空）
                            <input
                              value={editDraft.org_unit}
                              onChange={(e) => setEditDraft({ ...editDraft, org_unit: e.target.value })}
                              placeholder="例：501"
                            />
                          </label>
                        </div>

                        <label>
                          role（角色）
                          <select
                            value={editDraft.role}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, role: e.target.value as User['role'] })
                            }
                          >
                            {session.user.role === 'admin' ? (
                              <>
                                <option value="student">student（學生）</option>
                                <option value="teacher">teacher（教師）</option>
                                <option value="librarian">librarian（館員）</option>
                                <option value="admin">admin（管理者）</option>
                                <option value="guest">guest（訪客）</option>
                              </>
                            ) : (
                              <>
                                <option value="student">student（學生）</option>
                                <option value="teacher">teacher（教師）</option>
                                <option value="guest">guest（訪客）</option>
                              </>
                            )}
                          </select>
                          <div className="muted" style={{ marginTop: 6 }}>
                            備註：此更正會共用上方的 note（寫入 audit metadata）。
                          </div>
                        </label>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <button type="submit" disabled={savingEdit || loading}>
                            {savingEdit ? '儲存中…' : '儲存更正'}
                          </button>
                          <button type="button" onClick={cancelEdit} disabled={savingEdit || loading}>
                            取消
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            {nextCursor ? (
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore || loading}>
                {loadingMore ? '載入中…' : '載入更多'}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
