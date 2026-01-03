/**
 * Bib Detail Page（/orgs/:orgId/bibs/:bibId）
 *
 * 對應 API：
 * - GET   /api/v1/orgs/:orgId/bibs/:bibId
 * - PATCH /api/v1/orgs/:orgId/bibs/:bibId
 * - POST  /api/v1/orgs/:orgId/bibs/:bibId/items
 * - GET   /api/v1/orgs/:orgId/items?bibliographic_id=:bibId
 *
 * 這頁後續會提供：
 * - 檢視/更新書目（例如改書名、補 ISBN）
 * - 列出該書目的冊（items）
 * - 在書目底下新增冊（以條碼/索書號/位置）
 *
 * Auth/權限（重要）：
 * - 本頁會讀取 items（/items?bibliographic_id=...），而 items 端點受 StaffAuthGuard 保護
 * - 因此需要先 staff login（Bearer token）才能正常使用
 */

// 需要抓資料 + 編輯表單 + 新增冊，因此用 Client Component。
'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type {
  BibliographicRecordWithCounts,
  ItemCopy,
  ItemStatus,
  Location,
  MarcField,
} from '../../../../lib/api';
import { TermMultiPicker, type AuthorityTermLite } from '../../../../components/authority/term-multi-picker';
import { MarcFieldsEditor } from '../../../../components/marc/marc-fields-editor';
import { Alert } from '../../../../components/ui/alert';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import {
  createItem,
  getBib,
  getBibMarc,
  getBibMarcExtras,
  getBibMarcMrc,
  getBibMarcXml,
  listItems,
  listLocations,
  updateBibMarcExtras,
  updateBib,
} from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

function isActiveLocation(location: Location) {
  return location.status === 'active';
}

function downloadText(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBytes(filename: string, bytes: ArrayBuffer, contentType: string) {
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BibDetailPage({ params }: { params: { orgId: string; bibId: string } }) {
  // staff session：本頁需要讀取 items（受 guard 保護），因此需先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  // 主要資料：書目 + 該書目的冊 + location 清單（用於新增冊的下拉選單）。
  const [bib, setBib] = useState<BibliographicRecordWithCounts | null>(null);
  const [items, setItems] = useState<ItemCopy[] | null>(null);
  const [itemsNextCursor, setItemsNextCursor] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[] | null>(null);

  // UI 狀態：loading/error/success。
  const [loading, setLoading] = useState(false);
  const [loadingMoreItems, setLoadingMoreItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ------ 書目更新表單（以「勾選欄位」的方式建立 PATCH payload）------
  const [updateTitle, setUpdateTitle] = useState(false);
  const [title, setTitle] = useState('');

  const [updateCreators, setUpdateCreators] = useState(false);
  const [creatorTerms, setCreatorTerms] = useState<AuthorityTermLite[]>([]);

  const [updateContributors, setUpdateContributors] = useState(false);
  const [contributorTerms, setContributorTerms] = useState<AuthorityTermLite[]>([]);

  const [updateSubjects, setUpdateSubjects] = useState(false);
  // subjects（term-based）：以 authority term id 作為真相來源（避免字串同名/同義/拼法差異）
  const [subjectTerms, setSubjectTerms] = useState<AuthorityTermLite[]>([]);

  const [updateGeographics, setUpdateGeographics] = useState(false);
  // geographics（term-based）：MARC 651（地理名稱）
  const [geographicTerms, setGeographicTerms] = useState<AuthorityTermLite[]>([]);

  const [updateGenres, setUpdateGenres] = useState(false);
  // genres（term-based）：MARC 655（類型/體裁）
  const [genreTerms, setGenreTerms] = useState<AuthorityTermLite[]>([]);

  const [updatePublisher, setUpdatePublisher] = useState(false);
  const [publisher, setPublisher] = useState('');

  const [updatePublishedYear, setUpdatePublishedYear] = useState(false);
  const [publishedYear, setPublishedYear] = useState('');

  const [updateLanguage, setUpdateLanguage] = useState(false);
  const [language, setLanguage] = useState('');

  const [updateIsbn, setUpdateIsbn] = useState(false);
  const [isbn, setIsbn] = useState('');

  const [updateClassification, setUpdateClassification] = useState(false);
  const [classification, setClassification] = useState('');

  const [updating, setUpdating] = useState(false);

  // ------ MARC 21（匯出/保留欄位）------
  const [marcJsonText, setMarcJsonText] = useState<string>('');
  const [marcExtras, setMarcExtras] = useState<MarcField[] | null>(null);
  const [loadingMarc, setLoadingMarc] = useState(false);
  const [loadingMarcExtras, setLoadingMarcExtras] = useState(false);
  const [savingMarcExtras, setSavingMarcExtras] = useState(false);

  // ------ 新增冊（items）表單 ------
  const [barcode, setBarcode] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState<ItemStatus>('available');
  const [notes, setNotes] = useState('');
  const [creatingItem, setCreatingItem] = useState(false);

  // 新增冊：location 必須是 active（後端也會擋）；UI 只顯示 active，避免使用者選到停用館別。
  const activeLocationOptions = useMemo(
    () => (locations ?? []).filter(isActiveLocation),
    [locations],
  );

  async function refreshAll() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 以 Promise.all 平行抓資料，加快頁面反應。
      const [bibResult, itemsResult, locationsResult] = await Promise.all([
        getBib(params.orgId, params.bibId),
        listItems(params.orgId, { bibliographic_id: params.bibId }),
        listLocations(params.orgId),
      ]);

      setBib(bibResult);
      setItems(itemsResult.items);
      setItemsNextCursor(itemsResult.next_cursor);
      setLocations(locationsResult);

      // UX：若尚未選 location，就預設第一個 active location（讓「新增冊」少一步）
      if (!locationId) {
        const first = locationsResult.find(isActiveLocation);
        if (first) setLocationId(first.id);
      }
    } catch (e) {
      setBib(null);
      setItems(null);
      setItemsNextCursor(null);
      setLocations(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreItems() {
    if (!itemsNextCursor) return;

    setLoadingMoreItems(true);
    setError(null);
    setSuccess(null);

    try {
      const page = await listItems(params.orgId, {
        bibliographic_id: params.bibId,
        cursor: itemsNextCursor,
      });

      setItems((prev) => [...(prev ?? []), ...page.items]);
      setItemsNextCursor(page.next_cursor);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMoreItems(false);
    }
  }

  // 初次載入與路由參數改變時，重新抓資料。
  useEffect(() => {
    if (!sessionReady || !session) return;
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, params.bibId, sessionReady, session]);

  async function onGenerateMarcJson() {
    setLoadingMarc(true);
    setError(null);
    setSuccess(null);
    try {
      const record = await getBibMarc(params.orgId, params.bibId);
      setMarcJsonText(JSON.stringify(record, null, 2));
      setSuccess('已產生 MARC(JSON)');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMarc(false);
    }
  }

  async function onDownloadMarcJson() {
    setError(null);
    setSuccess(null);

    try {
      // 若尚未產生過，就先抓一次（避免下載空檔）
      let text = marcJsonText;
      if (!text.trim()) {
        const record = await getBibMarc(params.orgId, params.bibId);
        text = JSON.stringify(record, null, 2);
        setMarcJsonText(text);
      }

      downloadText(`bib-${params.bibId}.marc.json`, text, 'application/json;charset=utf-8');
      setSuccess('已下載 MARC(JSON)');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  }

  async function onDownloadMarcXml() {
    setError(null);
    setSuccess(null);

    try {
      const xml = await getBibMarcXml(params.orgId, params.bibId);
      downloadText(`bib-${params.bibId}.xml`, xml, 'application/marcxml+xml;charset=utf-8');
      setSuccess('已下載 MARCXML');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  }

  async function onDownloadMarcMrc() {
    setError(null);
    setSuccess(null);

    try {
      const bytes = await getBibMarcMrc(params.orgId, params.bibId);
      downloadBytes(`bib-${params.bibId}.mrc`, bytes, 'application/octet-stream');
      setSuccess('已下載 ISO2709 (.mrc)');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  }

  async function onLoadMarcExtras() {
    setLoadingMarcExtras(true);
    setError(null);
    setSuccess(null);

    try {
      const extras = await getBibMarcExtras(params.orgId, params.bibId);
      setMarcExtras(extras);
      setSuccess('已載入 marc_extras');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMarcExtras(false);
    }
  }

  async function onSaveMarcExtras() {
    setSavingMarcExtras(true);
    setError(null);
    setSuccess(null);

    try {
      if (!marcExtras) throw new Error('尚未載入 marc_extras（請先按「載入 marc_extras」）');
      const saved = await updateBibMarcExtras(params.orgId, params.bibId, marcExtras);
      setMarcExtras(saved);
      setSuccess('已儲存 marc_extras');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSavingMarcExtras(false);
    }
  }

  // 當 bib 載入後，把現值填進表單（讓使用者能「從現況出發」編輯）。
  useEffect(() => {
    if (!bib) return;

    // 這裡只同步「欄位的目前值」，不自動勾選 update，避免誤送 PATCH。
    setTitle(bib.title);
    setCreatorTerms(
      (bib.creator_terms ?? []).map((t) => ({
        id: t.id,
        vocabulary_code: t.vocabulary_code,
        preferred_label: t.preferred_label,
      })),
    );
    setContributorTerms(
      (bib.contributor_terms ?? []).map((t) => ({
        id: t.id,
        vocabulary_code: t.vocabulary_code,
        preferred_label: t.preferred_label,
      })),
    );
    setSubjectTerms(
      (bib.subject_terms ?? []).map((t) => ({
        id: t.id,
        vocabulary_code: t.vocabulary_code,
        preferred_label: t.preferred_label,
      })),
    );
    setGeographicTerms(
      (bib.geographic_terms ?? []).map((t) => ({
        id: t.id,
        vocabulary_code: t.vocabulary_code,
        preferred_label: t.preferred_label,
      })),
    );
    setGenreTerms(
      (bib.genre_terms ?? []).map((t) => ({
        id: t.id,
        vocabulary_code: t.vocabulary_code,
        preferred_label: t.preferred_label,
      })),
    );
    setPublisher(bib.publisher ?? '');
    setPublishedYear(bib.published_year?.toString() ?? '');
    setLanguage(bib.language ?? '');
    setIsbn(bib.isbn ?? '');
    setClassification(bib.classification ?? '');
  }, [bib]);

  async function onUpdateBib(e: React.FormEvent) {
    e.preventDefault();

    // PATCH payload：只放使用者有勾選的欄位（對齊 API 的「部分更新」設計）。
    const payload: {
      title?: string;
      creator_term_ids?: string[] | null;
      contributor_term_ids?: string[] | null;
      subject_term_ids?: string[] | null;
      geographic_term_ids?: string[] | null;
      genre_term_ids?: string[] | null;
      publisher?: string | null;
      published_year?: number | null;
      language?: string | null;
      isbn?: string | null;
      classification?: string | null;
    } = {};

    // title：不可清空；勾選就必須提供非空字串。
    if (updateTitle) {
      const trimmed = title.trim();
      if (!trimmed) {
        setError('title 不可為空（若不想改 title，請取消勾選）');
        return;
      }
      payload.title = trimmed;
    }

    // creators/subjects：允許用 null 清空（對齊 API update schema）。
    if (updateCreators) {
      payload.creator_term_ids = creatorTerms.length > 0 ? creatorTerms.map((t) => t.id) : null;
    }
    if (updateContributors) {
      payload.contributor_term_ids = contributorTerms.length > 0 ? contributorTerms.map((t) => t.id) : null;
    }
    if (updateSubjects) {
      // term-based：UI 的真相來源是 subjectTerms（chips）
      payload.subject_term_ids = subjectTerms.length > 0 ? subjectTerms.map((t) => t.id) : null;
    }
    if (updateGeographics) {
      payload.geographic_term_ids = geographicTerms.length > 0 ? geographicTerms.map((t) => t.id) : null;
    }
    if (updateGenres) {
      payload.genre_term_ids = genreTerms.length > 0 ? genreTerms.map((t) => t.id) : null;
    }

    // 可選字串欄位：空字串視為「清空」（送 null）；非空則送 trimmed string。
    if (updatePublisher) payload.publisher = publisher.trim() ? publisher.trim() : null;
    if (updateLanguage) payload.language = language.trim() ? language.trim() : null;
    if (updateIsbn) payload.isbn = isbn.trim() ? isbn.trim() : null;
    if (updateClassification)
      payload.classification = classification.trim() ? classification.trim() : null;

    // published_year：空字串 => null；非空 => int。
    if (updatePublishedYear) {
      const text = publishedYear.trim();
      if (!text) {
        payload.published_year = null;
      } else {
        const year = Number.parseInt(text, 10);
        if (!Number.isFinite(year)) {
          setError('published_year 必須是整數（或留空代表清空）');
          return;
        }
        payload.published_year = year;
      }
    }

    // 沒有任何欄位被勾選，就不送 request（避免 API 回 400）。
    if (Object.keys(payload).length === 0) {
      setError('請至少勾選一個要更新的欄位');
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      await updateBib(params.orgId, params.bibId, payload);
      setSuccess('已更新書目');

      // 更新後重新抓資料，確保畫面與 DB 一致（含可借冊數）。
      await refreshAll();

      // 更新成功後可以選擇保留勾選；MVP 先全部取消，避免下一次誤送。
      setUpdateTitle(false);
      setUpdateCreators(false);
      setUpdateContributors(false);
      setUpdateSubjects(false);
      setUpdateGeographics(false);
      setUpdateGenres(false);
      setUpdatePublisher(false);
      setUpdatePublishedYear(false);
      setUpdateLanguage(false);
      setUpdateIsbn(false);
      setUpdateClassification(false);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setUpdating(false);
    }
  }

  async function onCreateItem(e: React.FormEvent) {
    e.preventDefault();

    const trimmedBarcode = barcode.trim();
    const trimmedCallNumber = callNumber.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedBarcode) {
      setError('barcode 不可為空');
      return;
    }
    if (!trimmedCallNumber) {
      setError('call_number 不可為空');
      return;
    }
    if (!locationId) {
      setError('請選擇 location');
      return;
    }

    setCreatingItem(true);
    setError(null);
    setSuccess(null);

    try {
      await createItem(params.orgId, params.bibId, {
        barcode: trimmedBarcode,
        call_number: trimmedCallNumber,
        location_id: locationId,
        status,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      });

      setSuccess('已新增冊');
      setBarcode('');
      setCallNumber('');
      setNotes('');

      // 新增冊後刷新：items 列表 + bib counts 都會更新。
      await refreshAll();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreatingItem(false);
    }
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Bib Detail" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="Bib Detail">
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能查看/管理書目與冊。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="Bib Detail"
        description={
          <>
            對應 API：<code>GET/PATCH /api/v1/orgs/:orgId/bibs/:bibId</code>，以及該書目底下的冊：<code>GET /api/v1/orgs/:orgId/items?bibliographic_id=</code>
          </>
        }
      >

        <div className="muted" style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <div>
            orgId：<code>{params.orgId}</code>
          </div>
          <div>
            bibId：<code>{params.bibId}</code>
          </div>
        </div>

        {loading ? <p className="muted">載入中…</p> : null}
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

        {bib ? (
          <div className="stack" style={{ marginTop: 16 }}>
            <div>
              <div className="muted">title</div>
              <div style={{ fontWeight: 700 }}>{bib.title}</div>
            </div>
            <div className="muted">
              isbn={bib.isbn ?? '(none)'} · classification={bib.classification ?? '(none)'} · available_items=
              {bib.available_items}/{bib.total_items}
            </div>
          </div>
        ) : null}
      </PageHeader>

      {/* 更新書目（PATCH） */}
      <section className="panel">
        <SectionHeader title="更新書目（PATCH）" description="這裡用「勾選欄位」來組 PATCH payload：沒勾選的欄位不會送出（避免誤改）。" />

        <form onSubmit={onUpdateBib} className="stack" style={{ marginTop: 12 }}>
          <label>
            <input type="checkbox" checked={updateTitle} onChange={(e) => setUpdateTitle(e.target.checked)} /> 更新 title
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!updateTitle} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateCreators}
              onChange={(e) => setUpdateCreators(e.target.checked)}
            />{' '}
            更新 creators（term-based；清空代表清空）
          </label>

          {bib && (bib.creators?.length ?? 0) > 0 && (bib.creator_terms?.length ?? 0) === 0 ? (
            <div className="callout warn">
              <div className="muted">
                這筆書目的 <code>creators</code> 目前只有文字（尚未 backfill 成 <code>creator_term_ids</code>）：
                term-based UI 會顯示為空。你可以在此重新選擇 creators，或先跑{' '}
                <Link href={`/orgs/${params.orgId}/bibs/maintenance/backfill-name-terms`}>Bibs Name Backfill</Link>。
              </div>
            </div>
          ) : null}

          <TermMultiPicker
            orgId={params.orgId}
            kind="name"
            label="creators（term-based）"
            value={creatorTerms}
            onChange={setCreatorTerms}
            disabled={!updateCreators || updating}
            helpText={
              <>
                送出只送 <code>creator_term_ids</code>；後端會回寫正規化後的 <code>creators</code>（preferred_label）。
              </>
            }
          />

          <label>
            <input
              type="checkbox"
              checked={updateContributors}
              onChange={(e) => setUpdateContributors(e.target.checked)}
            />{' '}
            更新 contributors（term-based；清空代表清空）
          </label>

          {bib && (bib.contributors?.length ?? 0) > 0 && (bib.contributor_terms?.length ?? 0) === 0 ? (
            <div className="callout warn">
              <div className="muted">
                這筆書目的 <code>contributors</code> 目前只有文字（尚未 backfill 成 <code>contributor_term_ids</code>）：
                term-based UI 會顯示為空。你可以在此重新選擇 contributors，或先跑{' '}
                <Link href={`/orgs/${params.orgId}/bibs/maintenance/backfill-name-terms`}>Bibs Name Backfill</Link>。
              </div>
            </div>
          ) : null}

          <TermMultiPicker
            orgId={params.orgId}
            kind="name"
            label="contributors（term-based）"
            value={contributorTerms}
            onChange={setContributorTerms}
            disabled={!updateContributors || updating}
            helpText={
              <>
                送出只送 <code>contributor_term_ids</code>；後端會回寫正規化後的 <code>contributors</code>（preferred_label）。
              </>
            }
          />

          <label>
            <input
              type="checkbox"
              checked={updateSubjects}
              onChange={(e) => setUpdateSubjects(e.target.checked)}
            />{' '}
            更新 subjects（term-based；清空代表清空）
          </label>

          {bib && (bib.subjects?.length ?? 0) > 0 && (bib.subject_terms?.length ?? 0) === 0 ? (
            <div className="callout warn">
              <div className="muted">
                這筆書目的 <code>subjects</code> 目前只有文字（尚未 backfill 成 <code>subject_term_ids</code>）：
                term-based UI 會顯示為空。建議先跑「Subject Backfill」或在此重新選擇主題詞。
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                注意：為了避免同名/同義造成不一致，本頁更新主題詞只會送 <code>subject_term_ids</code>，不再送 <code>subjects</code> 字串。
              </div>
            </div>
          ) : null}

          <TermMultiPicker
            orgId={params.orgId}
            kind="subject"
            label="subjects（term-based）"
            value={subjectTerms}
            onChange={setSubjectTerms}
            disabled={!updateSubjects || updating}
            defaultVocabularyCode="builtin-zh"
            enableBrowse
            helpText={
              <>
                送出只送 <code>subject_term_ids</code>；後端會依 term 回寫正規化後的 <code>subjects</code>（preferred_label）。
              </>
            }
          />

          <label>
            <input
              type="checkbox"
              checked={updateGeographics}
              onChange={(e) => setUpdateGeographics(e.target.checked)}
            />{' '}
            更新 geographics（MARC 651；term-based；清空代表清空）
          </label>

          {bib && (bib.geographics?.length ?? 0) > 0 && (bib.geographic_terms?.length ?? 0) === 0 ? (
            <div className="callout warn">
              <div className="muted">
                這筆書目的 <code>geographics</code> 目前只有文字（尚未 backfill 成 <code>geographic_term_ids</code>）：
                term-based UI 會顯示為空。你可以在此重新選擇地理名稱，或先跑 backfill 工具把既有資料轉成 term-based。
              </div>
            </div>
          ) : null}

          <TermMultiPicker
            orgId={params.orgId}
            kind="geographic"
            label="geographics（term-based）"
            value={geographicTerms}
            onChange={setGeographicTerms}
            disabled={!updateGeographics || updating}
            defaultVocabularyCode="builtin-zh"
            enableBrowse
            helpText={
              <>
                送出只送 <code>geographic_term_ids</code>；後端會回寫正規化後的 <code>geographics</code>（preferred_label）。
              </>
            }
          />

          <label>
            <input
              type="checkbox"
              checked={updateGenres}
              onChange={(e) => setUpdateGenres(e.target.checked)}
            />{' '}
            更新 genres（MARC 655；term-based；清空代表清空）
          </label>

          {bib && (bib.genres?.length ?? 0) > 0 && (bib.genre_terms?.length ?? 0) === 0 ? (
            <div className="callout warn">
              <div className="muted">
                這筆書目的 <code>genres</code> 目前只有文字（尚未 backfill 成 <code>genre_term_ids</code>）：
                term-based UI 會顯示為空。你可以在此重新選擇類型/體裁，或先跑 backfill 工具把既有資料轉成 term-based。
              </div>
            </div>
          ) : null}

          <TermMultiPicker
            orgId={params.orgId}
            kind="genre"
            label="genres（term-based）"
            value={genreTerms}
            onChange={setGenreTerms}
            disabled={!updateGenres || updating}
            defaultVocabularyCode="builtin-zh"
            enableBrowse
            helpText={
              <>
                送出只送 <code>genre_term_ids</code>；後端會回寫正規化後的 <code>genres</code>（preferred_label）。
              </>
            }
          />

          <label>
            <input
              type="checkbox"
              checked={updatePublisher}
              onChange={(e) => setUpdatePublisher(e.target.checked)}
            />{' '}
            更新 publisher（留空代表清空）
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} disabled={!updatePublisher} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updatePublishedYear}
              onChange={(e) => setUpdatePublishedYear(e.target.checked)}
            />{' '}
            更新 published_year（留空代表清空）
            <input
              value={publishedYear}
              onChange={(e) => setPublishedYear(e.target.value)}
              disabled={!updatePublishedYear}
              placeholder="例：2000"
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateLanguage}
              onChange={(e) => setUpdateLanguage(e.target.checked)}
            />{' '}
            更新 language（留空代表清空）
            <input value={language} onChange={(e) => setLanguage(e.target.value)} disabled={!updateLanguage} />
          </label>

          <label>
            <input type="checkbox" checked={updateIsbn} onChange={(e) => setUpdateIsbn(e.target.checked)} /> 更新 isbn
            （留空代表清空）
            <input value={isbn} onChange={(e) => setIsbn(e.target.value)} disabled={!updateIsbn} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={updateClassification}
              onChange={(e) => setUpdateClassification(e.target.checked)}
            />{' '}
            更新 classification（留空代表清空）
            <input
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              disabled={!updateClassification}
            />
          </label>

          <button type="submit" className="btnPrimary" disabled={updating}>
            {updating ? '更新中…' : '送出 PATCH'}
          </button>
        </form>
      </section>

      {/* MARC 21（編輯/匯出） */}
      <section className="panel" id="marc21">
        <SectionHeader title="MARC 21（編輯/匯出）" />
        <p className="muted">
          對應 API：<code>GET /api/v1/orgs/:orgId/bibs/:bibId/marc</code> 與{' '}
          <code>GET/PUT /api/v1/orgs/:orgId/bibs/:bibId/marc-extras</code>
        </p>
        <p className="muted">
          若你想用「單一入口」管理 MARC，請用 <Link href={`/orgs/${params.orgId}/bibs/marc-editor?bib_id=${params.bibId}`}>MARC21 編輯器</Link>。
        </p>
        <p className="muted">
          注意：<code>001</code>/<code>005</code> 由系統產生（控制號/時間戳）；後端也會拒絕把{' '}
          <code>001</code>/<code>005</code> 存進 <code>marc_extras</code>（避免誤以為能覆蓋）。
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btnPrimary" onClick={() => void onGenerateMarcJson()} disabled={loadingMarc}>
            {loadingMarc ? '產生中…' : '產生 MARC(JSON)'}
          </button>
          <button type="button" className="btnSmall" onClick={() => void onDownloadMarcJson()}>
            下載 JSON
          </button>
          <button type="button" className="btnSmall" onClick={() => void onDownloadMarcXml()}>
            下載 MARCXML
          </button>
          <button type="button" className="btnSmall" onClick={() => void onDownloadMarcMrc()}>
            下載 .mrc
          </button>
        </div>

        <label style={{ marginTop: 12 }}>
          MARC(JSON)（由表單欄位 + marc_extras 產生）
          <textarea value={marcJsonText} readOnly rows={10} placeholder="按「產生 MARC(JSON)」後會出現在這裡" />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btnSmall" onClick={() => void onLoadMarcExtras()} disabled={loadingMarcExtras}>
            {loadingMarcExtras ? '載入中…' : '載入 marc_extras'}
          </button>
          <button type="button" className="btnPrimary" onClick={() => void onSaveMarcExtras()} disabled={savingMarcExtras}>
            {savingMarcExtras ? '儲存中…' : '儲存 marc_extras'}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            marc_extras（用於保留/編輯「表單未覆蓋」的 MARC 欄位；支援任意 tag/子欄位）
          </div>

          {marcExtras ? (
            <MarcFieldsEditor
              orgId={params.orgId}
              value={marcExtras}
              onChange={setMarcExtras}
              disabled={loadingMarcExtras || savingMarcExtras}
            />
          ) : (
            <div className="muted">尚未載入 marc_extras；按上方「載入 marc_extras」後可編輯。</div>
          )}

          {/* 保留 JSON 檢視：方便複製/除錯（但不建議直接手改） */}
          <details style={{ marginTop: 12 }}>
            <summary className="muted">檢視 marc_extras JSON</summary>
            <textarea
              value={JSON.stringify(marcExtras ?? [], null, 2)}
              readOnly
              rows={10}
              placeholder="[]"
              style={{ marginTop: 8 }}
            />
          </details>
        </div>
      </section>

      {/* 新增冊 */}
      <section className="panel">
        <SectionHeader title="新增冊（Item Copy）" />
        <p className="muted">
          對應 API：<code>POST /api/v1/orgs/:orgId/bibs/:bibId/items</code>（location 必須屬於同 org）。
        </p>

        <form onSubmit={onCreateItem} className="stack" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              barcode（必填；同 org 內唯一）
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="例：LIB-00001234" />
            </label>

            <label>
              call_number（必填）
              <input
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="例：823.914 R79 v.1"
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              location（必填）
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">（請選擇）</option>
                {activeLocationOptions.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </label>

            <label>
              status（選填；預設 available）
              <select value={status} onChange={(e) => setStatus(e.target.value as ItemStatus)}>
                <option value="available">available</option>
                <option value="checked_out">checked_out</option>
                <option value="on_hold">on_hold</option>
                <option value="lost">lost</option>
                <option value="withdrawn">withdrawn</option>
                <option value="repair">repair</option>
              </select>
            </label>
          </div>

          <label>
            notes（選填）
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>

          <button type="submit" className="btnPrimary" disabled={creatingItem}>
            {creatingItem ? '新增中…' : '新增冊'}
          </button>
        </form>
      </section>

      {/* items 列表 */}
      <section className="panel">
        <SectionHeader title="冊列表（此書目底下）" />

        {items && items.length === 0 ? <p className="muted">此書目目前沒有冊。</p> : null}

        {items && items.length > 0 ? (
          <div className="stack">
            <ul>
              {items.map((i) => (
                <li key={i.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div>
                      <Link href={`/orgs/${params.orgId}/items/${i.id}`}>{i.barcode}</Link>{' '}
                      <span className="muted">({i.status})</span>
                    </div>
                    <div className="muted">call_number={i.call_number}</div>
                    <div className="muted">location_id={i.location_id}</div>
                  </div>
                </li>
              ))}
            </ul>

            {itemsNextCursor ? (
              <button
                type="button"
                className="btnSmall"
                onClick={() => void loadMoreItems()}
                disabled={loadingMoreItems || loading}
              >
                {loadingMoreItems ? '載入中…' : '載入更多'}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* 讓使用者方便回到 bib 列表 */}
        <div style={{ marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}/bibs`}>← 回到 Bibs</Link>
        </div>
      </section>
    </div>
  );
}
