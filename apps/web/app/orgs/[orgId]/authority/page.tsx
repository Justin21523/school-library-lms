'use client';

/**
 * Authority Control Home（/orgs/:orgId/authority）
 *
 * 使用者回報「頁面上找不到 authority control / MARC 編輯器的主入口」：
 * - 雖然側邊欄已經有零散連結（Authority Terms / Thesaurus / MARC Editor…）
 * - 但缺少一個「以治理工作流為中心」的首頁，會讓使用者不知道要從哪裡開始
 *
 * 因此這頁的定位是：單一 org 的「編目治理控制台」：
 * - Authority / controlled vocabulary（terms + thesaurus + quality + visual + import/export）
 * - Maintenance / backfill（把既有 text[] 回填成 term_id-driven）
 * - MARC tools（import / dictionary / marc_extras editor）
 *
 * 設計重點：
 * - kind（subject/geographic/genre/name…）是所有治理操作的第一層切換
 * - Thesaurus（BT/NT/RT）目前只支援 subject/geographic/genre（name 不做 BT/NT）
 * - 這頁只做「導覽與入口」，不取代各功能頁的完整操作（避免變成一個超大頁）
 */

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { AuthorityTerm } from '../../../lib/api';
import { suggestAuthorityTerms } from '../../../lib/api';
import { formatErrorMessage } from '../../../lib/error';
import { useStaffSession } from '../../../lib/use-staff-session';

import { NavIcon } from '../../../components/layout/nav-icons';
import { Alert } from '../../../components/ui/alert';
import { DataTable } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Field, Form, FormSection } from '../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../components/ui/page-header';
import { SkeletonText } from '../../../components/ui/skeleton';

type ThesaurusKind = 'subject' | 'geographic' | 'genre';

const AUTHORITY_KIND_OPTIONS: Array<{
  value: AuthorityTerm['kind'];
  label: string;
  supports_thesaurus: boolean;
}> = [
  { value: 'subject', label: 'subject（MARC 650）', supports_thesaurus: true },
  { value: 'geographic', label: 'geographic（MARC 651）', supports_thesaurus: true },
  { value: 'genre', label: 'genre（MARC 655）', supports_thesaurus: true },
  { value: 'name', label: 'name（MARC 100/700）', supports_thesaurus: false },
  { value: 'language', label: 'language（MARC 041 / 008）', supports_thesaurus: false },
  { value: 'relator', label: 'relator（MARC $e / $4）', supports_thesaurus: false },
];

function parseAuthorityKind(raw: string | null): AuthorityTerm['kind'] | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  return AUTHORITY_KIND_OPTIONS.some((o) => o.value === v) ? (v as AuthorityTerm['kind']) : null;
}

function toThesaurusKind(kind: AuthorityTerm['kind']): ThesaurusKind | null {
  if (kind === 'subject' || kind === 'geographic' || kind === 'genre') return kind;
  return null;
}

export default function AuthorityControlHomePage({ params }: { params: { orgId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const searchParams = useSearchParams();

  // ----------------------------
  // 1) kind selector（治理入口的第一層切換）
  // ----------------------------

  const initialKind = useMemo(() => parseAuthorityKind(searchParams.get('kind')) ?? 'subject', [searchParams]);
  const [kind, setKind] = useState<AuthorityTerm['kind']>(initialKind);

  // vocabulary_code：給「thesaurus / suggest」用（不是所有 kind 都一定會用到）
  // - 先預設 builtin-zh（你目前的主要詞彙庫）
  // - name/relator/language 也可以用 local；此處保留可調整
  const [vocabularyCode, setVocabularyCode] = useState('builtin-zh');

  const thesaurusKind = toThesaurusKind(kind);

  // ----------------------------
  // 2) quick find（快速跳到 term detail）
  // ----------------------------

  const [q, setQ] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<AuthorityTerm[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSuggest() {
    const query = q.trim();
    if (!query) return;

    setSuggesting(true);
    setError(null);
    try {
      const result = await suggestAuthorityTerms(params.orgId, {
        kind,
        q: query,
        ...(vocabularyCode.trim() ? { vocabulary_code: vocabularyCode.trim() } : {}),
        limit: 20,
      });
      setSuggestions(result);
    } catch (e) {
      setSuggestions(null);
      setError(formatErrorMessage(e));
    } finally {
      setSuggesting(false);
    }
  }

  // Login gate：authority / MARC tools 都是 staff 後台能力
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Authority Control" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="Authority Control" description="這頁需要 staff 登入才能使用治理工具。">
          <Alert variant="danger" title="需要登入">
            請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="Authority Control（主控入口）"
        description={
          <>
            把「權威控制 / controlled vocabulary / thesaurus / backfill / MARC tools」集中成治理導覽入口，避免功能散落在側邊欄造成迷路。
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}`}>
              Dashboard
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority-terms`}>
              Terms
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/marc-editor`}>
              MARC 編輯器
            </Link>
          </>
        }
      >
        <div className="muted" style={{ display: 'grid', gap: 4 }}>
          <div>
            orgId：<code>{params.orgId}</code>
          </div>
          <div>
            目前 kind：<code>{kind}</code> · vocabulary_code：<code>{vocabularyCode.trim() || '—'}</code>
          </div>
        </div>

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="Kind（治理範圍）" description="先選你要治理的 controlled vocab 類型，再進入對應工具（Terms/Thesaurus/Backfill）。" />
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="治理範圍" description="vocabulary_code 會用於 thesaurus 與 quick find（建議先選 builtin-zh 或 local）。">
            <div className="grid2">
              <Field label="kind" htmlFor="authority_kind">
                <select id="authority_kind" value={kind} onChange={(e) => setKind(e.target.value as AuthorityTerm['kind'])}>
                  {AUTHORITY_KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="vocabulary_code" htmlFor="authority_vocab" hint="例如 builtin-zh / local">
                <input
                  id="authority_vocab"
                  value={vocabularyCode}
                  onChange={(e) => setVocabularyCode(e.target.value)}
                  placeholder="builtin-zh / local"
                />
              </Field>
            </div>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="治理入口" description="把常用治理流程收斂成清楚的入口（Terms / Thesaurus / Backfill）。" />

        <div className="cardGrid">
          <div className="card">
            <div className="cardHeader">
              <div className="cardIcon" aria-hidden="true">
                <NavIcon id="authority" size={20} />
              </div>
              <div>
                <div className="cardTitle">A) Terms（主檔）</div>
                <div className="cardMeta">清單/搜尋/建立/停用/variant labels；term detail 可做 usage + merge/redirect。</div>
              </div>
            </div>
            <div className="cardLinks">
              <Link className="btnSmall" href={`/orgs/${params.orgId}/authority-terms?kind=${encodeURIComponent(kind)}`}>
                開啟 Terms List
              </Link>
            </div>
          </div>

          <div className={thesaurusKind ? 'card' : 'card card--warn'}>
            <div className="cardHeader">
              <div className="cardIcon" aria-hidden="true">
                <NavIcon id="authority" size={20} />
              </div>
              <div>
                <div className="cardTitle">B) Thesaurus（BT/NT/RT）</div>
                <div className="cardMeta">
                  目前只支援 <code>subject/geographic/genre</code>（name 不做 BT/NT）。入口含：Browser / Quality / Visual / 匯入匯出。
                </div>
              </div>
            </div>

            {thesaurusKind ? (
              <div className="cardLinks">
                <Link
                  className="btnSmall"
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    vocabularyCode.trim() || 'builtin-zh',
                  )}`}
                >
                  Browser
                </Link>
                <Link
                  className="btnSmall"
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus/quality?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    vocabularyCode.trim() || 'builtin-zh',
                  )}`}
                >
                  Quality
                </Link>
                <Link
                  className="btnSmall"
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus/visual?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    vocabularyCode.trim() || 'builtin-zh',
                  )}`}
                >
                  Visual Editor
                </Link>
              </div>
            ) : (
              <Alert variant="warning" title="此 kind 不支援 Thesaurus">
                你目前選的 kind=<code>{kind}</code> 不支援 BT/NT；請改用「Terms 主檔」治理（或切換到 subject/geographic/genre）。
              </Alert>
            )}
          </div>

          <div className="card">
            <div className="cardHeader">
              <div className="cardIcon" aria-hidden="true">
                <NavIcon id="maintenance" size={20} />
              </div>
              <div>
                <div className="cardTitle">C) Backfill（既有資料 → term_id-driven）</div>
                <div className="cardMeta">
                  把歷史的 <code>text[]</code>（例如 subjects / geographics / genres）回填到 junction table，並輸出 auto-created / ambiguous / unmatched 報表，讓 term-based 真正落地。
                </div>
              </div>
            </div>
            <div className="cardLinks">
              <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/maintenance/backfill-subject-terms`}>
                650 subject
              </Link>
              <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/maintenance/backfill-geographic-terms`}>
                651 geographic
              </Link>
              <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/maintenance/backfill-genre-terms`}>
                655 genre
              </Link>
              <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/maintenance/backfill-name-terms`}>
                100/700 name
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <SectionHeader
          title="Quick Find（跳到 term detail）"
          description={
            <>
              用 <code>suggest</code> 做快速跳轉（適合治理時先找到目標 term，再進 detail 做 usage/merge/relations）。
            </>
          }
        />

        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void runSuggest();
          }}
        >
          <FormSection title="查詢" description="建議先選上方 kind/vocabulary_code，再輸入關鍵字。">
            <div className="toolbar">
              <div className="toolbarLeft" style={{ flex: 1, minWidth: 260 }}>
                <Field label="query" htmlFor="authority_quick_find_query">
                  <input
                    id="authority_quick_find_query"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="例如：汰舊 / 報廢 / 台灣 / fantasy"
                  />
                </Field>
              </div>
              <div className="toolbarRight">
                <button type="submit" className="btnPrimary" disabled={suggesting || !q.trim()}>
                  {suggesting ? '搜尋中…' : '搜尋'}
                </button>
              </div>
            </div>

            {suggesting ? <SkeletonText lines={3} /> : null}
            {suggestions ? (
              suggestions.length === 0 ? (
                <EmptyState title="沒有建議" description="可改用 Terms List 建立新 term，或調整 query / vocabulary_code。" />
              ) : (
                <DataTable
                  rows={suggestions}
                  getRowKey={(r) => r.id}
                  density="compact"
                  columns={[
                    {
                      id: 'label',
                      header: 'term',
                      cell: (r) => (
                        <div style={{ display: 'grid', gap: 2 }}>
                          <Link href={`/orgs/${params.orgId}/authority-terms/${r.id}`} style={{ fontWeight: 800 }}>
                            {r.preferred_label}
                          </Link>
                          <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                            <code>{r.id}</code>
                          </div>
                        </div>
                      ),
                      sortValue: (r) => r.preferred_label,
                    },
                    { id: 'kind', header: 'kind', cell: (r) => <code>{r.kind}</code>, width: 120, sortValue: (r) => r.kind },
                    {
                      id: 'status',
                      header: 'status',
                      cell: (r) => <code>{r.status}</code>,
                      width: 120,
                      sortValue: (r) => r.status,
                    },
                    {
                      id: 'vocab',
                      header: 'vocab',
                      cell: (r) => <code>{r.vocabulary_code ?? '—'}</code>,
                      width: 140,
                      sortValue: (r) => r.vocabulary_code ?? '',
                    },
                  ]}
                />
              )
            ) : null}
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader
          title="MARC Tools（交換格式）"
          description={
            <>
              MARC 是交換格式；治理真相來源仍是 term_id-driven（junction tables）。MARC 編輯器主要用來編輯 <code>marc_extras</code> 與下載 <code>.mrc/.xml/.json</code>。
            </>
          }
        />

        <div className="cardGrid">
          <div className="card">
            <div className="cardHeader">
              <div className="cardIcon" aria-hidden="true">
                <NavIcon id="marc" size={20} />
              </div>
              <div>
                <div className="cardTitle">MARC Import</div>
                <div className="cardMeta">批次 preview/apply；未對映欄位保留到 marc_extras。</div>
              </div>
            </div>
            <div className="cardLinks">
              <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/import-marc`}>
                開啟
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <div className="cardIcon" aria-hidden="true">
                <NavIcon id="marc" size={20} />
              </div>
              <div>
                <div className="cardTitle">MARC 編輯器</div>
                <div className="cardMeta">編輯 marc_extras；下載 .mrc/.xml/.json。</div>
              </div>
            </div>
            <div className="cardLinks">
              <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/marc-editor`}>
                開啟
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <div className="cardIcon" aria-hidden="true">
                <NavIcon id="marc" size={20} />
              </div>
              <div>
                <div className="cardTitle">MARC 欄位字典</div>
                <div className="cardMeta">欄位/指標/子欄位一覽 + 搜尋（供編目與驗證）。</div>
              </div>
            </div>
            <div className="cardLinks">
              <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/marc-dictionary`}>
                開啟
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
