/**
 * TermMultiPicker（Authority term 多選 + chips + 排序 + thesaurus 瀏覽/搜尋）
 *
 * 你要的「編目表單 term-based」核心 UX：
 * - 不再讓使用者直接輸入 subjects 字串（容易同名/同義/拼法差異）
 * - 改用 authority_terms 的 term id 作為真相來源（subject_term_ids）
 * - UI 以 chips 呈現目前已選 terms，並允許調整順序（position）
 * - 同時提供：
 *   - 搜尋（autocomplete：suggest API）
 *   - 瀏覽（thesaurus roots/children：lazy-load）
 *
 * 設計取捨（MVP → 可演進）：
 * - 本元件不嘗試一次拉回整棵 thesaurus（可能是幾萬 nodes）
 * - 改用「roots 作入口、children 逐步展開」的模式（對齊 API 的 keyset pagination）
 * - 不在這裡做「term merge/redirect」等治理；那屬於 Authority 管理介面（下一步會做）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type { ThesaurusChildrenPage, ThesaurusRootsPage } from '../../lib/api';
import { ApiError, createAuthorityTerm, listThesaurusChildren, listThesaurusRoots, suggestAuthorityTerms } from '../../lib/api';
import { formatErrorMessage } from '../../lib/error';
import { Alert } from '../ui/alert';

// AuthorityTermLite：編目 UI 最常用的 term shape（id + label + vocab）。
// - 盡量小：避免每次操作都需要完整 term detail。
export type AuthorityTermLite = {
  id: string;
  vocabulary_code: string;
  preferred_label: string;
};

export function TermMultiPicker(props: {
  orgId: string;
  kind: 'subject' | 'name' | 'geographic' | 'genre';
  label: string;
  value: AuthorityTermLite[];
  onChange: (next: AuthorityTermLite[]) => void;
  disabled?: boolean;
  helpText?: React.ReactNode;
  // enableBrowse：目前只支援 subject（name 不做 BT/NT）
  enableBrowse?: boolean;
  // defaultVocabularyCode：瀏覽入口預設要看的 vocabulary（例如 builtin-zh）
  defaultVocabularyCode?: string;
}) {
  const disabled = props.disabled ?? false;

  // ----------------------------
  // 1) chips 操作：add/remove/reorder（position）
  // ----------------------------

  const ids = useMemo(() => new Set(props.value.map((t) => t.id)), [props.value]);

  function addTerm(term: AuthorityTermLite) {
    if (disabled) return;
    if (ids.has(term.id)) return;
    props.onChange([...props.value, term]);
  }

  function removeTerm(id: string) {
    if (disabled) return;
    props.onChange(props.value.filter((t) => t.id !== id));
  }

  function moveTerm(id: string, direction: 'up' | 'down') {
    if (disabled) return;
    const idx = props.value.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const nextIndex = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIndex < 0 || nextIndex >= props.value.length) return;
    const next = props.value.slice();
    const [item] = next.splice(idx, 1);
    next.splice(nextIndex, 0, item!);
    props.onChange(next);
  }

  // ----------------------------
  // 2) 搜尋：suggest（autocomplete）
  // ----------------------------

  const [searchQuery, setSearchQuery] = useState('');
  const [searchVocabularyCode, setSearchVocabularyCode] = useState<string>(''); // '' = all
  const [suggestions, setSuggestions] = useState<AuthorityTermLite[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createVocabularyCode = useMemo(() => {
    // 建議的預設：一律落在 local（避免把「人為新增」混進 builtin 詞彙庫）
    // - 若館員真的要指定詞彙庫，可以在上方輸入 vocabulary_code（同時也會變成 suggest filter）。
    const v = searchVocabularyCode.trim();
    return v || 'local';
  }, [searchVocabularyCode]);

  async function runSuggest() {
    const q = searchQuery.trim();
    if (!q) return;

    setSuggesting(true);
    setError(null);
    try {
      const result = await suggestAuthorityTerms(props.orgId, {
        kind: props.kind,
        q,
        ...(searchVocabularyCode.trim() ? { vocabulary_code: searchVocabularyCode.trim() } : {}),
        limit: 20,
      });
      setSuggestions(
        result.map((t) => ({ id: t.id, vocabulary_code: t.vocabulary_code, preferred_label: t.preferred_label })),
      );
    } catch (e) {
      setSuggestions(null);
      setError(formatErrorMessage(e));
    } finally {
      setSuggesting(false);
    }
  }

  async function createFromSearchQuery() {
    const label = searchQuery.trim();
    if (!label) return;

    setCreating(true);
    setError(null);
    try {
      const created = await createAuthorityTerm(props.orgId, {
        kind: props.kind,
        preferred_label: label,
        vocabulary_code: createVocabularyCode,
        // source：讓日後治理/追溯看得出「這筆是 UI 即時新增」
        source: 'web-ui',
      });

      addTerm({ id: created.id, vocabulary_code: created.vocabulary_code, preferred_label: created.preferred_label });

      // UX：新增成功後清掉查詢（避免使用者連按造成重複/混淆）
      setSearchQuery('');
      setSuggestions(null);
    } catch (e) {
      // 409 CONFLICT：同 org/kind/vocabulary_code 下 preferred_label 已存在
      // - 這不是「真正的錯誤」，多半是使用者已經建過，或其他人同時建了
      // - 我們直接重新跑一次 suggest，讓使用者用「加入」完成動作
      if (e instanceof ApiError && e.body?.error?.code === 'CONFLICT') {
        setError('同名款目已存在（已重新載入建議；請從建議中加入）');
        await runSuggest();
        return;
      }

      setError(`新增款目失敗：${formatErrorMessage(e)}`);
    } finally {
      setCreating(false);
    }
  }

 // ----------------------------
  // 3) 瀏覽：thesaurus roots/children（hierarchy browsing）
  // ----------------------------

  // enableBrowse：
  // - name 款目 v1 不做 BT/NT（通常以 authority record / see also 為主）
  // - subject/geographic/genre 則可用同一套「roots → children lazy-load」瀏覽（對齊 650/651/655）
  const browseKind = props.kind === 'subject' || props.kind === 'geographic' || props.kind === 'genre' ? props.kind : null;
  const enableBrowse = Boolean(props.enableBrowse && browseKind);

  const [browseVocabularyCode, setBrowseVocabularyCode] = useState(props.defaultVocabularyCode ?? 'builtin-zh');
  const [browseQuery, setBrowseQuery] = useState('');
  const [rootsPage, setRootsPage] = useState<ThesaurusRootsPage | null>(null);
  const [loadingRoots, setLoadingRoots] = useState(false);

  // expandedIds：目前展開了哪些節點（term_id）
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // childrenById：term_id → children page（只快取第一頁；後續若要 load more 可再擴充）
  const [childrenById, setChildrenById] = useState<Map<string, ThesaurusChildrenPage>>(new Map());
  const [loadingChildrenId, setLoadingChildrenId] = useState<string | null>(null);

  async function refreshRoots(cursor?: string) {
    if (!enableBrowse) return;
    const vocab = browseVocabularyCode.trim();
    if (!vocab) {
      setError('請輸入 vocabulary_code 才能瀏覽 thesaurus');
      return;
    }

    setLoadingRoots(true);
    setError(null);
    try {
      const page = await listThesaurusRoots(props.orgId, {
        kind: browseKind!,
        vocabulary_code: vocab,
        status: 'active',
        ...(browseQuery.trim() ? { query: browseQuery.trim() } : {}),
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });

      // 若有 cursor，代表「載入更多」；否則是刷新
      if (cursor && rootsPage) {
        setRootsPage({ items: [...rootsPage.items, ...page.items], next_cursor: page.next_cursor });
      } else {
        setRootsPage(page);
        // 切 vocab/query 時，把展開狀態清掉（避免顯示錯誤 children）
        setExpandedIds(new Set());
        setChildrenById(new Map());
        setLoadingChildrenId(null);
      }
    } catch (e) {
      setRootsPage(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingRoots(false);
    }
  }

  async function toggleExpand(termId: string) {
    if (!enableBrowse) return;
    if (disabled) return;

    setError(null);

    // collapse
    if (expandedIds.has(termId)) {
      const next = new Set(expandedIds);
      next.delete(termId);
      setExpandedIds(next);
      return;
    }

    // expand
    const next = new Set(expandedIds);
    next.add(termId);
    setExpandedIds(next);

    // children cache hit
    if (childrenById.has(termId)) return;

    setLoadingChildrenId(termId);
    try {
      const page = await listThesaurusChildren(props.orgId, termId, { status: 'active', limit: 200 });
      setChildrenById((prev) => {
        const m = new Map(prev);
        m.set(termId, page);
        return m;
      });
    } catch (e) {
      // 展開 children 失敗：不阻擋其他操作；只顯示錯誤
      setError(formatErrorMessage(e));
    } finally {
      setLoadingChildrenId(null);
    }
  }

  // 初次載入：如果啟用瀏覽，就先載 roots（讓使用者不用先按按鈕）。
  useEffect(() => {
    if (!enableBrowse) return;
    void refreshRoots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableBrowse]);

  // ----------------------------
  // UI
  // ----------------------------

  return (
    <div className="stack">
      <label>
        {props.label}
        {props.helpText ? <div className="muted" style={{ marginTop: 6 }}>{props.helpText}</div> : null}
      </label>

      {/* chips：已選 terms（可調順序） */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {props.value.length === 0 ? (
          <span className="muted">尚未選擇</span>
        ) : (
          props.value.map((t, idx) => (
            <span key={t.id} className="pill">
              <span>{t.preferred_label}</span>
              <span className="muted" style={{ marginLeft: 6 }}>({t.vocabulary_code})</span>
              <Link href={`/orgs/${props.orgId}/authority-terms/${t.id}`} className="muted" style={{ marginLeft: 8 }}>
                主檔
              </Link>
              <span style={{ marginLeft: 10, display: 'inline-flex', gap: 6 }}>
                <button type="button" className="btnSmall" onClick={() => moveTerm(t.id, 'up')} disabled={disabled || idx === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  className="btnSmall"
                  onClick={() => moveTerm(t.id, 'down')}
                  disabled={disabled || idx === props.value.length - 1}
                >
                  ↓
                </button>
                <button type="button" className={['btnSmall', 'btnDanger'].join(' ')} onClick={() => removeTerm(t.id)} disabled={disabled}>
                  移除
                </button>
              </span>
            </span>
          ))
        )}
      </div>

      {/* 搜尋（suggest） */}
      <div className="callout">
        <div className="muted" style={{ marginBottom: 6 }}>
          搜尋（autocomplete）：輸入關鍵字 → 從建議中選擇加入。
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={props.kind === 'subject' ? '例：汰舊 / 魔法 / 資訊素養' : '例：Rowling / 張小明'}
            disabled={disabled}
          />
          <input
            value={searchVocabularyCode}
            onChange={(e) => setSearchVocabularyCode(e.target.value)}
            placeholder="vocabulary_code（選填）"
            disabled={disabled}
          />
          <button type="button" className={['btnSmall', 'btnPrimary'].join(' ')} onClick={() => void runSuggest()} disabled={disabled || suggesting}>
            {suggesting ? '搜尋中…' : '搜尋'}
          </button>
        </div>

        {suggestions && suggestions.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {suggestions.map((t) => (
              <button key={t.id} type="button" className="btnSmall" onClick={() => addTerm(t)} disabled={disabled || ids.has(t.id)}>
                {ids.has(t.id) ? '已選' : '加入'}：{t.preferred_label}（{t.vocabulary_code}）
              </button>
            ))}
          </div>
        ) : null}

        {/* quick create：避免「沒有任何 authority terms → 編目卡住」 */}
        {searchQuery.trim() ? (
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={['btnSmall', 'btnPrimary'].join(' ')}
              onClick={() => void createFromSearchQuery()}
              disabled={disabled || creating}
            >
              {creating ? '新增中…' : `新增款目：${searchQuery.trim()}`}
            </button>
            <span className="muted">
              vocabulary_code：<code>{createVocabularyCode}</code>（可在上方輸入框改成你要的詞彙庫）
            </span>
          </div>
        ) : null}
      </div>

      {/* 瀏覽（thesaurus） */}
      {enableBrowse ? (
        <div className="callout">
          <div className="muted" style={{ marginBottom: 6 }}>
            瀏覽（thesaurus）：以 roots 作入口，逐步展開 children（lazy-load）。
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8 }}>
            <input
              value={browseVocabularyCode}
              onChange={(e) => setBrowseVocabularyCode(e.target.value)}
              placeholder="vocabulary_code（必填；例如 builtin-zh/local）"
              disabled={disabled}
            />
            <input
              value={browseQuery}
              onChange={(e) => setBrowseQuery(e.target.value)}
              placeholder="roots filter（選填；用 ILIKE）"
              disabled={disabled}
            />
            <button type="button" className="btnSmall" onClick={() => void refreshRoots()} disabled={disabled || loadingRoots}>
              {loadingRoots ? '載入中…' : '刷新 roots'}
            </button>
            <button
              type="button"
              className="btnSmall"
              onClick={() => {
                setBrowseQuery('');
                void refreshRoots();
              }}
              disabled={disabled || loadingRoots}
            >
              清除 filter
            </button>
          </div>

          {rootsPage ? (
            <div style={{ marginTop: 10 }}>
              {rootsPage.items.map((n) => (
                <div key={n.id} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btnSmall" onClick={() => addTerm({ id: n.id, vocabulary_code: n.vocabulary_code, preferred_label: n.preferred_label })} disabled={disabled || ids.has(n.id)}>
                      {ids.has(n.id) ? '已選' : '加入'}
                    </button>
                    <span>
                      {n.preferred_label} <span className="muted">({n.vocabulary_code})</span>
                    </span>
                    {n.has_children ? (
                      <button type="button" className="btnSmall" onClick={() => void toggleExpand(n.id)} disabled={disabled}>
                        {expandedIds.has(n.id) ? '收合' : '展開'}
                      </button>
                    ) : (
                      <span className="muted">（無 children）</span>
                    )}
                    {loadingChildrenId === n.id ? <span className="muted">載入 children…</span> : null}
                  </div>

                  {expandedIds.has(n.id) ? (
                    <div style={{ marginLeft: 28, marginTop: 6 }}>
                      {childrenById.get(n.id)?.items?.length ? (
                        childrenById.get(n.id)!.items.map((edge) => (
                          <div key={edge.relation_id} style={{ marginBottom: 4 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btnSmall"
                                onClick={() =>
                                  addTerm({
                                    id: edge.term.id,
                                    vocabulary_code: edge.term.vocabulary_code,
                                    preferred_label: edge.term.preferred_label,
                                  })
                                }
                                disabled={disabled || ids.has(edge.term.id)}
                              >
                                {ids.has(edge.term.id) ? '已選' : '加入'}
                              </button>
                              <span>
                                {edge.term.preferred_label}{' '}
                                <span className="muted">({edge.term.vocabulary_code})</span>
                              </span>
                              {edge.term.has_children ? (
                                <button type="button" className="btnSmall" onClick={() => void toggleExpand(edge.term.id)} disabled={disabled}>
                                  {expandedIds.has(edge.term.id) ? '收合' : '展開'}
                                </button>
                              ) : null}
                              {loadingChildrenId === edge.term.id ? <span className="muted">載入 children…</span> : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="muted">（children 尚未載入或為空）</div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}

              {rootsPage.next_cursor ? (
                <button type="button" className="btnSmall" onClick={() => void refreshRoots(rootsPage.next_cursor!)} disabled={disabled || loadingRoots}>
                  載入更多 roots
                </button>
              ) : null}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 10 }}>
              尚未載入 roots
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <Alert variant="danger" title="無法載入權威詞">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
