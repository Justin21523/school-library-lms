/**
 * OPAC：單一學校（/opac/orgs/:orgId）
 *
 * 這頁把「讀者自助」的兩個動作放在一起：
 * 1) 搜尋書目（bibs）
 * 2) 對某本書目建立預約（place hold）
 *
 * 版本演進：
 * - 早期 MVP：沒有登入，因此使用者必須自行輸入 `user_external_id`
 * - 目前：已支援 OPAC Account（Patron login）
 *   - 若已登入：使用 `/me/holds` 建立預約（安全、只允許本人）
 *   - 若未登入：仍保留 `user_external_id` 模式（可用但不安全；做為過渡）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { BibliographicRecordWithCounts, HoldWithDetails, Location } from '../../../lib/api';
import { createHold, listBibs, listLocations, placeMyHold } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useOpacSession } from '../../../lib/use-opac-session';

// OPAC 中「取書地點」只顯示 active locations，避免讀者選到停用地點造成後續困擾。
function isActiveLocation(location: Location) {
  return location.status === 'active';
}

export default function OpacOrgPage({ params }: { params: { orgId: string } }) {
  // OPAC session：若已登入，會用 /me 端點取代 user_external_id 模式。
  const { ready: sessionReady, session } = useOpacSession(params.orgId);

  // ----------------------------
  // 1) 讀者輸入（MVP：用 external_id 代替登入）
  // ----------------------------

  const [userExternalId, setUserExternalId] = useState('');

  // ----------------------------
  // 2) 取書地點（locations）
  // ----------------------------

  const [locations, setLocations] = useState<Location[] | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [pickupLocationId, setPickupLocationId] = useState('');

  const activeLocations = useMemo(() => (locations ?? []).filter(isActiveLocation), [locations]);

  // ----------------------------
  // 3) 書目搜尋（bibs）
  // ----------------------------

  const [query, setQuery] = useState('');
  const [bibs, setBibs] = useState<BibliographicRecordWithCounts[] | null>(null);
  const [loadingBibs, setLoadingBibs] = useState(false);

  // ----------------------------
  // 4) Place hold 動作狀態
  // ----------------------------

  // creatingBibId：哪一筆 bib 正在送出預約（用來 disable 對應按鈕）。
  const [creatingBibId, setCreatingBibId] = useState<string | null>(null);

  // 最近一次 place hold 的回傳（用來顯示成功訊息）
  const [lastCreatedHold, setLastCreatedHold] = useState<HoldWithDetails | null>(null);

  // 共用訊息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 初次載入：抓 locations，讓讀者選取書地點。
  useEffect(() => {
    async function run() {
      setLoadingLocations(true);
      setError(null);
      try {
        const result = await listLocations(params.orgId);
        setLocations(result);

        // 若尚未選取書地點，就預設第一個 active location（提升可用性）。
        if (!pickupLocationId) {
          const first = result.find(isActiveLocation);
          if (first) setPickupLocationId(first.id);
        }
      } catch (e) {
        setLocations(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoadingLocations(false);
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();

    setLoadingBibs(true);
    setError(null);
    setSuccess(null);
    setLastCreatedHold(null);

    try {
      // OPAC MVP 先做關鍵字查詢（query 會比對 title/creators/subjects 等）
      const result = await listBibs(params.orgId, { query: query.trim() || undefined });
      setBibs(result);
    } catch (e) {
      setBibs(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingBibs(false);
    }
  }

  async function onPlaceHold(bibId: string) {
    setError(null);
    setSuccess(null);
    setLastCreatedHold(null);

    const trimmedUserExternalId = userExternalId.trim();
    const trimmedPickupLocationId = pickupLocationId.trim();

    // 未登入時才需要 user_external_id（過渡模式）。
    if (!session && !trimmedUserExternalId) {
      setError('請先輸入 user_external_id（學號/員編）');
      return;
    }

    if (!trimmedPickupLocationId) {
      setError('請先選擇取書地點（pickup_location_id）');
      return;
    }

    setCreatingBibId(bibId);
    try {
      // 依登入狀態選擇「安全版本」或「過渡版本」：
      // - 已登入：走 /me（PatronAuthGuard），不需要也不允許前端傳 user_external_id
      // - 未登入：走 /holds（用 user_external_id 定位；可用但不安全）
      const result = session
        ? await placeMyHold(params.orgId, {
            bibliographic_id: bibId,
            pickup_location_id: trimmedPickupLocationId,
          })
        : await createHold(params.orgId, {
            bibliographic_id: bibId,
            user_external_id: trimmedUserExternalId,
            pickup_location_id: trimmedPickupLocationId,
          });

      setLastCreatedHold(result);
      setSuccess(`已建立預約：hold_id=${result.id}（status=${result.status}）`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreatingBibId(null);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>OPAC：搜尋與預約</h1>

        {sessionReady ? null : <p className="muted">載入登入狀態中…</p>}

        {sessionReady && session ? (
          <p className="muted">
            已登入：{session.user.name}（{session.user.role}）· <code>{session.user.external_id}</code>（可使用安全的{' '}
            <code>/me/*</code> 端點）
          </p>
        ) : null}

        {sessionReady && !session ? (
          <p className="muted">
            尚未登入：你仍可用 <code>user_external_id</code> 建立/查詢預約（過渡模式），但安全性較低；建議先{' '}
            <Link href={`/opac/orgs/${params.orgId}/login`}>登入 OPAC Account</Link>。
          </p>
        ) : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {!session ? (
            <label>
              user_external_id（學號/員編）
              <input
                value={userExternalId}
                onChange={(e) => setUserExternalId(e.target.value)}
                placeholder="例：S1130123"
              />
            </label>
          ) : (
            <div className="muted">
              user_external_id：<code>{session.user.external_id}</code>（由登入身分推導）
            </div>
          )}

          <label>
            取書地點（pickup location）
            <select
              value={pickupLocationId}
              onChange={(e) => setPickupLocationId(e.target.value)}
              disabled={loadingLocations}
            >
              <option value="">（請選擇）</option>
              {activeLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              href={
                session
                  ? `/opac/orgs/${params.orgId}/holds`
                  : userExternalId.trim()
                    ? `/opac/orgs/${params.orgId}/holds?user_external_id=${encodeURIComponent(userExternalId.trim())}`
                    : `/opac/orgs/${params.orgId}/holds`
              }
            >
              查看我的預約（Holds）
            </Link>
            <Link href={`/opac/orgs/${params.orgId}/loans`}>查看我的借閱（Loans）</Link>
            {!session ? <span className="muted">（會使用你目前輸入的 user_external_id）</span> : null}
          </div>
        </div>

        {loadingLocations ? <p className="muted">載入 locations 中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
        {lastCreatedHold ? (
          <p className="muted">
            最新預約：{lastCreatedHold.bibliographic_title} · status={lastCreatedHold.status}
            {lastCreatedHold.ready_until ? ` · ready_until=${lastCreatedHold.ready_until}` : ''}
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>搜尋書目</h2>

        <form onSubmit={onSearch} className="stack" style={{ marginTop: 12 }}>
          <label>
            query（關鍵字）
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：哈利波特" />
          </label>

          <button type="submit" disabled={loadingBibs}>
            {loadingBibs ? '搜尋中…' : '搜尋'}
          </button>
        </form>

        {loadingBibs ? <p className="muted">載入中…</p> : null}
        {!loadingBibs && bibs && bibs.length === 0 ? <p className="muted">沒有符合條件的書目。</p> : null}

        {!loadingBibs && bibs && bibs.length > 0 ? (
          <ul>
            {bibs.map((b) => (
              <li key={b.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>{b.title}</div>

                  <div className="muted">
                    可借冊數：{b.available_items} / 總冊數：{b.total_items}
                  </div>

                  <div className="muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    bibliographic_id={b.id}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => void onPlaceHold(b.id)}
                      disabled={creatingBibId === b.id}
                    >
                      {creatingBibId === b.id ? '預約中…' : '預約（Place hold）'}
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
