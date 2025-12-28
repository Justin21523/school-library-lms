'use client';

/**
 * Thesaurus Visual Editor（/orgs/:orgId/authority-terms/thesaurus/visual）
 *
 * 你回饋「需要更人性化、可視覺化編輯的 thesaurus 介面」：
 * - 既有 `/thesaurus` 已能 roots/children lazy-load（可撐幾萬 terms）
 * - 但仍偏「樹狀清單」：缺少「右側詳情/快速編輯」與「圖形化」理解
 *
 * 因此這頁提供 v1.2 的 UI：
 * 1) 左側：可展開的樹（roots → children lazy-load）
 * 2) 右側：Term inspector（詳情、BT/NT/RT、快速新增/連結/刪除）
 * 3) 圖形化：用 `thesaurus/graph`（depth-limited）畫出局部關係圖，點節點可快速切換
 *
 * 設計原則（避免踩坑）：
 * - 不一次載全樹：只在展開時載 children
 * - 不在前端推導「完整路徑」：polyhierarchy 可能多條路徑；用 ancestors API 顯示 breadcrumbs
 * - 編輯操作都回到 API（單一真相來源），UI 只做最小狀態同步（必要時 refresh roots/children）
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type {
  AuthorityTerm,
  AuthorityTermDetail,
  AuthorityTermSummary,
  MergeAuthorityTermPreviewResult,
  ThesaurusAncestorsResult,
  ThesaurusChildrenPage,
  ThesaurusGraphResult,
  ThesaurusNodeSummary,
  ThesaurusRootsPage,
  ThesaurusRelationKind,
} from '../../../../../lib/api';
import {
  addAuthorityTermRelation,
  ApiError,
  applyMergeAuthorityTerm,
  createAuthorityTerm,
  deleteAuthorityTermRelation,
  getAuthorityTerm,
  getThesaurusAncestors,
  getThesaurusGraph,
  listThesaurusChildren,
  listThesaurusRoots,
  previewMergeAuthorityTerm,
  suggestAuthorityTerms,
} from '../../../../../lib/api';
import { formatErrorMessage } from '../../../../../lib/error';
import { useStaffSession } from '../../../../../lib/use-staff-session';
import { ThesaurusGraph } from '../../../../../components/thesaurus/thesaurus-graph';

function parseLines(value: string) {
  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

// TermDragInfo：拖拉（drag/drop）時需要的最小資訊
// - 我們刻意只放 UI 需要的欄位（避免把整個 AuthorityTermDetail 塞進 dataTransfer）
// - 拖拉資料會被序列化成 JSON 字串（dataTransfer 只能放字串）
type TermDragInfo = {
  id: string;
  kind: AuthorityTerm['kind'];
  vocabulary_code: string;
  preferred_label: string;
  status: AuthorityTerm['status'];
};

type DragMode = 'reparent' | 'merge';

type PendingReparent = {
  child: TermDragInfo;
  parent: TermDragInfo | null; // null 代表「拖到 ROOT」→ 移除所有 BT

  // keep_other_broaders：
  // - false（預設）：把 term「移動」到新 parent（替換 BT）
  // - true：把 term 掛到「額外 parent」（形成 polyhierarchy，多重上位）
  keep_other_broaders: boolean;
};

function toTermDragInfo(term: Pick<TermDragInfo, 'id' | 'kind' | 'vocabulary_code' | 'preferred_label' | 'status'>): TermDragInfo {
  // 這裡的存在目的，是把「我們要塞進拖拉 payload 的形狀」固定下來：
  // - 未來如果 AuthorityTermSummary/ThesaurusNodeSummary 欄位改名，TS 會提醒我們修這裡。
  return {
    id: String(term.id),
    kind: term.kind,
    vocabulary_code: String(term.vocabulary_code ?? ''),
    preferred_label: String(term.preferred_label ?? ''),
    status: term.status,
  };
}

function serializeDragData(info: TermDragInfo) {
  return JSON.stringify(info);
}

function parseDragData(raw: string): TermDragInfo | null {
  // 防呆：drop 可能來自外部（例如使用者從別的頁面拖文字進來）
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;

    if (typeof record['id'] !== 'string') return null;
    if (typeof record['kind'] !== 'string') return null;
    if (typeof record['vocabulary_code'] !== 'string') return null;
    if (typeof record['preferred_label'] !== 'string') return null;
    if (typeof record['status'] !== 'string') return null;

    // 這裡不做更嚴格的 union 檢查（例如 status 只能是 active/inactive），
    // 因為拖拉 payload 只是 UI 用；真正的驗證仍以後端為準。
    return {
      id: record['id'],
      kind: record['kind'] as AuthorityTerm['kind'],
      vocabulary_code: record['vocabulary_code'],
      preferred_label: record['preferred_label'],
      status: record['status'] as AuthorityTerm['status'],
    };
  } catch {
    return null;
  }
}

type ChildrenState = {
  page: ThesaurusChildrenPage | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

export default function ThesaurusVisualEditorPage({ params }: { params: { orgId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const searchParams = useSearchParams();

  // ----------------------------
  // 0) Drag & Drop（更人性化：re-parent / merge）
  // ----------------------------
  //
  // 你希望 A) thesaurus 可以「拖拉式 re-parent」與「merge 預覽內嵌」：
  // - 我們不引入 DnD library（避免 bundle 變大、也避免跟現有 UI 的 pointer event 打架）
  // - v1 用 HTML5 drag/drop（夠用、可讀性高、且容易加上 preview/confirm）
  const [dragMode, setDragMode] = useState<DragMode>('reparent');

  const [pendingReparent, setPendingReparent] = useState<PendingReparent | null>(null);
  const [applyingReparent, setApplyingReparent] = useState(false);

  // ----------------------------
  // 1) Filters（整頁的「視角」）
  // ----------------------------
  //
  // 你未來會有多個詞彙庫（builtin-zh / local / imported-lcsh ...），也會有多個 controlled vocab kinds（650/651/655...），
  // 因此視覺化瀏覽要先鎖定：
  // - kind（subject/geographic/genre）
  // - vocabulary_code（某一套詞彙庫）
  // 否則 roots 會混在一起、也會違反「關係只能在同 kind + 同 vocabulary_code」的規則。
  const [kind, setKind] = useState<'subject' | 'geographic' | 'genre'>(() => {
    const v = (searchParams.get('kind') ?? '').trim();
    if (v === 'subject' || v === 'geographic' || v === 'genre') return v;
    return 'subject';
  });
  const [vocabularyCode, setVocabularyCode] = useState(() => (searchParams.get('vocabulary_code') ?? '').trim() || 'builtin-zh');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>(() => {
    const v = (searchParams.get('status') ?? '').trim();
    if (v === 'active' || v === 'inactive' || v === 'all') return v;
    return 'active';
  });
  const [query, setQuery] = useState(() => (searchParams.get('query') ?? '').trim());
  const [limit, setLimit] = useState(() => (searchParams.get('limit') ?? '').trim() || '200');

  const limitValue = useMemo(() => {
    const n = Number.parseInt(limit.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) return 200;
    return Math.min(n, 500);
  }, [limit]);

  // ----------------------------
  // 2) 左側：Tree（roots + children lazy-load）
  // ----------------------------

  const [roots, setRoots] = useState<ThesaurusRootsPage | null>(null);
  const [loadingRoots, setLoadingRoots] = useState(false);
  const [loadingMoreRoots, setLoadingMoreRoots] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [childrenById, setChildrenById] = useState<Record<string, ChildrenState>>({});

  // selected：點樹/點圖 都會改它
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  // shared messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // URL deep link：讓 Authority Control 主頁可以「帶著 kind/vocabulary_code」打開 Visual Editor
  // - 例如：/thesaurus/visual?kind=genre&vocabulary_code=builtin-zh
  const lastInitializedQueryStringRef = useRef<string | null>(null);
  useEffect(() => {
    const queryString = searchParams.toString();
    if (lastInitializedQueryStringRef.current === queryString) return;
    lastInitializedQueryStringRef.current = queryString;

    const urlKind = (searchParams.get('kind') ?? '').trim();
    if (urlKind === 'subject' || urlKind === 'geographic' || urlKind === 'genre') setKind(urlKind);

    const urlVocab = (searchParams.get('vocabulary_code') ?? '').trim();
    if (urlVocab) setVocabularyCode(urlVocab);

    const urlStatus = (searchParams.get('status') ?? '').trim();
    if (urlStatus === 'active' || urlStatus === 'inactive' || urlStatus === 'all') setStatus(urlStatus);

    const urlQuery = (searchParams.get('query') ?? '').trim();
    if (urlQuery) setQuery(urlQuery);

    const urlLimit = (searchParams.get('limit') ?? '').trim();
    if (urlLimit) setLimit(urlLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 重要：kind/vocabulary_code 變更時，視角已切換
  // - roots/children/selection 都要清空，避免把不同 vocab/kind 的樹狀狀態混在一起
  useEffect(() => {
    setRoots(null);
    setExpanded({});
    setChildrenById({});
    setSelectedTermId(null);
  }, [kind, vocabularyCode]);

  async function refreshRoots() {
    const vocab = vocabularyCode.trim();
    if (!vocab) {
      setError('vocabulary_code 不可為空（例如 builtin-zh / local）');
      return;
    }

    setLoadingRoots(true);
    setError(null);
    setSuccess(null);
    try {
      const page = await listThesaurusRoots(params.orgId, {
        kind,
        vocabulary_code: vocab,
        status,
        ...(query.trim() ? { query: query.trim() } : {}),
        limit: limitValue,
      });
      setRoots(page);

      // UX：第一次載入時，預設選第一個 root（讓右側 inspector 立即有內容）
      if (!selectedTermId && page.items.length > 0) setSelectedTermId(page.items[0]!.id);
    } catch (e) {
      setRoots(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingRoots(false);
    }
  }

  async function loadMoreRoots() {
    if (!roots?.next_cursor) return;
    const vocab = vocabularyCode.trim();
    if (!vocab) return;

    setLoadingMoreRoots(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await listThesaurusRoots(params.orgId, {
        kind,
        vocabulary_code: vocab,
        status,
        ...(query.trim() ? { query: query.trim() } : {}),
        limit: limitValue,
        cursor: roots.next_cursor,
      });
      setRoots({ items: [...roots.items, ...next.items], next_cursor: next.next_cursor });
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMoreRoots(false);
    }
  }

  async function ensureChildrenLoaded(termId: string) {
    const current = childrenById[termId] ?? null;
    if (current?.page) return;

    setChildrenById((prev) => ({
      ...prev,
      [termId]: { page: null, loading: true, loadingMore: false, error: null },
    }));

    try {
      const page = await listThesaurusChildren(params.orgId, termId, { status, limit: 200 });
      setChildrenById((prev) => ({
        ...prev,
        [termId]: { page, loading: false, loadingMore: false, error: null },
      }));
    } catch (e) {
      setChildrenById((prev) => ({
        ...prev,
        [termId]: { page: null, loading: false, loadingMore: false, error: formatErrorMessage(e) },
      }));
    }
  }

  async function reloadChildren(termId: string) {
    // 小技巧：把 page 清掉後再 ensureChildrenLoaded，就能「強制重新抓 children」
    setChildrenById((prev) => ({ ...prev, [termId]: { page: null, loading: false, loadingMore: false, error: null } }));
    await ensureChildrenLoaded(termId);
  }

  async function loadMoreChildren(termId: string) {
    const current = childrenById[termId] ?? null;
    if (!current?.page?.next_cursor) return;

    setChildrenById((prev) => ({
      ...prev,
      [termId]: { ...(prev[termId] ?? { page: null, loading: false, loadingMore: false, error: null }), loadingMore: true },
    }));

    try {
      const next = await listThesaurusChildren(params.orgId, termId, { status, limit: 200, cursor: current.page.next_cursor });
      setChildrenById((prev) => ({
        ...prev,
        [termId]: {
          page: { items: [...(current.page?.items ?? []), ...next.items], next_cursor: next.next_cursor },
          loading: false,
          loadingMore: false,
          error: null,
        },
      }));
    } catch (e) {
      setChildrenById((prev) => ({
        ...prev,
        [termId]: { ...(prev[termId] ?? { page: null, loading: false, loadingMore: false, error: null }), loadingMore: false, error: formatErrorMessage(e) },
      }));
    }
  }

  function toggleExpand(termId: string, hasChildren: boolean) {
    if (!hasChildren) return;
    setExpanded((prev) => {
      const next = !prev[termId];
      if (next) void ensureChildrenLoaded(termId);
      return { ...prev, [termId]: next };
    });
  }

  useEffect(() => {
    if (!sessionReady || !session) return;
    void refreshRoots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, session, vocabularyCode, status, query, limitValue]);

  // ----------------------------
  // 3) 右側：Inspector（選取 term 的詳情 + 編輯）
  // ----------------------------

  const [detail, setDetail] = useState<AuthorityTermDetail | null>(null);
  const [ancestors, setAncestors] = useState<ThesaurusAncestorsResult | null>(null);
  const [loadingInspector, setLoadingInspector] = useState(false);

  async function refreshInspector(termId: string) {
    setLoadingInspector(true);
    setError(null);
    setSuccess(null);
    try {
      const [d, a] = await Promise.all([
        getAuthorityTerm(params.orgId, termId),
        getThesaurusAncestors(params.orgId, termId, { depth: 10, max_paths: 8 }),
      ]);
      setDetail(d);
      setAncestors(a);
    } catch (e) {
      setDetail(null);
      setAncestors(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingInspector(false);
    }
  }

  useEffect(() => {
    if (!selectedTermId) {
      setDetail(null);
      setAncestors(null);
      return;
    }
    if (!sessionReady || !session) return;
    void refreshInspector(selectedTermId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTermId, sessionReady, session]);

  const selectedTerm = detail?.term ?? null;

  // merge（預覽內嵌）：以「目前 inspector 的 term」當作 source，target 由搜尋或拖拉指定
  const [mergeTargetQuery, setMergeTargetQuery] = useState('');
  const [suggestingMergeTarget, setSuggestingMergeTarget] = useState(false);
  const [mergeTargetSuggestions, setMergeTargetSuggestions] = useState<AuthorityTerm[] | null>(null);
  const [mergeTarget, setMergeTarget] = useState<TermDragInfo | null>(null);

  const [mergeDeactivateSourceTerm, setMergeDeactivateSourceTerm] = useState(true);
  const [mergeVariantLabels, setMergeVariantLabels] = useState(true);
  const [mergeMoveRelations, setMergeMoveRelations] = useState(true);
  const [mergeNote, setMergeNote] = useState('');

  const [mergePreview, setMergePreview] = useState<MergeAuthorityTermPreviewResult | null>(null);
  const [previewingMerge, setPreviewingMerge] = useState(false);
  const [applyingMerge, setApplyingMerge] = useState(false);

  // 小技巧：selectedTermId 變更時，我們預設會把 merge target 清掉避免誤操作；
  // 但「拖拉 merge」會同時設定 selectedTermId（source）與 mergeTarget（target），
  // 因此用 ref 允許「跳過一次 reset」。
  const skipMergeResetOnSelectRef = useRef(false);

  // 如果 source（selectedTermId）或 target/options 變了，就把 preview 清掉，避免「預覽內容跟目前選項不一致」。
  useEffect(() => {
    setMergePreview(null);
  }, [selectedTermId, mergeTarget?.id, mergeDeactivateSourceTerm, mergeVariantLabels, mergeMoveRelations, mergeNote]);

  // UX：避免「我切換到別的 term，但 merge target 還留著」造成誤操作。
  useEffect(() => {
    if (skipMergeResetOnSelectRef.current) {
      skipMergeResetOnSelectRef.current = false;
      return;
    }
    setMergeTarget(null);
    setMergeTargetSuggestions(null);
    setMergeTargetQuery('');
  }, [selectedTermId]);

  // ----------------------------
  // 4) Graph（局部視覺化；點節點可切換）
  // ----------------------------

  const [graphDirection, setGraphDirection] = useState<'narrower' | 'broader'>('narrower');
  const [graphDepth, setGraphDepth] = useState('2');
  const [graphMaxNodes, setGraphMaxNodes] = useState('60');
  const [graphMaxEdges, setGraphMaxEdges] = useState('120');

  const graphDepthValue = useMemo(() => {
    const n = Number.parseInt(graphDepth.trim(), 10);
    if (!Number.isFinite(n) || n < 0) return 2;
    return Math.min(n, 5);
  }, [graphDepth]);
  const graphMaxNodesValue = useMemo(() => {
    const n = Number.parseInt(graphMaxNodes.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) return 60;
    return Math.min(n, 300);
  }, [graphMaxNodes]);
  const graphMaxEdgesValue = useMemo(() => {
    const n = Number.parseInt(graphMaxEdges.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) return 120;
    return Math.min(n, 800);
  }, [graphMaxEdges]);

  const [graph, setGraph] = useState<ThesaurusGraphResult | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);

  async function refreshGraph(termId: string) {
    setLoadingGraph(true);
    setError(null);
    setSuccess(null);
    try {
      const g = await getThesaurusGraph(params.orgId, termId, {
        direction: graphDirection,
        depth: graphDepthValue,
        max_nodes: graphMaxNodesValue,
        max_edges: graphMaxEdgesValue,
      });
      setGraph(g);
    } catch (e) {
      setGraph(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingGraph(false);
    }
  }

  // selectedTermId 切換時：自動 refresh 一次（避免右側空白）
  useEffect(() => {
    if (!selectedTermId) return;
    if (!sessionReady || !session) return;
    void refreshGraph(selectedTermId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTermId, sessionReady, session]);

  // ----------------------------
  // 5) 快速編輯：新增子詞（create + link）
  // ----------------------------

  const [newChildPreferredLabel, setNewChildPreferredLabel] = useState('');
  const [newChildVariantLabels, setNewChildVariantLabels] = useState('');
  const [newChildNote, setNewChildNote] = useState('');
  const [creatingChild, setCreatingChild] = useState(false);

  async function onCreateChild(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTermId) return;

    const preferred = newChildPreferredLabel.trim();
    if (!preferred) {
      setError('子詞 preferred_label 不可為空');
      return;
    }

    const vocab = vocabularyCode.trim();
    if (!vocab) {
      setError('vocabulary_code 不可為空');
      return;
    }

    setCreatingChild(true);
    setError(null);
    setSuccess(null);
    try {
      // 1) 建 term（主檔）
      const created = await createAuthorityTerm(params.orgId, {
        kind,
        preferred_label: preferred,
        vocabulary_code: vocab,
        ...(parseLines(newChildVariantLabels) ? { variant_labels: parseLines(newChildVariantLabels) } : {}),
        ...(newChildNote.trim() ? { note: newChildNote.trim() } : {}),
        source: 'local',
        status: 'active',
      });

      // 2) link：把 created 掛到「目前選取 term」底下（narrower）
      await addAuthorityTermRelation(params.orgId, selectedTermId, { kind: 'narrower', target_term_id: created.id });

      // 3) UI 同步：確保 parent 展開並重新抓 children
      setExpanded((prev) => ({ ...prev, [selectedTermId]: true }));
      await reloadChildren(selectedTermId);

      setNewChildPreferredLabel('');
      setNewChildVariantLabels('');
      setNewChildNote('');

      setSuccess('已建立子詞並連結到樹上');

      // UX：直接跳到新建 term（方便你立刻補 variants/relations/usage）
      setSelectedTermId(created.id);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setCreatingChild(false);
    }
  }

  // ----------------------------
  // 6) 快速編輯：連結既有 term（新增關係）
  // ----------------------------

  const [linkKind, setLinkKind] = useState<ThesaurusRelationKind>('narrower');
  const [linkQuery, setLinkQuery] = useState('');
  const [suggestingLink, setSuggestingLink] = useState(false);
  const [linkSuggestions, setLinkSuggestions] = useState<AuthorityTerm[] | null>(null);
  const [selectedLinkTarget, setSelectedLinkTarget] = useState<AuthorityTerm | null>(null);
  const [linking, setLinking] = useState(false);

  async function onSuggestLinkTargets() {
    if (!linkQuery.trim()) return;

    setSuggestingLink(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await suggestAuthorityTerms(params.orgId, {
        kind,
        q: linkQuery.trim(),
        // 預設同 vocab；必要時仍可用 status=all 的樹去看到跨 vocab 的結果（但先保守）
        ...(vocabularyCode.trim() ? { vocabulary_code: vocabularyCode.trim() } : {}),
        limit: 20,
      });
      setLinkSuggestions(results);
    } catch (e) {
      setLinkSuggestions(null);
      setError(formatErrorMessage(e));
    } finally {
      setSuggestingLink(false);
    }
  }

  async function onApplyLink() {
    if (!selectedTermId) return;
    if (!selectedLinkTarget) {
      setError('請先選擇要連結的 target term');
      return;
    }

    setLinking(true);
    setError(null);
    setSuccess(null);
    try {
      await addAuthorityTermRelation(params.orgId, selectedTermId, { kind: linkKind, target_term_id: selectedLinkTarget.id });

      // 連結成功後：
      // - refresh inspector（BT/NT/RT 立刻更新）
      // - 若是 narrow/broader 會影響樹結構，保守做法是 refresh roots
      await refreshInspector(selectedTermId);
      await refreshGraph(selectedTermId);
      await refreshRoots();

      // 若新增的是 NT：也更新目前節點 children（讓樹上立刻看得到）
      if (linkKind === 'narrower') {
        setExpanded((prev) => ({ ...prev, [selectedTermId]: true }));
        await reloadChildren(selectedTermId);
      }

      setSuccess('已新增關係');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLinking(false);
    }
  }

  // ----------------------------
  // 7) 快速編輯：刪除關係（BT/NT/RT）
  // ----------------------------

  const [deletingRelationId, setDeletingRelationId] = useState<string | null>(null);

  async function onDeleteRelation(relationId: string) {
    if (!selectedTermId) return;

    setDeletingRelationId(relationId);
    setError(null);
    setSuccess(null);
    try {
      await deleteAuthorityTermRelation(params.orgId, selectedTermId, relationId);
      await refreshInspector(selectedTermId);
      await refreshGraph(selectedTermId);
      await refreshRoots();
      setSuccess('已刪除關係');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setDeletingRelationId(null);
    }
  }

  // ----------------------------
  // 8) 快速跳轉：搜尋 term（不必先從 roots 展開找）
  // ----------------------------

  const [jumpQuery, setJumpQuery] = useState('');
  const [jumping, setJumping] = useState(false);
  const [jumpSuggestions, setJumpSuggestions] = useState<AuthorityTermSummary[] | null>(null);

  async function onJumpSuggest() {
    const q = jumpQuery.trim();
    if (!q) return;

    setJumping(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await suggestAuthorityTerms(params.orgId, {
        kind,
        q,
        ...(vocabularyCode.trim() ? { vocabulary_code: vocabularyCode.trim() } : {}),
        limit: 20,
      });
      setJumpSuggestions(results);
    } catch (e) {
      setJumpSuggestions(null);
      setError(formatErrorMessage(e));
    } finally {
      setJumping(false);
    }
  }

  // ----------------------------
  // Render helpers
  // ----------------------------

  function beginReparent(child: TermDragInfo, parent: TermDragInfo | null) {
    // beginReparent：只建立「預覽狀態」，不直接寫 DB（避免拖拉一下就不可逆）
    // - child：被拖拉的 term（我們要移動的節點）
    // - parent：drop 的目標 term；null 代表 drop 在 ROOT（移除所有 BT）
    setPendingReparent({ child, parent, keep_other_broaders: false });

    // UX：re-parent 預覽最需要看「child 的現有 BT」，因此把 inspector 切到 child。
    setSelectedTermId(child.id);

    // 若你剛好正在做 merge preview，這裡保守清掉，避免兩個「危險操作」同時存在。
    setMergePreview(null);
  }

  function beginMerge(source: TermDragInfo, target: TermDragInfo) {
    // merge：把 source 併入 target（治理操作）
    // - 我們把 source 設成 inspector 的 selectedTerm（因為 preview/apply 需要 sourceTermId）
    // - target 則放進 mergeTarget state
    if (source.id === target.id) {
      setError('不能把 term merge 到自己');
      return;
    }
    // 若 source 跟目前 selectedTerm 不同：先切換 inspector，再保留 mergeTarget。
    if (selectedTermId !== source.id) {
      skipMergeResetOnSelectRef.current = true;
      setSelectedTermId(source.id);
    }
    setMergeTarget(target);
    setSuccess('已選擇 merge 目標；請在右側按「預覽 merge」確認。');

    // 若你剛好正在 re-parent 預覽，也先清掉，避免混淆。
    setPendingReparent(null);
  }

  async function safeAddBroaderRelation(childId: string, parentId: string) {
    // safeAddBroaderRelation：addRelation 如果遇到 409（已存在）視為成功
    try {
      await addAuthorityTermRelation(params.orgId, childId, { kind: 'broader', target_term_id: parentId });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return;
      throw e;
    }
  }

  async function safeDeleteRelation(termId: string, relationId: string) {
    // safeDeleteRelation：deleteRelation 如果遇到 404（已被別人刪掉/重複操作）可忽略
    try {
      await deleteAuthorityTermRelation(params.orgId, termId, relationId);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return;
      throw e;
    }
  }

  async function onApplyReparent() {
    if (!pendingReparent) return;
    if (!sessionReady || !session) {
      setError('需要 staff 登入才能修改 thesaurus');
      return;
    }

    const childId = pendingReparent.child.id;
    const parentId = pendingReparent.parent?.id ?? null;

    setApplyingReparent(true);
    setError(null);
    setSuccess(null);

    // 我們需要知道「哪些 parent 受到影響」，才能（在必要時）reload children：
    // - 舊 parent：child 會從它們底下被移走（若是 replace）
    // - 新 parent：child 會被掛上去（若 parentId != null）
    //
    // 注意：polyhierarchy 時 child 可能有多個 BT；因此這裡取全部。
    let oldBroaderParentIds: string[] = [];
    try {
      const before = await getAuthorityTerm(params.orgId, childId);
      oldBroaderParentIds = (before.relations.broader ?? []).map((x) => x.term.id);

      if (parentId) {
        // 1) 先「確保」新 BT 存在（先 add 再 delete，避免 add 失敗就先刪導致 orphan）
        await safeAddBroaderRelation(childId, parentId);
      }

      if (parentId === null) {
        // 2a) drop 到 ROOT：移除所有 BT（讓它變成 root）
        const current = await getAuthorityTerm(params.orgId, childId);
        for (const rel of current.relations.broader ?? []) {
          await safeDeleteRelation(childId, rel.relation_id);
        }
      } else if (!pendingReparent.keep_other_broaders) {
        // 2b) replace：刪掉「不是新 parent」的所有 BT
        const current = await getAuthorityTerm(params.orgId, childId);
        const toDelete = (current.relations.broader ?? []).filter((x) => x.term.id !== parentId).map((x) => x.relation_id);
        for (const relationId of toDelete) {
          await safeDeleteRelation(childId, relationId);
        }
      }

      // 3) UI 同步（保守做法：刷新 roots + inspector + graph）
      setPendingReparent(null);
      setSuccess('已套用 re-parent');

      setSelectedTermId(childId);
      await Promise.all([refreshInspector(childId), refreshGraph(childId), refreshRoots()]);

      // 4) 若相關 parent 已展開，reload 它們的 children（讓樹上立刻反映移動）
      const affectedParentIds = new Set<string>([...oldBroaderParentIds, ...(parentId ? [parentId] : [])]);
      for (const pid of affectedParentIds) {
        // 只對「已經載入過 children」或「目前展開」的節點做 reload，避免無謂 API call。
        if (expanded[pid] || childrenById[pid]?.page) {
          await reloadChildren(pid);
        }
      }

      // UX：若有新 parent，確保它展開（方便你馬上看到 child 在新位置）
      if (parentId) {
        setExpanded((prev) => ({ ...prev, [parentId]: true }));
        await reloadChildren(parentId);
      }
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setApplyingReparent(false);
    }
  }

  async function onSuggestMergeTargets() {
    const q = mergeTargetQuery.trim();
    if (!q) return;

    setSuggestingMergeTarget(true);
    setError(null);
    setSuccess(null);
    try {
      // merge 的安全預設：只在同 vocab 找（避免跨 vocab 造成關係搬移被跳過）
      const vocab = String(selectedTerm?.vocabulary_code ?? vocabularyCode).trim();
      const results = await suggestAuthorityTerms(params.orgId, {
        kind: 'subject',
        q,
        ...(vocab ? { vocabulary_code: vocab } : {}),
        limit: 20,
      });
      setMergeTargetSuggestions(results);
    } catch (e) {
      setMergeTargetSuggestions(null);
      setError(formatErrorMessage(e));
    } finally {
      setSuggestingMergeTarget(false);
    }
  }

  async function onPreviewMerge() {
    if (!sessionReady || !session) {
      setError('需要 staff 登入才能 merge term');
      return;
    }
    if (!selectedTermId || !selectedTerm) return;
    if (!mergeTarget) {
      setError('請先選擇 merge target');
      return;
    }
    if (mergeTarget.id === selectedTermId) {
      setError('不能把 term merge 到自己');
      return;
    }

    setPreviewingMerge(true);
    setError(null);
    setSuccess(null);
    try {
      const preview = await previewMergeAuthorityTerm(params.orgId, selectedTermId, {
        actor_user_id: session.user.id,
        target_term_id: mergeTarget.id,
        deactivate_source_term: mergeDeactivateSourceTerm,
        merge_variant_labels: mergeVariantLabels,
        move_relations: mergeMoveRelations,
        ...(mergeNote.trim() ? { note: mergeNote.trim() } : {}),
      });
      setMergePreview(preview);
      setSuccess('已產生 merge 預覽；確認後可套用。');
    } catch (e) {
      setMergePreview(null);
      setError(formatErrorMessage(e));
    } finally {
      setPreviewingMerge(false);
    }
  }

  async function onApplyMerge() {
    if (!sessionReady || !session) {
      setError('需要 staff 登入才能 merge term');
      return;
    }
    if (!selectedTermId || !selectedTerm) return;
    if (!mergeTarget) return;
    if (!mergePreview) {
      setError('請先按「預覽 merge」確認影響範圍');
      return;
    }

    setApplyingMerge(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await applyMergeAuthorityTerm(params.orgId, selectedTermId, {
        actor_user_id: session.user.id,
        target_term_id: mergeTarget.id,
        deactivate_source_term: mergeDeactivateSourceTerm,
        merge_variant_labels: mergeVariantLabels,
        move_relations: mergeMoveRelations,
        ...(mergeNote.trim() ? { note: mergeNote.trim() } : {}),
      });

      // merge 後，最佳 UX 是直接跳到 target（因為 source 可能被停用/redirect）
      setSuccess(`已套用 merge（audit_event_id=${result.audit_event_id}）`);
      setMergePreview(null);
      setMergeTarget(null);
      setSelectedTermId(mergeTarget.id);

      await Promise.all([refreshRoots(), refreshInspector(mergeTarget.id), refreshGraph(mergeTarget.id)]);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setApplyingMerge(false);
    }
  }

  function renderNode(term: ThesaurusNodeSummary, level: number) {
    const isSelected = selectedTermId === term.id;
    return (
      <ThesaurusTreeNode
        orgId={params.orgId}
        term={term}
        level={level}
        isSelected={isSelected}
        expanded={!!expanded[term.id]}
        childrenState={childrenById[term.id] ?? null}
        onSelect={() => setSelectedTermId(term.id)}
        onToggle={() => toggleExpand(term.id, term.has_children)}
        onLoadMore={() => void loadMoreChildren(term.id)}
        renderNode={renderNode}
        dragMode={dragMode}
        onBeginReparent={(child, parent) => beginReparent(child, parent)}
        onBeginMerge={(source, target) => beginMerge(source, target)}
      />
    );
  }

  // ----------------------------
  // Login gate
  // ----------------------------

  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Thesaurus Visual Editor</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Thesaurus Visual Editor</h1>
          <p className="muted">
            這頁需要 staff 登入。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  // ----------------------------
  // Main UI
  // ----------------------------

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Thesaurus Visual Editor（樹 + 詳情 + Graph）</h1>
        <p className="muted">
          這頁讓你用「視覺化」治理主題詞：左側是樹狀瀏覽，右側可直接新增/連結/刪除 BT/NT/RT，並用 graph 理解 polyhierarchy。
        </p>

        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}/authority`}>Authority Control（主控入口）</Link>
          <Link
            href={`/orgs/${params.orgId}/authority-terms/thesaurus?kind=${encodeURIComponent(
              kind,
            )}&vocabulary_code=${encodeURIComponent(vocabularyCode.trim() || 'builtin-zh')}`}
          >
            回 Thesaurus Browser
          </Link>
          <Link
            href={`/orgs/${params.orgId}/authority-terms/thesaurus/quality?kind=${encodeURIComponent(
              kind,
            )}&vocabulary_code=${encodeURIComponent(vocabularyCode.trim() || 'builtin-zh')}`}
          >
            Thesaurus Quality
          </Link>
          <Link href={`/orgs/${params.orgId}/authority-terms`}>Authority Terms</Link>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Filters</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <label>
            kind（controlled vocab）
            <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="subject">subject（MARC 650）</option>
              <option value="geographic">geographic（MARC 651）</option>
              <option value="genre">genre（MARC 655）</option>
            </select>
          </label>
          <label>
            vocabulary_code（必填）
            <input value={vocabularyCode} onChange={(e) => setVocabularyCode(e.target.value)} placeholder="builtin-zh / local" />
          </label>
          <label>
            status
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="active">active（只看啟用）</option>
              <option value="inactive">inactive（只看停用）</option>
              <option value="all">all（全部）</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <label>
            roots query（只過濾 roots；模糊搜尋 label + variants）
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例如：盤點 / 汰舊 / 魔法" />
          </label>
          <label>
            roots limit（1..500）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => void refreshRoots()} disabled={loadingRoots}>
            {loadingRoots ? '載入中…' : '重新整理 roots'}
          </button>

          <div style={{ flex: 1 }} />

          <label style={{ minWidth: 320 }}>
            快速跳轉（搜尋 term）
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={jumpQuery} onChange={(e) => setJumpQuery(e.target.value)} placeholder="輸入關鍵字…" />
              <button type="button" onClick={() => void onJumpSuggest()} disabled={jumping || !jumpQuery.trim()}>
                {jumping ? '搜尋中…' : '搜尋'}
              </button>
            </div>
          </label>
        </div>

        {jumpSuggestions ? (
          jumpSuggestions.length === 0 ? (
            <div className="muted" style={{ marginTop: 10 }}>
              找不到結果。
            </div>
          ) : (
            <div className="callout" style={{ marginTop: 10 }}>
              <div className="muted">搜尋結果（點選切換右側 inspector）：</div>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {jumpSuggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTermId(t.id);
                      setJumpSuggestions(null);
                    }}
                    style={{ textAlign: 'left' }}
                  >
                    {t.preferred_label}{' '}
                    <span className="muted">
                      （{t.vocabulary_code} / {t.status}）
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : null}
      </section>

      {/* 主體：左樹右詳情 */}
      <section className="panel">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
          {/* LEFT：tree */}
          <div>
            <h2 style={{ marginTop: 0 }}>Tree</h2>
            <p className="muted">點節點選取；按 ▸ 展開 children（lazy-load）。也支援拖拉式 re-parent / merge（下方切換模式）。</p>

            <div className="callout" style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label>
                  Drag mode
                  <select value={dragMode} onChange={(e) => setDragMode(e.target.value as DragMode)}>
                    <option value="reparent">re-parent（移動/改 BT）</option>
                    <option value="merge">merge（併入/redirect）</option>
                  </select>
                </label>
                <div className="muted" style={{ flex: 1 }}>
                  {dragMode === 'reparent'
                    ? '拖「子詞」到「新上位詞」上 → 右側預覽後套用；也可拖到 ROOT 區移除 BT。'
                    : '拖「來源詞」到「目標詞」上 → 右側按「預覽 merge」確認後套用。'}
                </div>
              </div>
            </div>

            {/* ROOT drop zone：只在 re-parent 模式顯示 */}
            {dragMode === 'reparent' ? (
              <RootDropZone
                onDropTerm={(dragged) => beginReparent(dragged, null)}
              />
            ) : null}

            {loadingRoots ? <div className="muted">載入中…</div> : null}
            {!loadingRoots && roots && roots.items.length === 0 ? <div className="muted">（沒有 roots）</div> : null}

            {roots && roots.items.length > 0 ? (
              <div className="stack" style={{ gap: 8 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {roots.items.map((t) => (
                    <li key={t.id} style={{ marginBottom: 8 }}>
                      {renderNode(t, 0)}
                    </li>
                  ))}
                </ul>

                {roots.next_cursor ? (
                  <button type="button" onClick={() => void loadMoreRoots()} disabled={loadingMoreRoots || loadingRoots}>
                    {loadingMoreRoots ? '載入中…' : '載入更多 roots'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* RIGHT：inspector */}
          <div>
            <h2 style={{ marginTop: 0 }}>Inspector</h2>

            {!selectedTermId ? <div className="muted">請先在左側選一個 term。</div> : null}
            {loadingInspector ? <div className="muted">載入中…</div> : null}

            {selectedTerm ? (
              <div className="stack">
                <div className="callout">
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {selectedTerm.preferred_label}{' '}
                      <span className="muted" style={{ fontWeight: 400 }}>
                        ({selectedTerm.vocabulary_code} / {selectedTerm.status})
                      </span>
                    </div>
                    <div className="muted" style={{ wordBreak: 'break-all' }}>
                      id：<code>{selectedTerm.id}</code>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <Link href={`/orgs/${params.orgId}/authority-terms/${selectedTerm.id}`}>開啟完整治理頁</Link>
                    </div>
                  </div>
                </div>

                {/* breadcrumbs（ancestors） */}
                <div className="callout">
                  <div style={{ fontWeight: 700 }}>Breadcrumbs（ancestors）</div>
                  {ancestors ? (
                    ancestors.paths.length === 0 ? (
                      <div className="muted" style={{ marginTop: 8 }}>
                        （沒有 BT；可能是 root）
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                        {ancestors.paths.map((p, i) => (
                          <div key={i} className="muted" style={{ lineHeight: 1.6 }}>
                            {p.nodes.map((n, idx) => (
                              <span key={n.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTermId(n.id)}
                                  className="btnLink"
                                >
                                  {n.preferred_label}
                                </button>
                                {idx < p.nodes.length - 1 ? <span> → </span> : null}
                              </span>
                            ))}
                            {!p.is_complete ? <span> …</span> : null}
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="muted" style={{ marginTop: 8 }}>
                      尚未載入。
                    </div>
                  )}
                </div>

                {/* 拖拉 re-parent：預覽內嵌（需要確認後才套用） */}
                {pendingReparent ? (
                  <div className="callout">
                    <div style={{ fontWeight: 700 }}>Drag re-parent（預覽）</div>

                    {/* 如果目前 inspector 不是 child，就提供一個「跳回 child」的引導 */}
                    {selectedTermId !== pendingReparent.child.id ? (
                      <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                        <div className="muted">
                          有 pending re-parent：<strong>{pendingReparent.child.preferred_label}</strong>
                          {' → '}
                          <strong>{pendingReparent.parent ? pendingReparent.parent.preferred_label : 'ROOT（移除 BT）'}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setSelectedTermId(pendingReparent.child.id)}>
                            切換到 child（看 BT 預覽）
                          </button>
                          <button type="button" onClick={() => setPendingReparent(null)}>
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, display: 'grid', gap: 10 }}>
                        <div className="muted" style={{ lineHeight: 1.6 }}>
                          child：<strong>{pendingReparent.child.preferred_label}</strong>
                          <br />
                          new parent：<strong>{pendingReparent.parent ? pendingReparent.parent.preferred_label : 'ROOT（移除 BT）'}</strong>
                        </div>

                        <div>
                          <div className="muted">目前 BT：</div>
                          <div style={{ marginTop: 6 }}>
                            {(detail?.relations.broader ?? []).length === 0 ? (
                              <div className="muted">（無；可能已是 root）</div>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {(detail?.relations.broader ?? []).map((x) => (
                                  <li key={x.relation_id}>
                                    {x.term.preferred_label}{' '}
                                    <span className="muted">（{x.term.vocabulary_code}）</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {pendingReparent.parent ? (
                          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={pendingReparent.keep_other_broaders}
                              onChange={(e) =>
                                setPendingReparent((prev) => (prev ? { ...prev, keep_other_broaders: e.target.checked } : prev))
                              }
                              disabled={applyingReparent}
                            />
                            <span className="muted">保留其他 BT（形成多重上位 / polyhierarchy）</span>
                          </label>
                        ) : (
                          <div className="muted">拖到 ROOT 代表「移除所有 BT」；此選項不適用。</div>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => void onApplyReparent()} disabled={applyingReparent}>
                            {applyingReparent ? '套用中…' : '套用 re-parent'}
                          </button>
                          <button type="button" onClick={() => setPendingReparent(null)} disabled={applyingReparent}>
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* merge/redirect：預覽內嵌（治理 workflow） */}
                <div className="callout">
                  <div style={{ fontWeight: 700 }}>Merge / Redirect（預覽內嵌）</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    將「目前選取 term」併入另一個 term：先 preview 看影響範圍（bibs/variants/relations），再 apply。
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                    <label>
                      target term（搜尋或用 drag/drop）
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={mergeTargetQuery} onChange={(e) => setMergeTargetQuery(e.target.value)} placeholder="輸入關鍵字…" />
                        <button type="button" onClick={() => void onSuggestMergeTargets()} disabled={suggestingMergeTarget || !mergeTargetQuery.trim()}>
                          {suggestingMergeTarget ? '查詢中…' : '查詢'}
                        </button>
                      </div>
                    </label>

                    {mergeTargetSuggestions ? (
                      mergeTargetSuggestions.length === 0 ? (
                        <div className="muted">找不到結果。</div>
                      ) : (
                        <div className="callout">
                          <div className="muted">點選一筆作為 target：</div>
                          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                            {mergeTargetSuggestions.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setMergeTarget(toTermDragInfo(t))}
                                style={{
                                  textAlign: 'left',
                                  borderColor: mergeTarget?.id === t.id ? 'rgba(123,177,255,0.7)' : undefined,
                                }}
                              >
                                {t.preferred_label}{' '}
                                <span className="muted">
                                  （{t.vocabulary_code} / {t.status}）
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    ) : null}

                    {mergeTarget ? (
                      <div className="muted">
                        selected target：<code>{mergeTarget.id}</code> · {mergeTarget.preferred_label}
                      </div>
                    ) : null}

                    <div style={{ display: 'grid', gap: 8 }}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="checkbox" checked={mergeDeactivateSourceTerm} onChange={(e) => setMergeDeactivateSourceTerm(e.target.checked)} />
                        <span className="muted">deactivate source term（停用來源詞）</span>
                      </label>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="checkbox" checked={mergeVariantLabels} onChange={(e) => setMergeVariantLabels(e.target.checked)} />
                        <span className="muted">merge variant_labels（把來源詞/變體收進 target 的 variants）</span>
                      </label>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="checkbox" checked={mergeMoveRelations} onChange={(e) => setMergeMoveRelations(e.target.checked)} />
                        <span className="muted">move relations（搬移 BT/NT/RT；同 vocab 才會搬）</span>
                      </label>
                    </div>

                    <label>
                      note（選填；寫進 audit log）
                      <textarea value={mergeNote} onChange={(e) => setMergeNote(e.target.value)} rows={2} placeholder="例如：合併同義詞；統一用 preferred label" />
                    </label>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => void onPreviewMerge()} disabled={previewingMerge || !mergeTarget}>
                        {previewingMerge ? '預覽中…' : '預覽 merge'}
                      </button>
                      <button type="button" onClick={() => void onApplyMerge()} disabled={applyingMerge || !mergeTarget || !mergePreview}>
                        {applyingMerge ? '套用中…' : '套用 merge'}
                      </button>
                      <button type="button" onClick={() => { setMergeTarget(null); setMergePreview(null); }} disabled={previewingMerge || applyingMerge}>
                        清除
                      </button>
                    </div>

                    {mergePreview ? (
                      <div className="callout">
                        <div style={{ fontWeight: 700 }}>Preview summary</div>
                        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                          <li>bibs_affected：{mergePreview.summary.bibs_affected}</li>
                          <li>bibs_updated：{mergePreview.summary.bibs_updated}</li>
                          <li>variant_labels_added：{mergePreview.summary.variant_labels_added}</li>
                          <li>
                            relations：{mergePreview.summary.relations.moved ? 'moved' : 'not moved'} · considered={mergePreview.summary.relations.considered} · inserted={mergePreview.summary.relations.inserted} · deleted={mergePreview.summary.relations.deleted}
                          </li>
                          {mergePreview.summary.relations.skipped_due_to_vocab_mismatch ? (
                            <li className="muted">警告：有些 relations 因 vocab 不一致被跳過（請先統一 vocabulary_code 或改用手動治理）。</li>
                          ) : null}
                        </ul>
                        {mergePreview.summary.warnings.length > 0 ? (
                          <div style={{ marginTop: 8 }}>
                            <div className="muted">warnings：</div>
                            <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                              {mergePreview.summary.warnings.map((w, i) => (
                                <li key={i} className="muted">
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* relations：BT/NT/RT */}
                <div className="callout">
                  <div style={{ fontWeight: 700 }}>Relations（BT/NT/RT）</div>

                  <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
                    <RelationList
                      title="BT（broader）"
                      items={detail?.relations.broader ?? []}
                      onSelect={(id) => setSelectedTermId(id)}
                      onDelete={(relationId) => void onDeleteRelation(relationId)}
                      deletingRelationId={deletingRelationId}
                    />
                    <RelationList
                      title="NT（narrower）"
                      items={detail?.relations.narrower ?? []}
                      onSelect={(id) => setSelectedTermId(id)}
                      onDelete={(relationId) => void onDeleteRelation(relationId)}
                      deletingRelationId={deletingRelationId}
                    />
                    <RelationList
                      title="RT（related）"
                      items={detail?.relations.related ?? []}
                      onSelect={(id) => setSelectedTermId(id)}
                      onDelete={(relationId) => void onDeleteRelation(relationId)}
                      deletingRelationId={deletingRelationId}
                    />
                  </div>
                </div>

                {/* create child */}
                <div className="callout">
                  <div style={{ fontWeight: 700 }}>新增子詞（create + link as NT）</div>
                  <form onSubmit={(e) => void onCreateChild(e)} style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    <label>
                      preferred_label（必填）
                      <input
                        value={newChildPreferredLabel}
                        onChange={(e) => setNewChildPreferredLabel(e.target.value)}
                        placeholder="例如：盤點作業 / 教學用影片 / 繪本"
                        disabled={creatingChild}
                      />
                    </label>
                    <label>
                      variant_labels（選填；一行一個）
                      <textarea
                        value={newChildVariantLabels}
                        onChange={(e) => setNewChildVariantLabels(e.target.value)}
                        rows={3}
                        placeholder="例如：館藏盤點\n盤點流程"
                        disabled={creatingChild}
                      />
                    </label>
                    <label>
                      note（選填）
                      <textarea value={newChildNote} onChange={(e) => setNewChildNote(e.target.value)} rows={2} disabled={creatingChild} />
                    </label>
                    <button type="submit" disabled={creatingChild}>
                      {creatingChild ? '建立中…' : '建立並連結'}
                    </button>
                  </form>
                </div>

                {/* link existing */}
                <div className="callout">
                  <div style={{ fontWeight: 700 }}>連結既有 term（新增 BT/NT/RT）</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    kind 的語意以「目前選取 term」為視角（跟 API 一致）。
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                    <label>
                      kind
                      <select value={linkKind} onChange={(e) => setLinkKind(e.target.value as ThesaurusRelationKind)} disabled={linking}>
                        <option value="narrower">narrower（把 target 掛成我的 NT）</option>
                        <option value="broader">broader（把 target 掛成我的 BT）</option>
                        <option value="related">related（把 target 掛成我的 RT）</option>
                      </select>
                    </label>

                    <label>
                      搜尋 target（subject）
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} placeholder="輸入關鍵字…" disabled={linking} />
                        <button type="button" onClick={() => void onSuggestLinkTargets()} disabled={suggestingLink || linking || !linkQuery.trim()}>
                          {suggestingLink ? '查詢中…' : '查詢'}
                        </button>
                      </div>
                    </label>

                    {linkSuggestions ? (
                      linkSuggestions.length === 0 ? (
                        <div className="muted">找不到結果。</div>
                      ) : (
                        <div className="callout">
                          <div className="muted">點選一筆作為 target：</div>
                          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                            {linkSuggestions.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setSelectedLinkTarget(t)}
                                style={{
                                  textAlign: 'left',
                                  borderColor: selectedLinkTarget?.id === t.id ? 'rgba(123,177,255,0.7)' : undefined,
                                }}
                                disabled={linking}
                              >
                                {t.preferred_label}{' '}
                                <span className="muted">
                                  （{t.vocabulary_code} / {t.status}）
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    ) : null}

                    {selectedLinkTarget ? (
                      <div className="muted">
                        selected target：<code>{selectedLinkTarget.id}</code> · {selectedLinkTarget.preferred_label}
                      </div>
                    ) : null}

                    <button type="button" onClick={() => void onApplyLink()} disabled={linking || !selectedLinkTarget}>
                      {linking ? '連結中…' : '新增關係'}
                    </button>
                  </div>
                </div>

                {/* graph */}
                <div className="callout">
                  <div style={{ fontWeight: 700 }}>Graph（局部視覺化）</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    用 depth 限制輸出量；polyhierarchy 時線可能交錯，但可用於快速理解與點選跳轉。
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <label>
                      direction
                      <select value={graphDirection} onChange={(e) => setGraphDirection(e.target.value as any)}>
                        <option value="narrower">narrower（往 NT 展開）</option>
                        <option value="broader">broader（往 BT 展開）</option>
                      </select>
                    </label>
                    <label>
                      depth（0..5）
                      <input value={graphDepth} onChange={(e) => setGraphDepth(e.target.value)} />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <label>
                      max_nodes（1..300）
                      <input value={graphMaxNodes} onChange={(e) => setGraphMaxNodes(e.target.value)} />
                    </label>
                    <label>
                      max_edges（1..800）
                      <input value={graphMaxEdges} onChange={(e) => setGraphMaxEdges(e.target.value)} />
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    <button type="button" onClick={() => (selectedTermId ? void refreshGraph(selectedTermId) : undefined)} disabled={loadingGraph || !selectedTermId}>
                      {loadingGraph ? '載入中…' : '更新 graph'}
                    </button>
                  </div>

                  {graph ? (
                    <div style={{ marginTop: 12 }}>
                      <ThesaurusGraph
                        graph={graph}
                        rootTermId={selectedTermId!}
                        selectedTermId={selectedTermId}
                        onSelectTerm={(id) => setSelectedTermId(id)}
                      />
                    </div>
                  ) : (
                    <div className="muted" style={{ marginTop: 10 }}>
                      尚未載入 graph。
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="muted">尚未選取 term。</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function RelationList({
  title,
  items,
  onSelect,
  onDelete,
  deletingRelationId,
}: {
  title: string;
  items: Array<{ relation_id: string; term: AuthorityTermSummary }>;
  onSelect: (termId: string) => void;
  onDelete: (relationId: string) => void;
  deletingRelationId: string | null;
}) {
  return (
    <div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      {items.length === 0 ? <div className="muted" style={{ marginTop: 6 }}>（無）</div> : null}
      {items.length > 0 ? (
        <ul style={{ marginTop: 8 }}>
          {items.map((x) => (
            <li key={x.relation_id} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" onClick={() => onSelect(x.term.id)} style={{ textAlign: 'left' }}>
                  {x.term.preferred_label}{' '}
                  <span className="muted">
                    （{x.term.vocabulary_code} / {x.term.status}）
                  </span>
                </button>
                <button type="button" onClick={() => onDelete(x.relation_id)} disabled={deletingRelationId === x.relation_id}>
                  {deletingRelationId === x.relation_id ? '刪除中…' : '刪除'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ThesaurusTreeNode(props: {
  orgId: string;
  term: ThesaurusNodeSummary;
  level: number;
  isSelected: boolean;
  expanded: boolean;
  childrenState: ChildrenState | null;
  onSelect: () => void;
  onToggle: () => void;
  onLoadMore: () => void;
  renderNode: (term: ThesaurusNodeSummary, level: number) => React.ReactNode;

  // drag/drop（re-parent / merge）
  dragMode: DragMode;
  onBeginReparent: (child: TermDragInfo, parent: TermDragInfo) => void;
  onBeginMerge: (source: TermDragInfo, target: TermDragInfo) => void;
}) {
  const { term, level, isSelected, expanded, childrenState, onSelect, onToggle, onLoadMore, renderNode, dragMode, onBeginReparent, onBeginMerge } = props;

  const indent = level * 18;
  const hasChildren = term.has_children;
  const childrenPage = childrenState?.page ?? null;
  const childrenItems = childrenPage?.items ?? [];

  const [dragOver, setDragOver] = useState(false);

  function onDragStart(e: React.DragEvent) {
    // 注意：dataTransfer 在某些瀏覽器若未設定 text/plain 會失效；
    // 因此我們同時塞入自訂 MIME 與 text/plain（保守兼容）。
    const payload = serializeDragData(toTermDragInfo(term));
    e.dataTransfer.setData('application/x-library-system-term', payload);
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = dragMode === 'merge' ? 'link' : 'move';
  }

  function onDragOverRow(e: React.DragEvent) {
    // 只有 preventDefault 才能 drop（HTML5 DnD 規則）
    e.preventDefault();
    e.dataTransfer.dropEffect = dragMode === 'merge' ? 'link' : 'move';
    setDragOver(true);
  }

  function onDragLeaveRow() {
    setDragOver(false);
  }

  function onDropRow(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);

    const raw = e.dataTransfer.getData('application/x-library-system-term') || e.dataTransfer.getData('text/plain');
    const dragged = raw ? parseDragData(raw) : null;
    if (!dragged) return;
    if (dragged.id === term.id) return;

    const target = toTermDragInfo(term);
    if (dragMode === 'merge') onBeginMerge(dragged, target);
    else onBeginReparent(dragged, target);
  }

  return (
    <div style={{ marginLeft: indent }}>
      <div
        className={isSelected ? 'callout' : undefined}
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: isSelected ? 8 : 0,
          borderColor: isSelected ? 'rgba(123,177,255,0.55)' : undefined,
          outline: dragOver ? '2px dashed rgba(123,177,255,0.8)' : undefined,
          outlineOffset: 2,
        }}
        onDragOver={onDragOverRow}
        onDragLeave={onDragLeaveRow}
        onDrop={onDropRow}
      >
        <button type="button" onClick={onToggle} disabled={!hasChildren} aria-label={expanded ? 'collapse' : 'expand'}>
          {hasChildren ? (expanded ? '▾' : '▸') : '·'}
        </button>

        {/* drag handle：避免把整個 row 做 draggable（會跟點選/連結互搶） */}
        <span
          title={dragMode === 'merge' ? '拖曳：merge source → drop 到 target' : '拖曳：re-parent child → drop 到新 parent'}
          draggable
          onDragStart={onDragStart}
          style={{
            userSelect: 'none',
            cursor: 'grab',
            padding: '0 6px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
          }}
          aria-label="drag handle"
        >
          ⠿
        </span>

        <button
          type="button"
          onClick={onSelect}
          style={{
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'var(--text)',
            fontWeight: isSelected ? 800 : 600,
            textAlign: 'left',
          }}
        >
          {term.preferred_label}
        </button>

        <span className="muted">
          (BT×{term.broader_count} · NT×{term.narrower_count})
        </span>

        {term.status === 'inactive' ? <span className="muted">[inactive]</span> : null}
        {term.broader_count > 1 ? <span className="muted">[多重上位]</span> : null}

        <div style={{ flex: 1 }} />

        <Link href={`/orgs/${props.orgId}/authority-terms/${term.id}`} className="muted">
          開啟
        </Link>
      </div>

      {expanded ? (
        <div style={{ marginTop: 6 }}>
          {childrenState?.loading ? <div className="muted">children 載入中…</div> : null}
          {childrenState?.error ? <div className="error">children 錯誤：{childrenState.error}</div> : null}

          {childrenItems.length > 0 ? (
            <ul style={{ marginTop: 8, listStyle: 'none', padding: 0 }}>
              {childrenItems.map((edge) => (
                <li key={edge.relation_id} style={{ marginBottom: 8 }}>
                  {renderNode(edge.term, level + 1)}
                </li>
              ))}
            </ul>
          ) : null}

          {childrenPage?.next_cursor ? (
            <button type="button" onClick={onLoadMore} disabled={childrenState?.loadingMore}>
              {childrenState?.loadingMore ? '載入中…' : '載入更多 children'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RootDropZone(props: { onDropTerm: (term: TermDragInfo) => void }) {
  // ROOT drop zone：讓館員可以把某個 term 直接「提升成 root」（移除 BT）
  // - 這在治理時很常用：例如你發現某個詞其實不該掛在任何上位詞之下
  const [over, setOver] = useState(false);

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOver(true);
  }

  function onDragLeave() {
    setOver(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);

    const raw = e.dataTransfer.getData('application/x-library-system-term') || e.dataTransfer.getData('text/plain');
    const dragged = raw ? parseDragData(raw) : null;
    if (!dragged) return;
    props.onDropTerm(dragged);
  }

  return (
    <div
      className="callout"
      style={{
        marginTop: 10,
        borderColor: over ? 'rgba(255,120,120,0.75)' : undefined,
        outline: over ? '2px dashed rgba(255,120,120,0.75)' : undefined,
        outlineOffset: 2,
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div style={{ fontWeight: 700 }}>ROOT drop zone</div>
      <div className="muted" style={{ marginTop: 6 }}>
        把 term 拖到這裡 → 移除所有 BT（讓它成為 roots 的一員）。此操作會先在右側出現預覽，再按「套用」才會寫入。
      </div>
    </div>
  );
}
