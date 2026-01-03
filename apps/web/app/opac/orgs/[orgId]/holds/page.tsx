/**
 * OPAC：我的預約（/opac/orgs/:orgId/holds）
 *
 * 讀者在這裡可以：
 * - 取消 queued/ready holds
 *
 * 版本演進：
 * - 早期 MVP：用 user_external_id 查詢/取消（可用但不安全）
 * - 目前：已支援 OPAC Account（Patron login）
 *   - 一律使用 `/me/holds` 與 `/me/holds/:id/cancel`（PatronAuthGuard；只允許本人）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { HoldStatus, HoldWithDetails } from '../../../../lib/api';
import { cancelMyHold, listMyHolds } from '../../../../lib/api';
import { Alert } from '../../../../components/ui/alert';
import { CursorPagination } from '../../../../components/ui/cursor-pagination';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { SkeletonTable } from '../../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../../lib/error';
import { useOpacSession } from '../../../../lib/use-opac-session';

export default function OpacHoldsPage({ params }: { params: { orgId: string } }) {
  // OPAC session：/me 端點需要 PatronAuthGuard，因此必須先登入。
  const { ready: sessionReady, session } = useOpacSession(params.orgId);

  // status filter：OPAC 預設看全部（可依需求切到 ready/queued）
  const [status, setStatus] = useState<HoldStatus | 'all'>('all');

  // limit：避免一次載入過多（預設 200）
  const [limit, setLimit] = useState('200');

  // list 結果與狀態
  const [holds, setHolds] = useState<HoldWithDetails[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<
    | { mode: 'me'; status?: HoldStatus | 'all'; limit?: number }
    | null
  >(null);

  // cancel 動作狀態
  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);

  // 共用訊息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const meLabel = useMemo(() => {
    if (!session) return null;
    return `${session.user.name}（${session.user.role}）· ${session.user.external_id}`;
  }, [session]);

  const statusBadgeClass = useMemo(() => {
    // 用 badge 顯示 hold status（讓讀者一眼看懂「排隊/可取/已取消/已逾期」）
    return new Map<HoldStatus, string>([
      ['ready', 'badge badge--success'],
      ['queued', 'badge badge--info'],
      ['fulfilled', 'badge badge--success'],
      ['cancelled', 'badge badge--warning'],
      ['expired', 'badge badge--danger'],
    ]);
  }, []);

  async function refresh(overrides?: { status: HoldStatus | 'all'; limit: string }) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 注意：清除按鈕會「同時 setState + 重新查詢」；
      // React state 更新是非同步，因此 refresh 允許帶 overrides 確保查詢用的是新值。
      const effectiveStatus = overrides?.status ?? status;
      const effectiveLimitText = overrides?.limit ?? limit;

      // limit：空字串視為未提供；否則轉 int。
      const trimmedLimit = effectiveLimitText.trim();
      const limitNumber = trimmedLimit ? Number.parseInt(trimmedLimit, 10) : undefined;
      if (trimmedLimit && !Number.isFinite(limitNumber)) {
        throw new Error('limit 必須是整數');
      }

      // /me/holds（PatronAuthGuard；只允許本人）
      if (!session) throw new Error('請先登入 OPAC Account 才能查看預約。');

      const page = await listMyHolds(params.orgId, {
        status: effectiveStatus,
        limit: limitNumber,
      });

      setHolds(page.items);
      setNextCursor(page.next_cursor);
      setAppliedFilters({ mode: 'me', status: effectiveStatus, limit: limitNumber });
    } catch (e) {
      setHolds(null);
      setNextCursor(null);
      setAppliedFilters(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || !appliedFilters) return;
    if (!session) return;

    setLoadingMore(true);
    setError(null);
    setSuccess(null);

    try {
      const page = await listMyHolds(params.orgId, {
        status: appliedFilters.status,
        limit: appliedFilters.limit,
        cursor: nextCursor,
      });

      setHolds((prev) => [...(prev ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  // 初次載入（已登入）：直接列出我的 holds（避免使用者還要按一次查詢）。
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await refresh();
  }

  async function onCancel(holdId: string) {
    setError(null);
    setSuccess(null);

    if (!session) {
      setError('請先登入 OPAC Account 才能取消預約。');
      return;
    }

    setCancellingHoldId(holdId);
    try {
      // /me/holds/:id/cancel（PatronAuthGuard 保證只能取消自己的 hold）
      const result = await cancelMyHold(params.orgId, holdId);
      await refresh();
      setSuccess(`已取消：hold_id=${result.id}`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCancellingHoldId(null);
    }
  }

  // Login gate（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="我的預約" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="我的預約" description="查看與取消預約需要先登入 OPAC Account。" />
        <Alert variant="warning" title="尚未登入" role="status">
          請先登入後再查看「我的預約」。
        </Alert>
        <div className="toolbar">
          <div className="toolbarLeft">
            <Link className="btnSmall btnPrimary" href={`/opac/orgs/${params.orgId}/login`}>
              登入
            </Link>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}`}>
              回到搜尋
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="我的預約"
        description={
          <>
            目前使用者：{meLabel}；對應 API：<code>GET /api/v1/orgs/:orgId/me/holds</code>
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}`}>
              回到搜尋
            </Link>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/loans`}>
              我的借閱
            </Link>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/logout`}>
              登出
            </Link>
          </>
        }
      >
        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert variant="success" title="已完成" role="status">
            {success}
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="查詢" description="支援 status 篩選；limit 預設 200（cursor-based pagination）。" />

        <Form onSubmit={onSearch}>
          <FormSection title="Filters" description="（提示）已登入時會由 token 推導本人身分。">
            <div className="grid2">
              <div className="callout" style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 900 }}>user_external_id</div>
                <div className="muted">
                  <code>{session.user.external_id}</code>（由登入身分推導）
                </div>
              </div>

              <Field label="status" htmlFor="opac_holds_status">
                <select id="opac_holds_status" value={status} onChange={(e) => setStatus(e.target.value as HoldStatus | 'all')}>
                  <option value="all">all（全部）</option>
                  <option value="ready">ready（可取書）</option>
                  <option value="queued">queued（排隊中）</option>
                  <option value="fulfilled">fulfilled（已取書借出）</option>
                  <option value="cancelled">cancelled（已取消）</option>
                  <option value="expired">expired（已逾期）</option>
                </select>
              </Field>
            </div>

            <Field label="limit（預設 200）" htmlFor="opac_holds_limit" className="field--narrow">
              <input id="opac_holds_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </Field>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '查詢中…' : '查詢'}
              </button>
              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  const nextStatus: HoldStatus | 'all' = 'all';
                  const nextLimit = '200';
                  setStatus(nextStatus);
                  setLimit(nextLimit);
                  // 已登入：清除代表「回到預設條件」並立刻重新查詢（避免畫面變成空白）。
                  void refresh({ status: nextStatus, limit: nextLimit });
                }}
                disabled={loading || loadingMore}
              >
                清除
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="結果" description={holds ? `showing ${holds.length}` : undefined} />

        {loading && !holds ? <SkeletonTable columns={5} rows={8} /> : null}

        {!loading && !holds ? <EmptyState title="尚未查詢" description="請先設定條件後按「查詢」。" /> : null}

        {!loading && holds && holds.length === 0 ? <EmptyState title="沒有符合條件的預約" description="你可以調整 status 後再查詢。" /> : null}

        {!loading && holds && holds.length > 0 ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <DataTable<HoldWithDetails>
              rows={holds}
              getRowKey={(h) => h.id}
              density="compact"
              initialSort={{ columnId: 'placed_at', direction: 'desc' }}
              columns={[
                {
                  id: 'title',
                  header: 'title',
                  sortValue: (h) => h.bibliographic_title,
                  cell: (h) => (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 900 }}>{h.bibliographic_title}</span>
                        <span className={statusBadgeClass.get(h.status) ?? 'badge'}>{h.status}</span>
                      </div>
                      <div className="muted">
                        pickup=<code>{h.pickup_location_code}</code> · item=<code>{h.assigned_item_barcode ?? '—'}</code>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'placed_at',
                  header: 'placed_at',
                  sortValue: (h) => h.placed_at,
                  width: 200,
                  cell: (h) => <span className="muted">{h.placed_at}</span>,
                },
                {
                  id: 'ready_until',
                  header: 'ready_until',
                  sortValue: (h) => h.ready_until ?? '',
                  width: 200,
                  cell: (h) => <span className="muted">{h.ready_until ?? '—'}</span>,
                },
                {
                  id: 'id',
                  header: 'id',
                  sortValue: (h) => h.id,
                  width: 140,
                  cell: (h) => <code>{h.id.slice(0, 8)}…</code>,
                },
              ]}
              rowActionsHeader="actions"
              rowActionsWidth={140}
              rowActions={(h) =>
                h.status === 'queued' || h.status === 'ready' ? (
                  <button type="button" className="btnDanger" onClick={() => void onCancel(h.id)} disabled={cancellingHoldId === h.id}>
                    {cancellingHoldId === h.id ? '取消中…' : '取消'}
                  </button>
                ) : (
                  <span className="muted">—</span>
                )
              }
            />

            <CursorPagination
              showing={holds.length}
              nextCursor={nextCursor}
              loading={loading}
              loadingMore={loadingMore}
              onLoadMore={() => void loadMore()}
              meta={
                appliedFilters ? (
                  <>
                    mode=<code>{appliedFilters.mode}</code> · status=<code>{appliedFilters.status ?? 'all'}</code> · limit=
                    <code>{appliedFilters.limit ?? 200}</code>
                  </>
                ) : undefined
              }
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
