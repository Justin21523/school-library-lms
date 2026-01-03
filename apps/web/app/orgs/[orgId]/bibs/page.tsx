/**
 * Bibs Page（/orgs/:orgId/bibs）
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/bibs?query=&subjects_any=&isbn=&classification=
 * - POST /api/v1/orgs/:orgId/bibs
 *
 * 這頁後續會提供：
 * - 基本搜尋（MVP：ILIKE + trigram index）
 * - 建立書目（title 必填，其餘選填）
 * - 進入單一書目頁（/orgs/:orgId/bibs/:bibId）以管理冊
 *
 * Auth/權限（重要）：
 * - 本頁屬於 staff 後台；建立書目（POST /bibs）受 StaffAuthGuard 保護
 * - 此處採「整頁需登入」的簡化策略，避免未登入時表單送出只得到 401
 */

// 需要搜尋/建立表單與動態載入，因此用 Client Component。
'use client';

import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { BibliographicRecord, BibliographicRecordWithCounts } from '../../../lib/api';
import { createBib, expandAuthorityTerm, getAuthorityTerm, listBibs } from '../../../lib/api';
import { TermMultiPicker, type AuthorityTermLite } from '../../../components/authority/term-multi-picker';
import { Alert } from '../../../components/ui/alert';
import { CursorPagination } from '../../../components/ui/cursor-pagination';
import { DataTable } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

export default function BibsPage({ params }: { params: { orgId: string } }) {
  // staff session：建立書目需要 Bearer token；本頁直接要求先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const searchParams = useSearchParams();

  const [bibs, setBibs] = useState<BibliographicRecordWithCounts[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{
    query?: string;
    // term_id-driven filters（任一命中；後端支援 subject_term_ids_any 的 alias）
    subject_term_ids?: string;
    geographic_term_ids?: string;
    genre_term_ids?: string;
    isbn?: string;
    classification?: string;
    limit?: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 搜尋條件：對應 API query params（query/isbn/classification）。
  const [query, setQuery] = useState('');
  const [isbn, setIsbn] = useState('');
  const [classification, setClassification] = useState('');

  // term_id-driven filters（讓 UI 能顯示 chips，且支援多選）
  // - 這裡的 value 是「使用者選的 base terms」
  // - 真正送到 /bibs 的 term_ids 可能會因為 expand 而變多（self/variants/BT/NT/RT）
  const [subjectFilterTerms, setSubjectFilterTerms] = useState<AuthorityTermLite[]>([]);
  const [geographicFilterTerms, setGeographicFilterTerms] = useState<AuthorityTermLite[]>([]);
  const [genreFilterTerms, setGenreFilterTerms] = useState<AuthorityTermLite[]>([]);

  // expand（同義/上下位/相關）：v1 先讓 subject 預設展開，651/655 先預設不展開（可手動勾）
  const [expandSubjectFilter, setExpandSubjectFilter] = useState(true);
  const [expandGeographicFilter, setExpandGeographicFilter] = useState(false);
  const [expandGenreFilter, setExpandGenreFilter] = useState(false);
  const [expandFilterDepth, setExpandFilterDepth] = useState('1');

  // 建立書目表單（MVP：title 必填，其餘選填）。
  const [title, setTitle] = useState('');
  // creators/contributors（term-based）：以 authority term id 作為真相來源（避免拼法差異）
  const [creatorTerms, setCreatorTerms] = useState<AuthorityTermLite[]>([]);
  const [contributorTerms, setContributorTerms] = useState<AuthorityTermLite[]>([]);
  // subjects（term-based）：用 authority term id 作為真相來源（避免字串同名/同義造成不一致）
  const [subjectTerms, setSubjectTerms] = useState<AuthorityTermLite[]>([]);
  const [geographicTerms, setGeographicTerms] = useState<AuthorityTermLite[]>([]);
  const [genreTerms, setGenreTerms] = useState<AuthorityTermLite[]>([]);
  const [publisher, setPublisher] = useState('');
  const [publishedYear, setPublishedYear] = useState('');
  const [language, setLanguage] = useState('');
  const [isbnNew, setIsbnNew] = useState('');
  const [classificationNew, setClassificationNew] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<BibliographicRecord | null>(null);

  // ----------------------------
  // term_id-driven filters（expand / deep link helper）
  // ----------------------------

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function uniqStrings(items: string[]) {
    return Array.from(new Set(items));
  }

  function litePlaceholderFromId(id: string): AuthorityTermLite {
    // deep link 若帶很多 term_ids（例如 expand 後），我們不一定能/應該把每個都 resolve 成 label。
    // 因此 fallback：用短 id 當 label（至少 UI 仍能顯示 chips，且能移除/重排）。
    return { id, vocabulary_code: '', preferred_label: `term:${id.slice(0, 8)}…` };
  }

  async function resolveLiteTerm(id: string): Promise<AuthorityTermLite | null> {
    try {
      const d = await getAuthorityTerm(params.orgId, id);
      return { id: d.term.id, vocabulary_code: d.term.vocabulary_code, preferred_label: d.term.preferred_label };
    } catch {
      return null;
    }
  }

  function parseUuidCsv(raw: string) {
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => uuidRe.test(s));
    return uniqStrings(ids);
  }

  async function buildTermIdsFilter(
    label: string,
    terms: AuthorityTermLite[],
    expand: boolean,
  ): Promise<string | undefined> {
    if (terms.length === 0) return undefined;

    if (!expand) return terms.map((t) => t.id).join(',');

    const depthRaw = Number.parseInt(expandFilterDepth.trim(), 10);
    const depth = Number.isFinite(depthRaw) ? Math.max(0, Math.min(5, depthRaw)) : 1;

    try {
      const expanded = await Promise.all(
        terms.map((t) =>
          expandAuthorityTerm(params.orgId, t.id, { include: 'self,variants,broader,narrower,related', depth }),
        ),
      );
      return uniqStrings(expanded.flatMap((x) => x.term_ids)).join(',');
    } catch (e) {
      setError(`${label} thesaurus expand 失敗：${formatErrorMessage(e)}`);
      return undefined;
    }
  }

  async function refresh(filters?: {
    query?: string;
    subject_term_ids?: string;
    geographic_term_ids?: string;
    genre_term_ids?: string;
    isbn?: string;
    classification?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const effective = filters ?? {};
      const result = await listBibs(params.orgId, effective);
      setBibs(result.items);
      setNextCursor(result.next_cursor);
      setAppliedFilters(effective);
    } catch (e) {
      setBibs(null);
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
      const page = await listBibs(params.orgId, { ...appliedFilters, cursor: nextCursor });
      setBibs((prev) => [...(prev ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  // URL deep link（讓你能從 Authority term / 其他頁面「點 term → 直接過濾 Bibs」）
  //
  // 設計：
  // - 只要 URL 帶 query params（例如 `?subject_term_ids=<uuid>`），就用它初始化 filters 並立即查詢
  // - 這讓 UI 可以做出「點 term chips → 跳到 /bibs 並套用過濾」的體驗
  const lastInitializedQueryStringRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionReady || !session) return;

    const queryString = searchParams.toString();
    if (lastInitializedQueryStringRef.current === queryString) return;
    lastInitializedQueryStringRef.current = queryString;

    // v1.4：支援更直覺的 query param（*_term_ids），並保留 *_term_ids_any 的相容性
    const urlQuery = (searchParams.get('query') ?? '').trim();
    const urlIsbn = (searchParams.get('isbn') ?? '').trim();
    const urlClassification = (searchParams.get('classification') ?? '').trim();

    const urlSubjectTermIds =
      (searchParams.get('subject_term_ids') ?? searchParams.get('subject_term_ids_any') ?? '').trim();
    const urlGeographicTermIds =
      (searchParams.get('geographic_term_ids') ?? searchParams.get('geographic_term_ids_any') ?? '').trim();
    const urlGenreTermIds = (searchParams.get('genre_term_ids') ?? searchParams.get('genre_term_ids_any') ?? '').trim();

    const hasAny =
      Boolean(urlQuery) ||
      Boolean(urlIsbn) ||
      Boolean(urlClassification) ||
      Boolean(urlSubjectTermIds) ||
      Boolean(urlGeographicTermIds) ||
      Boolean(urlGenreTermIds);
    if (!hasAny) {
      // 沒有 URL filters：回到預設行為（列出最新 200 筆）
      void refresh();
      return;
    }

    // 1) 先把「可顯示的欄位」同步到表單 input（讓使用者看得出目前套了哪些條件）
    setQuery(urlQuery);
    setIsbn(urlIsbn);
    setClassification(urlClassification);

    (async () => {
      try {
        // 2) term_id filters：把 URL term_ids 映射回 chips
        // - 單一 UUID：我們嘗試 resolve 成 label（讓 UI 更好讀）
        // - 多個 UUID：通常是 expand 後的結果；避免 UI 觸發「再 expand 一次」→ 先把 expand 關掉，並用 placeholder chips 顯示前 20 個
        const subjectIds = parseUuidCsv(urlSubjectTermIds);
        const geographicIds = parseUuidCsv(urlGeographicTermIds);
        const genreIds = parseUuidCsv(urlGenreTermIds);

        if (subjectIds.length === 0) {
          setSubjectFilterTerms([]);
        } else if (subjectIds.length === 1) {
          const t = (await resolveLiteTerm(subjectIds[0]!)) ?? litePlaceholderFromId(subjectIds[0]!);
          setSubjectFilterTerms([t]);
        } else {
          setExpandSubjectFilter(false);
          setSubjectFilterTerms(subjectIds.slice(0, 20).map(litePlaceholderFromId));
        }

        if (geographicIds.length === 0) {
          setGeographicFilterTerms([]);
        } else if (geographicIds.length === 1) {
          const t = (await resolveLiteTerm(geographicIds[0]!)) ?? litePlaceholderFromId(geographicIds[0]!);
          setGeographicFilterTerms([t]);
        } else {
          setExpandGeographicFilter(false);
          setGeographicFilterTerms(geographicIds.slice(0, 20).map(litePlaceholderFromId));
        }

        if (genreIds.length === 0) {
          setGenreFilterTerms([]);
        } else if (genreIds.length === 1) {
          const t = (await resolveLiteTerm(genreIds[0]!)) ?? litePlaceholderFromId(genreIds[0]!);
          setGenreFilterTerms([t]);
        } else {
          setExpandGenreFilter(false);
          setGenreFilterTerms(genreIds.slice(0, 20).map(litePlaceholderFromId));
        }
      } catch (e) {
        // deep link 解析失敗不應阻擋查詢；最差情境就是 UI 不顯示 label。
        setError(formatErrorMessage(e));
      }

      await refresh({
        query: urlQuery || undefined,
        isbn: urlIsbn || undefined,
        classification: urlClassification || undefined,
        subject_term_ids: urlSubjectTermIds || undefined,
        geographic_term_ids: urlGeographicTermIds || undefined,
        genre_term_ids: urlGenreTermIds || undefined,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session, searchParams]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();

    // term_id-driven filters（任一命中；可多選）
    // - expand=true：把 base terms 展開成 term_ids（self/variants/BT/NT/RT）→ 再用 term_id-driven 方式查詢
    // - expand=false：直接用 base term_ids 查詢（比較精準、也比較便於理解）
    const subject_term_ids = await buildTermIdsFilter('subject', subjectFilterTerms, expandSubjectFilter);
    if (subjectFilterTerms.length > 0 && expandSubjectFilter && !subject_term_ids) return;

    const geographic_term_ids = await buildTermIdsFilter('geographic', geographicFilterTerms, expandGeographicFilter);
    if (geographicFilterTerms.length > 0 && expandGeographicFilter && !geographic_term_ids) return;

    const genre_term_ids = await buildTermIdsFilter('genre', genreFilterTerms, expandGenreFilter);
    if (genreFilterTerms.length > 0 && expandGenreFilter && !genre_term_ids) return;

    await refresh({
      query: query.trim() || undefined,
      subject_term_ids,
      geographic_term_ids,
      genre_term_ids,
      isbn: isbn.trim() || undefined,
      classification: classification.trim() || undefined,
    });
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('title 不可為空');
      return;
    }

    // published_year 是 number（API 會用 zod 驗證），空字串視為未提供。
    const yearText = publishedYear.trim();
    const year = yearText ? Number.parseInt(yearText, 10) : undefined;
    if (yearText && !Number.isFinite(year)) {
      setError('published_year 必須是整數');
      return;
    }

    setCreating(true);
    setError(null);
    setCreated(null);

    try {
      const result = await createBib(params.orgId, {
        title: trimmedTitle,
        ...(creatorTerms.length > 0 ? { creator_term_ids: creatorTerms.map((t) => t.id) } : {}),
        ...(contributorTerms.length > 0 ? { contributor_term_ids: contributorTerms.map((t) => t.id) } : {}),
        ...(subjectTerms.length > 0 ? { subject_term_ids: subjectTerms.map((t) => t.id) } : {}),
        ...(geographicTerms.length > 0 ? { geographic_term_ids: geographicTerms.map((t) => t.id) } : {}),
        ...(genreTerms.length > 0 ? { genre_term_ids: genreTerms.map((t) => t.id) } : {}),
        ...(publisher.trim() ? { publisher: publisher.trim() } : {}),
        ...(year !== undefined ? { published_year: year } : {}),
        ...(language.trim() ? { language: language.trim() } : {}),
        ...(isbnNew.trim() ? { isbn: isbnNew.trim() } : {}),
        ...(classificationNew.trim() ? { classification: classificationNew.trim() } : {}),
      });

      setCreated(result);

      // 清空表單（保留一些欄位也可以；MVP 先全清）。
      setTitle('');
      setCreatorTerms([]);
      setContributorTerms([]);
      setSubjectTerms([]);
      setGeographicTerms([]);
      setGenreTerms([]);
      setPublisher('');
      setPublishedYear('');
      setLanguage('');
      setIsbnNew('');
      setClassificationNew('');

      // 建立成功後刷新列表（以空 filters 列出最新）。
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
          <h1 style={{ marginTop: 0 }}>Bibs</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Bibs</h1>
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查詢/建立書目。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="Bibs"
        description={
          <>
            對應 API：<code>GET/POST /api/v1/orgs/:orgId/bibs</code>（支援 <code>?query=</code> / <code>?isbn=</code> /{' '}
            <code>?classification=</code>）
          </>
        }
      >
        <div className="toolbar" style={{ marginTop: 12 }}>
          <div className="toolbarLeft muted">
            匯入：
            <Link href={`/orgs/${params.orgId}/bibs/import`}>Catalog CSV Import</Link> ·{' '}
            <Link href={`/orgs/${params.orgId}/bibs/import-marc`}>MARC Import</Link>
          </div>
          <div className="toolbarRight">
            <Link href={`/orgs/${params.orgId}/bibs/marc-dictionary`}>MARC 欄位字典</Link>
          </div>
        </div>

        <details className="details" open>
          <summary>
            <span>查詢</span>
            <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>
              keyword / ISBN / 分類號 · term_id-driven filters（650/651/655）
            </span>
          </summary>

          <form onSubmit={onSearch} className="detailsBody">
            <div className="grid3">
              <label>
                query（關鍵字）
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：哈利 / Rowling" />
              </label>
              <label>
                isbn（精確）
                <input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="例：9789573317248" />
              </label>
              <label>
                classification（prefix）
                <input value={classification} onChange={(e) => setClassification(e.target.value)} placeholder="例：823" />
              </label>
            </div>

            {/* term_id-driven filters（chips + 可選擇 thesaurus expand） */}
            <div className="callout">
              <div className="muted" style={{ marginBottom: 6 }}>
                term_id-driven 檢索：用 authority terms 的 <code>id</code> 當過濾條件；可選擇是否用 thesaurus 展開（同義/上下位/相關）。
              </div>

              <div className="grid4">
                <label>
                  expand subject（650）
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={expandSubjectFilter}
                      onChange={(e) => setExpandSubjectFilter(e.target.checked)}
                    />
                    <span className="muted">含 self/variants/BT/NT/RT</span>
                  </div>
                </label>
                <label>
                  expand geographic（651）
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={expandGeographicFilter}
                      onChange={(e) => setExpandGeographicFilter(e.target.checked)}
                    />
                    <span className="muted">含 self/variants/BT/NT/RT</span>
                  </div>
                </label>
                <label>
                  expand genre（655）
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={expandGenreFilter}
                      onChange={(e) => setExpandGenreFilter(e.target.checked)}
                    />
                    <span className="muted">含 self/variants/BT/NT/RT</span>
                  </div>
                </label>
                <label>
                  depth（0..5）
                  <input value={expandFilterDepth} onChange={(e) => setExpandFilterDepth(e.target.value)} />
                </label>
              </div>

              <div style={{ marginTop: 12 }}>
                <TermMultiPicker
                  orgId={params.orgId}
                  kind="subject"
                  label="subject terms（650 filter）"
                  value={subjectFilterTerms}
                  onChange={setSubjectFilterTerms}
                  defaultVocabularyCode="builtin-zh"
                  enableBrowse
                  helpText={
                    <>
                      這裡是「base terms」多選；送到 API 時會依 expand 設定轉成 <code>subject_term_ids</code>（逗號分隔）。
                    </>
                  }
                />
              </div>

              <div className="grid2" style={{ marginTop: 12 }}>
                <TermMultiPicker
                  orgId={params.orgId}
                  kind="geographic"
                  label="geographic terms（651 filter）"
                  value={geographicFilterTerms}
                  onChange={setGeographicFilterTerms}
                  defaultVocabularyCode="builtin-zh"
                  enableBrowse
                />
                <TermMultiPicker
                  orgId={params.orgId}
                  kind="genre"
                  label="genre terms（655 filter）"
                  value={genreFilterTerms}
                  onChange={setGenreFilterTerms}
                  defaultVocabularyCode="builtin-zh"
                  enableBrowse
                />
              </div>
            </div>

            <div className="toolbarLeft">
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '查詢中…' : '搜尋'}
              </button>
              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  setQuery('');
                  setIsbn('');
                  setClassification('');
                  setExpandSubjectFilter(true);
                  setExpandGeographicFilter(false);
                  setExpandGenreFilter(false);
                  setExpandFilterDepth('1');
                  setSubjectFilterTerms([]);
                  setGeographicFilterTerms([]);
                  setGenreFilterTerms([]);
                  void refresh();
                }}
                disabled={loading}
              >
                清除
              </button>
            </div>
          </form>
        </details>

        <details className="details" open={Boolean(created)}>
          <summary>
            <span>建立書目</span>
            <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>
              title 必填 · creators/subjects 走 term-based
            </span>
          </summary>

          <form onSubmit={onCreate} className="detailsBody">
          <label>
            title（必填）
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：哈利波特：神秘的魔法石" />
          </label>

          <div className="grid2">
            <TermMultiPicker
              orgId={params.orgId}
              kind="name"
              label="creators（選填；term-based）"
              value={creatorTerms}
              onChange={setCreatorTerms}
              disabled={creating}
              helpText={
                <>
                  送出只送 <code>creator_term_ids</code>；後端會回寫正規化後的 <code>creators</code>（preferred_label）。
                </>
              }
            />
            <TermMultiPicker
              orgId={params.orgId}
              kind="subject"
              label="subjects（選填；term-based）"
              value={subjectTerms}
              onChange={setSubjectTerms}
              disabled={creating}
              defaultVocabularyCode="builtin-zh"
              enableBrowse
              helpText={
                <>
                  這裡改成以 <code>authority term id</code> 作為真相來源：送出只送 <code>subject_term_ids</code>，
                  後端會依 term 回寫正規化後的 <code>subjects</code>（避免同名/同義造成不一致）。
                </>
              }
            />
            <TermMultiPicker
              orgId={params.orgId}
              kind="geographic"
              label="geographics（MARC 651；term-based）"
              value={geographicTerms}
              onChange={setGeographicTerms}
              disabled={creating}
              defaultVocabularyCode="builtin-zh"
              enableBrowse
              helpText={
                <>
                  送出只送 <code>geographic_term_ids</code>；後端會回寫正規化後的 <code>geographics</code>（preferred_label）。
                </>
              }
            />
            <TermMultiPicker
              orgId={params.orgId}
              kind="genre"
              label="genres（MARC 655；term-based）"
              value={genreTerms}
              onChange={setGenreTerms}
              disabled={creating}
              defaultVocabularyCode="builtin-zh"
              enableBrowse
              helpText={
                <>
                  送出只送 <code>genre_term_ids</code>；後端會回寫正規化後的 <code>genres</code>（preferred_label）。
                </>
              }
            />
          </div>

          <TermMultiPicker
            orgId={params.orgId}
            kind="name"
            label="contributors（選填；term-based）"
            value={contributorTerms}
            onChange={setContributorTerms}
            disabled={creating}
            helpText={
              <>
                送出只送 <code>contributor_term_ids</code>；後端會回寫正規化後的 <code>contributors</code>（preferred_label）。
              </>
            }
          />

          <div className="grid4">
            <label>
              publisher（選填）
              <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="例：皇冠" />
            </label>
            <label>
              published_year（選填；整數）
              <input value={publishedYear} onChange={(e) => setPublishedYear(e.target.value)} placeholder="例：2000" />
            </label>
            <label>
              language（選填）
              <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="例：zh-Hant" />
            </label>
            <label>
              isbn（選填）
              <input value={isbnNew} onChange={(e) => setIsbnNew(e.target.value)} placeholder="例：9789573317248" />
            </label>
          </div>

          <label>
            classification（選填）
            <input
              value={classificationNew}
              onChange={(e) => setClassificationNew(e.target.value)}
              placeholder="例：823.914"
            />
          </label>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="btnPrimary" disabled={creating}>
              {creating ? '建立中…' : '建立書目'}
            </button>
            {created ? (
              <span className="success">
                已建立：<Link href={`/orgs/${params.orgId}/bibs/${created.id}`}>{created.title}</Link>
              </span>
            ) : null}
          </div>
          </form>
        </details>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
      </PageHeader>

      {/* 列表 */}
      <section className="panel">
        <SectionHeader title="結果" />
        {loading && !bibs ? <SkeletonTable columns={5} rows={8} /> : null}

        {!loading && !bibs ? (
          <EmptyState
            title="尚無資料"
            description="目前沒有書目可顯示（可能是查詢失敗或尚未建立）。"
            actions={
              <button type="button" className="btnPrimary" onClick={() => void refresh()}>
                重試載入
              </button>
            }
          />
        ) : null}

        {!loading && bibs && bibs.length === 0 ? (
          <EmptyState title="沒有符合條件的書目" description="你可以調整搜尋/篩選條件後再試一次。" />
        ) : null}

        {bibs && bibs.length > 0 ? (
          <div className="stack">
            <DataTable
              rows={bibs}
              getRowKey={(b) => b.id}
              density="compact"
              initialSort={{ columnId: 'title', direction: 'asc' }}
              sortHint="排序僅影響目前已載入資料（cursor pagination）。"
              getRowHref={(b) => `/orgs/${params.orgId}/bibs/${b.id}`}
              columns={[
                {
                  id: 'title',
                  header: 'title',
                  cell: (b) => (
                    <Link href={`/orgs/${params.orgId}/bibs/${b.id}`}>
                      <span style={{ fontWeight: 700 }}>{b.title}</span>
                    </Link>
                  ),
                  sortValue: (b) => b.title,
                },
                {
                  id: 'isbn',
                  header: 'isbn',
                  cell: (b) => <span className="muted">{b.isbn ?? '(none)'}</span>,
                  sortValue: (b) => b.isbn ?? '',
                  width: 190,
                },
                {
                  id: 'classification',
                  header: 'classification',
                  cell: (b) => <span className="muted">{b.classification ?? '(none)'}</span>,
                  sortValue: (b) => b.classification ?? '',
                  width: 160,
                },
                {
                  id: 'items',
                  header: 'available/total',
                  cell: (b) => (
                    <span className="muted">
                      <code>{b.available_items}</code>/<code>{b.total_items}</code>
                    </span>
                  ),
                  sortValue: (b) => b.available_items,
                  align: 'right',
                  width: 140,
                },
                {
                  id: 'actions',
                  header: 'actions',
                  cell: (b) => (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Link href={`/orgs/${params.orgId}/bibs/marc-editor?bib_id=${b.id}`}>MARC21</Link>
                      <Link href={`/orgs/${params.orgId}/bibs/${b.id}#marc21`}>書目頁 MARC</Link>
                    </div>
                  ),
                  width: 220,
                },
              ]}
            />

            <CursorPagination
              showing={bibs.length}
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
