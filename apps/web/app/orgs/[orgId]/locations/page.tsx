/**
 * Locations Page（/orgs/:orgId/locations）
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/locations
 * - POST /api/v1/orgs/:orgId/locations
 *
 * 這頁後續會提供：
 * - 列表（目前有哪些館別/分區）
 * - 建立 location（code/name/area/shelf_code）
 */

// 需要動態抓資料與表單互動，因此用 Client Component。
'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { Location } from '../../../lib/api';
import { createLocation, listLocations } from '../../../lib/api';
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

  // 表單欄位（controlled inputs）。
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [shelfCode, setShelfCode] = useState('');

  // create 狀態。
  const [creating, setCreating] = useState(false);

  // 重新抓列表（供初次載入與建立成功後重用）。
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
          對應 API：<code>GET/POST /api/v1/orgs/:orgId/locations</code>
        </p>

        <form onSubmit={onCreate} className="stack" style={{ marginTop: 16 }}>
          <label>
            code（小寫/數字/dash；同 org 內唯一）
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例：main" />
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
            {locations.map((loc) => (
              <li key={loc.id} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{loc.name}</span>{' '}
                <span className="muted">({loc.code})</span>
                {loc.area ? <span className="muted"> · area={loc.area}</span> : null}
                {loc.shelf_code ? <span className="muted"> · shelf={loc.shelf_code}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
