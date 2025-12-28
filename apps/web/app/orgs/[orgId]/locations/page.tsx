/**
 * Locations Page（/orgs/:orgId/locations）
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/locations
 * - POST /api/v1/orgs/:orgId/locations
 * - PATCH /api/v1/orgs/:orgId/locations/:locationId
 *
 * 目的（US-001）：
 * - 列表：目前有哪些館別/分區/位置
 * - 建立：新增 location
 * - 編輯/停用：避免刪除造成歷史資料斷鏈
 *
 * 規則（後端也會 enforce）：
 * - inactive location 不可再被用於：
 *   - 新建冊（items.create / catalog import）
 *   - 新建預約的取書地點（holds.create / me.placeHold）
 *   - 新建盤點 session（inventory.createSession）
 */

// 需要動態抓資料與表單互動，因此用 Client Component。
'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { Location } from '../../../lib/api';
import { createLocation, listLocations, updateLocation } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

export default function LocationsPage({ params }: { params: { orgId: string } }) {
  // staff session：建立 location（POST）受 StaffAuthGuard 保護；本頁直接要求先登入避免 401。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // locations：目前載入到的 location 列表（null 代表尚未載入）。
  const [locations, setLocations] = useState<Location[] | null>(null);

  // loading/error：控制 UI 狀態。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------
  // 建立 location（表單）
  // ----------------------------

  // 表單欄位（controlled inputs）。
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [shelfCode, setShelfCode] = useState('');

  // create 狀態。
  const [creating, setCreating] = useState(false);

  // ----------------------------
  // 編輯/停用（US-001）
  // ----------------------------

  // editingId：目前正在編輯的 location（用 id 當 key；null 代表沒有編輯中）
  const [editingId, setEditingId] = useState<string | null>(null);

  // 編輯表單（與 create 表單分開，避免互相污染）
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editShelfCode, setEditShelfCode] = useState('');
  const [editStatus, setEditStatus] = useState<Location['status']>('active');

  // updatingId：用來 disable 按鈕，避免同一筆 location 被連點送出多次
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 重新抓列表（供初次載入與建立/更新成功後重用）。
  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const result = await listLocations(params.orgId);
      setLocations(result);
    } catch (e) {
      setLocations(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // 初次載入。
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    // 基本前端預檢：避免送空字串造成 400。
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    const trimmedArea = area.trim();
    const trimmedShelfCode = shelfCode.trim();

    if (!trimmedCode) {
      setError('code 不可為空');
      return;
    }
    if (!trimmedName) {
      setError('name 不可為空');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await createLocation(params.orgId, {
        code: trimmedCode,
        name: trimmedName,
        ...(trimmedArea ? { area: trimmedArea } : {}),
        ...(trimmedShelfCode ? { shelf_code: trimmedShelfCode } : {}),
      });

      // 成功後清空表單並刷新列表。
      setCode('');
      setName('');
      setArea('');
      setShelfCode('');
      await refresh();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(loc: Location) {
    setEditingId(loc.id);
    setEditCode(loc.code);
    setEditName(loc.name);
    setEditArea(loc.area ?? '');
    setEditShelfCode(loc.shelf_code ?? '');
    setEditStatus(loc.status);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditCode('');
    setEditName('');
    setEditArea('');
    setEditShelfCode('');
    setEditStatus('active');
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    const loc = (locations ?? []).find((l) => l.id === editingId);
    if (!loc) {
      setError('找不到要編輯的 location（請重新整理）');
      return;
    }

    // payload：只送「真的有變更」的欄位
    // - 好處 1：避免不必要更新 updated_at（與 audit 追溯）
    // - 好處 2：避免把舊資料格式「原封不動送回去」造成驗證失敗（例如 legacy code 大小寫）
    const payload: Parameters<typeof updateLocation>[2] = {};

    const trimmedCode = editCode.trim();
    const trimmedName = editName.trim();
    if (!trimmedCode) {
      setError('code 不可為空');
      return;
    }
    if (!trimmedName) {
      setError('name 不可為空');
      return;
    }

    if (trimmedCode !== loc.code) payload.code = trimmedCode;
    if (trimmedName !== loc.name) payload.name = trimmedName;

    // area/shelf_code：空字串視為清空（送 null）
    const normalizedArea = editArea.trim() ? editArea.trim() : null;
    const normalizedShelf = editShelfCode.trim() ? editShelfCode.trim() : null;

    if (normalizedArea !== (loc.area ?? null)) payload.area = normalizedArea;
    if (normalizedShelf !== (loc.shelf_code ?? null)) payload.shelf_code = normalizedShelf;

    if (editStatus !== loc.status) payload.status = editStatus;

    if (Object.keys(payload).length === 0) {
      setError('沒有任何變更需要儲存');
      return;
    }

    setUpdatingId(editingId);
    setError(null);
    try {
      await updateLocation(params.orgId, editingId, payload);
      await refresh();
      cancelEdit();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleStatus(loc: Location) {
    const next: Location['status'] = loc.status === 'active' ? 'inactive' : 'active';

    // 停用 location 會影響：新增冊/預約取書地點/盤點；前端做一次確認降低誤操作
    if (next === 'inactive') {
      const ok = window.confirm(
        `確認要停用 location「${loc.name}（${loc.code}）」嗎？\n\n停用後將不可再用於：新增冊、預約取書地點、開始盤點。`,
      );
      if (!ok) return;
    }

    setUpdatingId(loc.id);
    setError(null);
    try {
      await updateLocation(params.orgId, loc.id, { status: next });
      await refresh();
      if (editingId === loc.id) cancelEdit();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdatingId(null);
    }
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Locations</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Locations</h1>
          <p className="error">
            這頁需要 staff 登入才能管理 locations。請先前往{' '}
            <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Locations</h1>
        <p className="muted">
          對應 API：<code>GET/POST/PATCH /api/v1/orgs/:orgId/locations</code>
        </p>

        <form onSubmit={onCreate} className="stack" style={{ marginTop: 16 }}>
          <label>
            code（英數/dash；同 org 內唯一）
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例：MAIN 或 main" />
          </label>

          <label>
            name（顯示名稱）
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：圖書館主館" />
          </label>

          <label>
            area（選填）
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="例：小說區" />
          </label>

          <label>
            shelf_code（選填）
            <input
              value={shelfCode}
              onChange={(e) => setShelfCode(e.target.value)}
              placeholder="例：A-03"
            />
          </label>

          <button type="submit" disabled={creating}>
            {creating ? '建立中…' : '建立 Location'}
          </button>
        </form>

        {error ? <p className="error">錯誤：{error}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>列表</h2>
        {loading ? <p className="muted">載入中…</p> : null}

        {!loading && locations && locations.length === 0 ? (
          <p className="muted">目前沒有 locations。</p>
        ) : null}

        {!loading && locations && locations.length > 0 ? (
          <ul>
            {locations.map((loc) => {
              const isEditing = editingId === loc.id;
              const isUpdating = updatingId === loc.id;

              return (
                <li key={loc.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700 }}>{loc.name}</span>
                      <span className="muted">({loc.code})</span>
                      <span className={loc.status === 'active' ? 'success' : 'muted'}>
                        status={loc.status}
                      </span>
                    </div>

                    <div className="muted">
                      {loc.area ? <>area={loc.area}</> : <>area（空）</>}
                      {' · '}
                      {loc.shelf_code ? <>shelf={loc.shelf_code}</> : <>shelf（空）</>}
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => startEdit(loc)} disabled={isUpdating || isEditing}>
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void toggleStatus(loc);
                        }}
                        disabled={isUpdating}
                      >
                        {loc.status === 'active' ? '停用' : '啟用'}
                      </button>
                    </div>

                    {isEditing ? (
                      <form onSubmit={onSaveEdit} className="stack" style={{ marginTop: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label>
                            code（英數/dash）
                            <input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                          </label>

                          <label>
                            name
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                          </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label>
                            area（清空請留空）
                            <input value={editArea} onChange={(e) => setEditArea(e.target.value)} />
                          </label>

                          <label>
                            shelf_code（清空請留空）
                            <input value={editShelfCode} onChange={(e) => setEditShelfCode(e.target.value)} />
                          </label>
                        </div>

                        <label style={{ maxWidth: 240 }}>
                          status
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as Location['status'])}
                          >
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                          </select>
                        </label>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <button type="submit" disabled={updatingId === loc.id}>
                            {updatingId === loc.id ? '儲存中…' : '儲存'}
                          </button>
                          <button type="button" onClick={cancelEdit} disabled={updatingId === loc.id}>
                            取消
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
