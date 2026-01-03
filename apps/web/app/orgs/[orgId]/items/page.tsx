/**
 * Items Page（/orgs/:orgId/items）
 *
 * 對應 API：
 * - GET /api/v1/orgs/:orgId/items?barcode=&status=&location_id=&bibliographic_id=
 *
 * 這頁後續會提供：
 * - 以條碼/狀態/位置/書目篩選冊
 * - 進入 item 詳細頁（/orgs/:orgId/items/:itemId）更新狀態/位置/備註
 */

// 需要篩選表單與動態載入，因此用 Client Component。
'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { ItemCopyWithContext, ItemStatus, Location } from '../../../lib/api';
import { listItems, listLocations } from '../../../lib/api';
import { Alert } from '../../../components/ui/alert';
import { CursorPagination } from '../../../components/ui/cursor-pagination';
import { DataTable } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

export default function ItemsPage({ params }: { params: { orgId: string } }) {
  // staff session：items 端點受 StaffAuthGuard 保護，因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // items list：後端已 join bib/location，因此我們用含 context 的 type 讓 UI 能直接顯示「名稱」。
  const [items, setItems] = useState<ItemCopyWithContext[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{
    query?: string;
    barcode?: string;
    status?: ItemStatus;
    location_id?: string;
    limit?: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 篩選條件（對應 API query params）。
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<ItemStatus | ''>('');
  const [locationId, setLocationId] = useState('');

  // locations：讓「位置篩選」用下拉選單（避免要求館員手輸 UUID）。
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => {
    if (!sessionReady || !session) return;

    async function run() {
      setLoadingLocations(true);
      try {
        const result = await listLocations(params.orgId);
        setLocations(result);
      } catch (e) {
        // locations 只是輔助；即使載入失敗也不阻斷 items 查詢
        setLocations(null);
      } finally {
        setLoadingLocations(false);
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  async function refresh(filters?: {
    query?: string;
    barcode?: string;
    status?: string;
    location_id?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      // 這頁的 filter 都是可選；空物件代表「列出最新 items」。
      const effective = (filters ?? {}) as {
        query?: string;
        barcode?: string;
        status?: ItemStatus;
        location_id?: string;
      };

      const result = await listItems(params.orgId, effective);
      setItems(result.items);
      setNextCursor(result.next_cursor);
      setAppliedFilters(effective);
    } catch (e) {
      setItems(null);
      setNextCursor(null);
      setAppliedFilters(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || !appliedFilters) return;

    setLoadingMore(true);
    setError(null);
    try {
      const page = await listItems(params.orgId, { ...appliedFilters, cursor: nextCursor });
      setItems((prev) => [...(prev ?? []), ...page.items]);
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

  async function onFilter(e: React.FormEvent) {
    e.preventDefault();
    await refresh({
      query: query.trim() || undefined,
      barcode: barcode.trim() || undefined,
      status: status || undefined,
      location_id: locationId.trim() || undefined,
    });
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Items</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Items</h1>
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查詢 items。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </section>
      </div>
    );
  }

  function statusBadgeVariant(s: ItemStatus): 'success' | 'info' | 'danger' | 'warning' {
    // 這裡的 badge 不是「規則」本身（規則在後端），而是給館員更快掃描的視覺 cue：
    // - available：可借（綠）
    // - checked_out/on_hold：流通中（藍）
    // - lost/withdrawn：異常/不可用（紅）
    // - repair：維修中（黃）
    if (s === 'available') return 'success';
    if (s === 'lost' || s === 'withdrawn') return 'danger';
    if (s === 'repair') return 'warning';
    return 'info';
  }

  return (
    <div className="stack">
      <PageHeader
        title="Items"
        description={
          <>
            對應 API：<code>GET /api/v1/orgs/:orgId/items</code>（支援 <code>query</code>/<code>barcode</code>/<code>status</code>/<code>location_id</code>）
          </>
        }
      >

        <Form onSubmit={onFilter}>
          <FormSection title="篩選" description="優先用 query（書名/條碼/索書號/館別）快速找；其他條件為選填。">
            <div className="grid3">
              <Field label="query（書名/條碼/索書號/館別）" htmlFor="items_query">
                <input
                  id="items_query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例：哈利波特 / LIB- / 823 / 兒童閱覽"
                />
              </Field>

              <Field label="barcode（模糊）" htmlFor="items_barcode">
                <input
                  id="items_barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="例：LIB-"
                />
              </Field>

              <Field label="status" htmlFor="items_status">
                <select id="items_status" value={status} onChange={(e) => setStatus(e.target.value as ItemStatus | '')}>
                  <option value="">（不指定）</option>
                  <option value="available">available</option>
                  <option value="checked_out">checked_out</option>
                  <option value="on_hold">on_hold</option>
                  <option value="lost">lost</option>
                  <option value="withdrawn">withdrawn</option>
                  <option value="repair">repair</option>
                </select>
              </Field>

              <Field label="location（館別/位置）" htmlFor="items_location_id">
                <select
                  id="items_location_id"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={loadingLocations}
                >
                  <option value="">（不指定）</option>
                  {(locations ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} · {l.name}
                      {l.status === 'inactive' ? '（inactive）' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '查詢中…' : '篩選'}
              </button>
              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  setQuery('');
                  setBarcode('');
                  setStatus('');
                  setLocationId('');
                  void refresh();
                }}
                disabled={loading}
              >
                清除
              </button>
            </FormActions>
          </FormSection>
        </Form>

        {error ? (
          <Alert variant="danger" title="查詢失敗">
            {error}
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="結果" />
        {loading && !items ? <SkeletonTable columns={5} rows={8} /> : null}

        {!loading && !items ? (
          <EmptyState
            title="尚無資料"
            description="目前沒有 items 可顯示（可能是查詢失敗或尚未建立）。"
            actions={
              <button type="button" className="btnPrimary" onClick={() => void refresh()}>
                重試載入
              </button>
            }
          />
        ) : null}

        {!loading && items && items.length === 0 ? (
          <EmptyState title="沒有符合條件的 items" description="你可以調整篩選條件或清除條件後再試一次。" />
        ) : null}

        {items && items.length > 0 ? (
          <div className="stack">
            <DataTable
              rows={items}
              getRowKey={(i) => i.id}
              density="compact"
              initialSort={{ columnId: 'barcode', direction: 'asc' }}
              sortHint="排序僅影響目前已載入資料（cursor pagination）。"
              getRowHref={(i) => `/orgs/${params.orgId}/items/${i.id}`}
              columns={[
                {
                  id: 'barcode',
                  header: 'barcode',
                  cell: (i) => <Link href={`/orgs/${params.orgId}/items/${i.id}`}>{i.barcode}</Link>,
                  sortValue: (i) => i.barcode,
                },
                {
                  id: 'bibliographic_title',
                  header: 'bib',
                  cell: (i) => (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <Link href={`/orgs/${params.orgId}/bibs/${i.bibliographic_id}`} style={{ fontWeight: 800 }}>
                        {i.bibliographic_title}
                      </Link>
                      <span className="muted" style={{ fontFamily: 'var(--font-mono)' }}>
                        {i.bibliographic_isbn ? (
                          <>
                            ISBN <code>{i.bibliographic_isbn}</code>
                          </>
                        ) : (
                          'ISBN（無）'
                        )}
                        {i.bibliographic_classification ? (
                          <>
                            {' '}
                            · class <code>{i.bibliographic_classification}</code>
                          </>
                        ) : null}
                      </span>
                    </div>
                  ),
                  sortValue: (i) => i.bibliographic_title,
                },
                {
                  id: 'status',
                  header: 'status',
                  cell: (i) => <span className={['badge', `badge--${statusBadgeVariant(i.status)}`].join(' ')}>{i.status}</span>,
                  sortValue: (i) => i.status,
                  width: 140,
                },
                {
                  id: 'call_number',
                  header: 'call_number',
                  cell: (i) => <span className="muted">{i.call_number}</span>,
                  sortValue: (i) => i.call_number,
                },
                {
                  id: 'location',
                  header: 'location',
                  cell: (i) => (
                    <span className="muted">
                      {i.location_code} · {i.location_name}
                    </span>
                  ),
                  sortValue: (i) => `${i.location_code} ${i.location_name}`,
                },
              ]}
            />

            <CursorPagination
              showing={items.length}
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              loading={loading}
              onLoadMore={() => void loadMore()}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
