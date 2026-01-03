/**
 * OPAC：單一學校（/opac/orgs/:orgId）
 *
 * 這頁把「讀者自助」的兩個動作放在一起：
 * 1) 搜尋書目（bibs）
 * 2) 對某本書目建立預約（place hold）
 *
 * 版本演進：
 * - 早期 MVP：沒有登入，因此使用者必須自行輸入 `user_external_id`（可用但不安全）
 * - 目前：已支援 OPAC Account（Patron login）
 *   - 建立預約一律走 `/me/holds`（PatronAuthGuard；只允許本人）
 *   - 未登入時不提供「以 external_id 冒充」的過渡模式（避免預約被冒用）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { BibliographicRecordWithCounts, HoldWithDetails, Location } from '../../../lib/api';
import { listBibs, listLocations, placeMyHold } from '../../../lib/api';
import { Alert } from '../../../components/ui/alert';
import { CursorPagination } from '../../../components/ui/cursor-pagination';
import { DataTable } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';
import { SkeletonTable } from '../../../components/ui/skeleton';
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
  // 2) 取書地點（locations）
  // ----------------------------

  const [locations, setLocations] = useState<Location[] | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [pickupLocationId, setPickupLocationId] = useState('');

  const activeLocations = useMemo(() => (locations ?? []).filter(isActiveLocation), [locations]);

  // ----------------------------
  // 3) 書目搜尋（bibs）
  // ----------------------------

  type BibSearchField =
    | 'title'
    | 'author'
    | 'subject'
    | 'geographic'
    | 'genre'
    | 'publisher'
    | 'isbn'
    | 'classification'
    | 'language';

  // OPAC 預設欄位：對齊讀者的直覺（先把「找得到」做出來）
  const [searchFields, setSearchFields] = useState<BibSearchField[]>(['title', 'author', 'subject']);

  // 欄位多選：給 UI 顯示用（label 用繁中，括號保留對應的英文欄位概念）
  const searchFieldOptions: Array<{ id: BibSearchField; label: string; hint: string }> = [
    { id: 'title', label: '書名', hint: 'title' },
    { id: 'author', label: '作者/貢獻者', hint: 'creators + contributors' },
    { id: 'subject', label: '主題詞', hint: 'subjects (650)' },
    { id: 'geographic', label: '地理名稱', hint: 'geographics (651)' },
    { id: 'genre', label: '類型/體裁', hint: 'genres (655)' },
    { id: 'publisher', label: '出版者', hint: 'publisher' },
    { id: 'isbn', label: 'ISBN', hint: 'isbn' },
    { id: 'classification', label: '分類號', hint: 'classification' },
    { id: 'language', label: '語言', hint: 'language' },
  ];

  function toggleSearchField(id: BibSearchField) {
    setSearchFields((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // 基本 keyword（會送到 API 的 `query=`；支援 search_fields 限制查哪些欄位）
  const [query, setQuery] = useState('');

  // 進階布林檢索（textarea：每行一個 term；後端支援逗號/換行分隔）
  const [must, setMust] = useState('');
  const [should, setShould] = useState('');
  const [mustNot, setMustNot] = useState('');

  // metadata filters（常用欄位）
  const [isbn, setIsbn] = useState('');
  const [classification, setClassification] = useState('');
  const [language, setLanguage] = useState('');
  const [publishedYearFrom, setPublishedYearFrom] = useState('');
  const [publishedYearTo, setPublishedYearTo] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [bibs, setBibs] = useState<BibliographicRecordWithCounts[] | null>(null);
  const [loadingBibs, setLoadingBibs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{
    query?: string;
    search_fields?: string;
    must?: string;
    should?: string;
    must_not?: string;
    isbn?: string;
    classification?: string;
    language?: string;
    published_year_from?: number;
    published_year_to?: number;
    available_only?: boolean;
    limit?: number;
  } | null>(null);

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
      // 1) search_fields：至少勾選一個欄位（否則使用者會以為壞掉）
      if (searchFields.length === 0) {
        throw new Error('請至少勾選一個搜尋欄位（title/author/subject…）');
      }

      // 2) published_year range：前端先做基本防呆（後端也會再驗證）
      const fromRaw = publishedYearFrom.trim();
      const toRaw = publishedYearTo.trim();

      const fromNumber = fromRaw ? Number.parseInt(fromRaw, 10) : undefined;
      const toNumber = toRaw ? Number.parseInt(toRaw, 10) : undefined;

      if (fromRaw && !Number.isFinite(fromNumber)) throw new Error('published_year_from 必須是整數');
      if (toRaw && !Number.isFinite(toNumber)) throw new Error('published_year_to 必須是整數');
      if (fromNumber !== undefined && toNumber !== undefined && fromNumber > toNumber) {
        throw new Error('published_year_from 必須小於等於 published_year_to');
      }

      // OPAC：預設用較小 limit，避免讀者端一次拉太多造成卡頓；可用「載入更多」續查。
      const defaultLimit = 50;

      const filters = {
        query: query.trim() || undefined,
        search_fields: searchFields.join(','),
        must: must.trim() || undefined,
        should: should.trim() || undefined,
        must_not: mustNot.trim() || undefined,
        isbn: isbn.trim() || undefined,
        classification: classification.trim() || undefined,
        language: language.trim() || undefined,
        published_year_from: fromNumber,
        published_year_to: toNumber,
        available_only: availableOnly ? true : undefined,
        limit: defaultLimit,
      };
      const result = await listBibs(params.orgId, filters);
      setBibs(result.items);
      setNextCursor(result.next_cursor);
      setAppliedFilters(filters);
    } catch (e) {
      setBibs(null);
      setNextCursor(null);
      setAppliedFilters(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingBibs(false);
    }
  }

  async function loadMoreBibs() {
    if (!nextCursor || !appliedFilters) return;

    setLoadingMore(true);
    setError(null);
    setSuccess(null);

    try {
      const page = await listBibs(params.orgId, { ...appliedFilters, cursor: nextCursor });
      setBibs((prev) => [...(prev ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  async function onPlaceHold(bibId: string) {
    setError(null);
    setSuccess(null);
    setLastCreatedHold(null);

    const trimmedPickupLocationId = pickupLocationId.trim();

    // 安全性：建立預約屬於「可改資料」行為，必須先登入（PatronAuthGuard）。
    if (!session) {
      setError('請先登入 OPAC Account 才能建立預約。');
      return;
    }

    if (!trimmedPickupLocationId) {
      setError('請先選擇取書地點（pickup_location_id）');
      return;
    }

    setCreatingBibId(bibId);
    try {
      // 已登入：走 /me（PatronAuthGuard），不需要也不允許前端傳 user_external_id
      const result = await placeMyHold(params.orgId, {
        bibliographic_id: bibId,
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
      <PageHeader
        title="OPAC：搜尋與預約"
        description="搜尋書目並建立預約（hold）；登入後會自動使用安全的 /me/* 端點。"
        actions={
          <>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/holds`}>
              我的預約
            </Link>
            <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/loans`}>
              我的借閱
            </Link>
            {sessionReady ? (
              session ? (
                <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/logout`}>
                  登出
                </Link>
              ) : (
                <Link className="btnSmall btnPrimary" href={`/opac/orgs/${params.orgId}/login`}>
                  登入
                </Link>
              )
            ) : null}
          </>
        }
      >
        {!sessionReady ? <Alert variant="info" title="載入登入狀態中…" role="status" /> : null}

        {sessionReady && session ? (
          <Alert variant="success" title="已登入" role="status">
            {session.user.name}（{session.user.role}）· <code>{session.user.external_id}</code>
          </Alert>
        ) : null}

        {sessionReady && !session ? (
          <Alert
            variant="warning"
            title="尚未登入"
            role="status"
          >
            建立/取消預約與查看「我的借閱/我的預約」需要先登入 OPAC Account（Patron login）。
          </Alert>
        ) : null}

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
        {lastCreatedHold ? (
          <div className="muted">
            最新預約：{lastCreatedHold.bibliographic_title} · status=<code>{lastCreatedHold.status}</code>
            {lastCreatedHold.ready_until ? (
              <>
                {' '}
                · ready_until=<code>{lastCreatedHold.ready_until}</code>
              </>
            ) : null}
          </div>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="預約設定" description="選擇取書地點；建立預約需要先登入。" />

        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="使用者與取書地點" description="（提示）登入後會由 token 推導本人身分。">
            <div className="grid2">
              <div className="callout">
                <div className="muted">登入狀態</div>
                <div style={{ fontFamily: 'var(--font-mono)' }}>
                  {session ? `${session.user.name} · ${session.user.external_id}` : '尚未登入'}
                </div>
              </div>

              <Field label="取書地點（pickup location）" htmlFor="opac_pickup_location">
                <select
                  id="opac_pickup_location"
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
              </Field>
            </div>

            {loadingLocations ? <Alert variant="info" title="載入 locations 中…" role="status" /> : null}

            <div className="toolbar" style={{ marginTop: 8 }}>
              <div className="toolbarLeft">
                <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/holds`}>
                  查看我的預約
                </Link>
                <Link className="btnSmall" href={`/opac/orgs/${params.orgId}/loans`}>
                  查看我的借閱
                </Link>
              </div>
            </div>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="搜尋書目" description="支援欄位多選與 AND/OR/NOT；搜尋後可直接建立預約。" />

        <Form onSubmit={onSearch}>
          <FormSection
            title="查詢"
            description={
              <>
                你可以只用「關鍵字」快速找書，也可以展開進階選項做欄位型檢索與布林條件（must / should / must_not）。
              </>
            }
          >
            <div className="grid2">
              <Field label="query（關鍵字）" htmlFor="opac_bib_query" hint="例：哈利波特 / Rowling / 媒體識讀">
                <input
                  id="opac_bib_query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="輸入關鍵字…"
                />
              </Field>

              <Field
                label="搜尋欄位（search_fields）"
                hint="至少勾選一個；未勾選會提示錯誤。"
              >
                <div className="callout" style={{ padding: 12 }}>
                  <div className="grid3">
                    {searchFieldOptions.map((opt) => (
                      <label key={opt.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={searchFields.includes(opt.id)}
                          onChange={() => toggleSearchField(opt.id)}
                        />
                        <span style={{ fontWeight: 700 }}>{opt.label}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {opt.hint}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </Field>
            </div>

            <details className="details" open style={{ marginTop: 12 }}>
              <summary>
                <span>進階搜尋（AND/OR/NOT + metadata）</span>
                <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>
                  must / should / must_not · ISBN / 分類號 · 出版年 · 語言 · 只顯示可借
                </span>
              </summary>
              <div className="detailsBody">
                <div className="grid3">
                  <Field
                    label="must（AND：每行一個 term）"
                    htmlFor="opac_bib_must"
                    hint="每個 term 都必須命中任一勾選欄位。"
                  >
                    <textarea
                      id="opac_bib_must"
                      value={must}
                      onChange={(e) => setMust(e.target.value)}
                      rows={3}
                      placeholder={'例：\\n哈利波特\\n羅琳'}
                    />
                  </Field>
                  <Field
                    label="should（OR：每行一個 term）"
                    htmlFor="opac_bib_should"
                    hint="至少一個 term 命中即可（常用於同義詞）。"
                  >
                    <textarea
                      id="opac_bib_should"
                      value={should}
                      onChange={(e) => setShould(e.target.value)}
                      rows={3}
                      placeholder={'例：\\nAI\\n人工智慧'}
                    />
                  </Field>
                  <Field
                    label="must_not（NOT：每行一個 term）"
                    htmlFor="opac_bib_must_not"
                    hint="任何 term 命中即排除（例如不想看到某類型）。"
                  >
                    <textarea
                      id="opac_bib_must_not"
                      value={mustNot}
                      onChange={(e) => setMustNot(e.target.value)}
                      rows={3}
                      placeholder={'例：\\n恐怖\\n血腥'}
                    />
                  </Field>
                </div>

                <div className="grid3">
                  <Field label="ISBN（精確）" htmlFor="opac_bib_isbn" hint="例：9789573317248">
                    <input id="opac_bib_isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
                  </Field>
                  <Field label="classification（prefix）" htmlFor="opac_bib_classification" hint="例：823">
                    <input
                      id="opac_bib_classification"
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                    />
                  </Field>
                  <Field label="language（prefix）" htmlFor="opac_bib_language" hint="例：zh / en">
                    <input
                      id="opac_bib_language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid3">
                  <Field label="published_year_from" htmlFor="opac_bib_year_from">
                    <input
                      id="opac_bib_year_from"
                      value={publishedYearFrom}
                      onChange={(e) => setPublishedYearFrom(e.target.value)}
                      placeholder="例：2000"
                    />
                  </Field>
                  <Field label="published_year_to" htmlFor="opac_bib_year_to">
                    <input
                      id="opac_bib_year_to"
                      value={publishedYearTo}
                      onChange={(e) => setPublishedYearTo(e.target.value)}
                      placeholder="例：2024"
                    />
                  </Field>
                  <Field
                    label="available_only（只顯示可借）"
                    htmlFor="opac_bib_available_only"
                    hint="至少 1 冊 status=available"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        id="opac_bib_available_only"
                        type="checkbox"
                        checked={availableOnly}
                        onChange={(e) => setAvailableOnly(e.target.checked)}
                      />
                      <span className="muted">只顯示現在借得到的書</span>
                    </div>
                  </Field>
                </div>
              </div>
            </details>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loadingBibs}>
                {loadingBibs ? '搜尋中…' : '搜尋'}
              </button>
              <button
                type="button"
                className="btnSmall"
                disabled={loadingBibs}
                onClick={() => {
                  setSearchFields(['title', 'author', 'subject']);
                  setQuery('');
                  setMust('');
                  setShould('');
                  setMustNot('');
                  setIsbn('');
                  setClassification('');
                  setLanguage('');
                  setPublishedYearFrom('');
                  setPublishedYearTo('');
                  setAvailableOnly(false);
                }}
              >
                清除
              </button>
            </FormActions>
          </FormSection>
        </Form>

        {loadingBibs ? <SkeletonTable columns={3} rows={6} /> : null}

        {!loadingBibs && bibs && bibs.length === 0 ? <EmptyState title="沒有符合條件的書目" description="你可以換關鍵字再試一次。" /> : null}

        {!loadingBibs && bibs && bibs.length > 0 ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <DataTable
              rows={bibs}
              getRowKey={(b) => b.id}
              density="compact"
              initialSort={{ columnId: 'title', direction: 'asc' }}
              columns={[
                {
                  id: 'title',
                  header: 'title',
                  sortValue: (b) => b.title,
                  cell: (b) => (
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontWeight: 900 }}>{b.title}</span>
                      {b.creators?.length || b.contributors?.length ? (
                        <span className="muted">
                          作者：{[...(b.creators ?? []), ...(b.contributors ?? [])].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                      <span className="muted">
                        {b.publisher ? <>出版：{b.publisher}</> : null}
                        {b.published_year ? (
                          <>
                            {b.publisher ? ' · ' : null}
                            {b.published_year}
                          </>
                        ) : null}
                        {b.language ? (
                          <>
                            {(b.publisher || b.published_year) ? ' · ' : null}
                            {b.language}
                          </>
                        ) : null}
                      </span>
                      <span className="muted" style={{ fontFamily: 'var(--font-mono)' }}>
                        {b.isbn ? (
                          <>
                            ISBN <code>{b.isbn}</code>
                          </>
                        ) : (
                          'ISBN（無）'
                        )}
                        {b.classification ? (
                          <>
                            {' '}
                            · class <code>{b.classification}</code>
                          </>
                        ) : null}
                      </span>
                    </div>
                  ),
                },
                {
                  id: 'availability',
                  header: 'available/total',
                  sortValue: (b) => b.available_items,
                  align: 'right',
                  width: 150,
                  cell: (b) => (
                    <span className="muted">
                      <code>{b.available_items}</code>/<code>{b.total_items}</code>
                    </span>
                  ),
                },
              ]}
              rowActionsHeader="hold"
              rowActionsWidth={140}
              rowActions={(b) => (
                <button
                  type="button"
                  className="btnSmall btnPrimary"
                  onClick={() => void onPlaceHold(b.id)}
                  disabled={creatingBibId === b.id}
                >
                  {creatingBibId === b.id ? '預約中…' : '預約'}
                </button>
              )}
            />

            <CursorPagination
              showing={bibs.length}
              nextCursor={nextCursor}
              loading={loadingBibs}
              loadingMore={loadingMore}
              onLoadMore={() => void loadMoreBibs()}
              meta={
                <>
                  showing <code>{bibs.length}</code> · next_cursor={nextCursor ? '有' : '無'}
                  {appliedFilters?.query ? (
                    <>
                      {' '}
                      · query=<code>{appliedFilters.query}</code>
                    </>
                  ) : null}
                  {appliedFilters?.search_fields ? (
                    <>
                      {' '}
                      · fields=<code>{appliedFilters.search_fields}</code>
                    </>
                  ) : null}
                  {appliedFilters?.must ? (
                    <>
                      {' '}
                      · must=<code>{appliedFilters.must}</code>
                    </>
                  ) : null}
                  {appliedFilters?.should ? (
                    <>
                      {' '}
                      · should=<code>{appliedFilters.should}</code>
                    </>
                  ) : null}
                  {appliedFilters?.must_not ? (
                    <>
                      {' '}
                      · must_not=<code>{appliedFilters.must_not}</code>
                    </>
                  ) : null}
                  {appliedFilters?.available_only ? (
                    <>
                      {' '}
                      · available_only=<code>true</code>
                    </>
                  ) : null}
                </>
              }
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
