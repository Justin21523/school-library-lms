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
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Authority Control</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Authority Control</h1>
          <p className="muted">
            這頁需要 staff 登入。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Authority Control（主控入口）</h1>
        <p className="muted">
          這頁把「權威控制 / controlled vocabulary / thesaurus / MARC tools / backfill」集中成可導覽的入口，避免散落在側邊欄造成迷路。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}`}>回 Dashboard</Link>
          <Link href={`/orgs/${params.orgId}/authority-terms`}>Authority Terms（原始列表頁）</Link>
          <Link href={`/orgs/${params.orgId}/bibs`}>Bibs</Link>
          <Link href={`/orgs/${params.orgId}/bibs/marc-editor`}>MARC21 編輯器</Link>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Kind（治理範圍）</h2>
        <p className="muted">先選你要治理的 controlled vocab 類型，再進入對應工具（Thesaurus/Quality/Visual/Backfill）。</p>

        <label style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
          kind
          <select value={kind} onChange={(e) => setKind(e.target.value as AuthorityTerm['kind'])}>
            {AUTHORITY_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6, maxWidth: 520, marginTop: 12 }}>
          vocabulary_code（給 thesaurus / quick find 使用）
          <input value={vocabularyCode} onChange={(e) => setVocabularyCode(e.target.value)} placeholder="例如 builtin-zh / local" />
        </label>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>治理入口</h2>

        <div style={{ display: 'grid', gap: 12 }}>
          <div className="callout">
            <div style={{ fontWeight: 700 }}>A) Terms（主檔）</div>
            <div className="muted" style={{ marginTop: 6 }}>
              清單/搜尋/建立/停用/改標目/variant labels；term detail 可做 usage + merge/redirect。
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
              <Link href={`/orgs/${params.orgId}/authority-terms?kind=${encodeURIComponent(kind)}`}>開啟 Terms List</Link>
            </div>
          </div>

          <div className={`callout ${thesaurusKind ? '' : 'warn'}`}>
            <div style={{ fontWeight: 700 }}>B) Thesaurus（BT/NT/RT）</div>
            <div className="muted" style={{ marginTop: 6 }}>
              目前只支援 <code>subject/geographic/genre</code>（因為 name 不做 BT/NT）。Thesaurus 入口含：Browser / Quality / Visual / 匯入匯出。
            </div>
            {thesaurusKind ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
                <Link
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    vocabularyCode.trim() || 'builtin-zh',
                  )}`}
                >
                  Thesaurus Browser（含 Import/Export）
                </Link>
                <Link
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus/quality?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    vocabularyCode.trim() || 'builtin-zh',
                  )}`}
                >
                  Thesaurus Quality
                </Link>
                <Link
                  href={`/orgs/${params.orgId}/authority-terms/thesaurus/visual?kind=${encodeURIComponent(thesaurusKind)}&vocabulary_code=${encodeURIComponent(
                    vocabularyCode.trim() || 'builtin-zh',
                  )}`}
                >
                  Thesaurus Visual Editor
                </Link>
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 10 }}>
                你目前選的 kind=<code>{kind}</code> 不支援 BT/NT；請改用「Terms 主檔」治理（或回到 subject/geographic/genre）。
              </div>
            )}
          </div>

          <div className="callout">
            <div style={{ fontWeight: 700 }}>C) Backfill（既有資料 → term_id-driven）</div>
            <div className="muted" style={{ marginTop: 6 }}>
              把歷史的 <code>text[]</code>（例如 subjects / geographics / genres）回填到 junction table，並輸出 auto-created / ambiguous / unmatched 報表，讓 term-based 真正落地。
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
              <Link href={`/orgs/${params.orgId}/bibs/maintenance/backfill-subject-terms`}>subjects backfill</Link>
              <Link href={`/orgs/${params.orgId}/bibs/maintenance/backfill-geographic-terms`}>geographics backfill</Link>
              <Link href={`/orgs/${params.orgId}/bibs/maintenance/backfill-genre-terms`}>genres backfill</Link>
              <Link href={`/orgs/${params.orgId}/bibs/maintenance/backfill-name-terms`}>names backfill</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Quick Find（跳到 term detail）</h2>
        <p className="muted">
          這裡用 <code>suggest</code> 做快速跳轉（適合治理時先找到目標 term，再進 detail 做 usage/merge/relations）。
        </p>

        {error ? <p className="error">錯誤：{error}</p> : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ width: 420 }}>
            query
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="例如：汰舊 / 報廢 / 台灣 / fantasy" />
          </label>
          <button type="button" onClick={() => void runSuggest()} disabled={suggesting || !q.trim()}>
            {suggesting ? '搜尋中…' : '搜尋'}
          </button>
        </div>

        {suggestions ? (
          <div style={{ marginTop: 12 }}>
            {suggestions.length === 0 ? (
              <div className="muted">（沒有建議；可改用 Terms List 建立新 term）</div>
            ) : (
              <ul>
                {suggestions.map((t) => (
                  <li key={t.id} style={{ marginBottom: 8 }}>
                    <Link href={`/orgs/${params.orgId}/authority-terms/${t.id}`}>{t.preferred_label}</Link>{' '}
                    <span className="muted">
                      ({t.kind} · {t.status} · vocab={t.vocabulary_code ?? '—'})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>MARC Tools（交換格式）</h2>
        <p className="muted">
          MARC 是交換格式；本系統的治理真相來源仍是 term_id-driven（junction tables）。MARC 編輯器主要用來編輯 <code>marc_extras</code> 與下載 <code>.mrc/.xml/.json</code>。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}/bibs/import-marc`}>MARC Import</Link>
          <Link href={`/orgs/${params.orgId}/bibs/marc-editor`}>MARC21 編輯器</Link>
          <Link href={`/orgs/${params.orgId}/bibs/marc-dictionary`}>MARC 欄位字典</Link>
        </div>
      </section>
    </div>
  );
}

