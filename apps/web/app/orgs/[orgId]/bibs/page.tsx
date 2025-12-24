/**
 * Bibs Page（/orgs/:orgId/bibs）
 *
 * 對應 API：
 * - GET  /api/v1/orgs/:orgId/bibs?query=&isbn=&classification=
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

import { useEffect, useState } from 'react';

import Link from 'next/link';

import type { BibliographicRecord, BibliographicRecordWithCounts } from '../../../lib/api';
import { createBib, listBibs } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

// 把 textarea 的「一行一個值」轉成 string[]（空白行會被忽略）。
function parseLines(value: string) {
  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export default function BibsPage({ params }: { params: { orgId: string } }) {
  // staff session：建立書目需要 Bearer token；本頁直接要求先登入。
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  const [bibs, setBibs] = useState<BibliographicRecordWithCounts[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 搜尋條件：對應 API query params（query/isbn/classification）。
  const [query, setQuery] = useState('');
  const [isbn, setIsbn] = useState('');
  const [classification, setClassification] = useState('');

  // 建立書目表單（MVP：title 必填，其餘選填）。
  const [title, setTitle] = useState('');
  const [creators, setCreators] = useState('');
  const [subjects, setSubjects] = useState('');
  const [publisher, setPublisher] = useState('');
  const [publishedYear, setPublishedYear] = useState('');
  const [language, setLanguage] = useState('');
  const [isbnNew, setIsbnNew] = useState('');
  const [classificationNew, setClassificationNew] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<BibliographicRecord | null>(null);

  async function refresh(filters?: { query?: string; isbn?: string; classification?: string }) {
    setLoading(true);
    setError(null);
    try {
      const result = await listBibs(params.orgId, filters ?? {});
      setBibs(result);
    } catch (e) {
      setBibs(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
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
    await refresh({
      query: query.trim() || undefined,
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

    // creators/subjects：textarea（每行一個值）→ string[]。
    const creatorsList = parseLines(creators);
    const subjectsList = parseLines(subjects);

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
        ...(creatorsList ? { creators: creatorsList } : {}),
        ...(subjectsList ? { subjects: subjectsList } : {}),
        ...(publisher.trim() ? { publisher: publisher.trim() } : {}),
        ...(year !== undefined ? { published_year: year } : {}),
        ...(language.trim() ? { language: language.trim() } : {}),
        ...(isbnNew.trim() ? { isbn: isbnNew.trim() } : {}),
        ...(classificationNew.trim() ? { classification: classificationNew.trim() } : {}),
      });

      setCreated(result);

      // 清空表單（保留一些欄位也可以；MVP 先全清）。
      setTitle('');
      setCreators('');
      setSubjects('');
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
          <p className="error">
            這頁需要 staff 登入才能查詢/建立書目。請先前往{' '}
            <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Bibs</h1>
        <p className="muted">
          對應 API：<code>GET/POST /api/v1/orgs/:orgId/bibs</code>（支援 <code>?query=</code> /{' '}
          <code>?isbn=</code> / <code>?classification=</code>）
        </p>
        <p className="muted">
          批次匯入（US-022）：<Link href={`/orgs/${params.orgId}/bibs/import`}>Catalog CSV Import</Link>
        </p>

        {/* 搜尋區 */}
        <form onSubmit={onSearch} className="stack" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
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

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loading}>
              {loading ? '查詢中…' : '搜尋'}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsbn('');
                setClassification('');
                void refresh();
              }}
              disabled={loading}
            >
              清除
            </button>
          </div>
        </form>

        {/* 建立書目 */}
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <form onSubmit={onCreate} className="stack">
          <label>
            title（必填）
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：哈利波特：神秘的魔法石" />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              creators（選填；一行一位作者）
              <textarea
                value={creators}
                onChange={(e) => setCreators(e.target.value)}
                rows={4}
                placeholder="例：J. K. Rowling"
              />
            </label>

            <label>
              subjects（選填；一行一個主題詞）
              <textarea
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                rows={4}
                placeholder="例：魔法\n小說"
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
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

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={creating}>
              {creating ? '建立中…' : '建立書目'}
            </button>
            {created ? (
              <span className="success">
                已建立：<Link href={`/orgs/${params.orgId}/bibs/${created.id}`}>{created.title}</Link>
              </span>
            ) : null}
          </div>
        </form>

        {error ? <p className="error">錯誤：{error}</p> : null}
      </section>

      {/* 列表 */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>結果</h2>
        {loading ? <p className="muted">載入中…</p> : null}

        {!loading && bibs && bibs.length === 0 ? <p className="muted">沒有符合條件的書目。</p> : null}

        {!loading && bibs && bibs.length > 0 ? (
          <ul>
            {bibs.map((b) => (
              <li key={b.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <div>
                    <Link href={`/orgs/${params.orgId}/bibs/${b.id}`}>
                      <span style={{ fontWeight: 700 }}>{b.title}</span>
                    </Link>
                  </div>
                  <div className="muted">
                    isbn={b.isbn ?? '(none)'} · classification={b.classification ?? '(none)'} · available_items=
                    {b.available_items}/{b.total_items}
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
