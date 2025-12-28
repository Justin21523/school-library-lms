/**
 * Authority Term Detail（/orgs/:orgId/authority-terms/:termId）
 *
 * 這頁把 Authority/Vocabulary v0 往「thesaurus」推進：
 * - BT/NT/RT 關係維護（authority_term_relations）
 * - 提供「展開（expand）」預覽（供檢索擴充/自動補詞）
 *
 * 對應 API：
 * - GET    /api/v1/orgs/:orgId/authority-terms/:termId
 * - POST   /api/v1/orgs/:orgId/authority-terms/:termId/relations
 * - DELETE /api/v1/orgs/:orgId/authority-terms/:termId/relations/:relationId
 * - GET    /api/v1/orgs/:orgId/authority-terms/:termId/expand
 *
 * 重要取捨（v1）：
 * - 書目表單欄位仍保留 `subjects/creators/...` 的 text[]（方便顯示/交換/相容舊資料）
 * - 但真相來源已逐步轉為 term_id-driven：
 *   - 書目：`*_term_ids` + junction tables（subject/geographic/genre/name）
 *   - MARC：`$0=urn:uuid:<term_id>` linking + `$2=vocabulary_code`
 * - 因此本頁的治理（usage/merge/BT-NT）會以 term_id 與 junction tables 為主
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type {
  AuthorityTerm,
  AuthorityTermDetail,
  AuthorityTermSummary,
  AuthorityTermUsageResult,
  MergeAuthorityTermApplyResult,
  MergeAuthorityTermPreviewResult,
  ThesaurusAncestorsResult,
  ThesaurusGraphResult,
  ThesaurusRelationKind,
  ThesaurusExpandResult,
} from '../../../../lib/api';
import {
  addAuthorityTermRelation,
  applyMergeAuthorityTerm,
  deleteAuthorityTermRelation,
  expandAuthorityTerm,
  getAuthorityTerm,
  getAuthorityTermUsage,
  getThesaurusGraph,
  getThesaurusAncestors,
  previewMergeAuthorityTerm,
  suggestAuthorityTerms,
  updateAuthorityTerm,
} from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';
import { ThesaurusGraph } from '../../../../components/thesaurus/thesaurus-graph';

function parseLines(value: string) {
  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export default function AuthorityTermDetailPage({ params }: { params: { orgId: string; termId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const router = useRouter();

  const [detail, setDetail] = useState<AuthorityTermDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ancestors/breadcrumbs（polyhierarchy 可能多條）
  const [ancestors, setAncestors] = useState<ThesaurusAncestorsResult | null>(null);
  const [loadingAncestors, setLoadingAncestors] = useState(false);

  // graph（局部視覺化；讓你在治理 BT/NT 時不用只看文字列表）
  // - v1.4 起：subject/geographic/genre 都支援 BT/NT（對齊 650/651/655）
  const [graph, setGraph] = useState<ThesaurusGraphResult | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphDirection, setGraphDirection] = useState<'narrower' | 'broader'>('narrower');
  const [graphDepth, setGraphDepth] = useState('2');
  const graphDepthValue = useMemo(() => {
    const n = Number.parseInt(graphDepth.trim(), 10);
    if (!Number.isFinite(n) || n < 0) return 2;
    return Math.min(n, 5);
  }, [graphDepth]);

  // 新增關係（BT/NT/RT）
  const [relationKind, setRelationKind] = useState<ThesaurusRelationKind>('related');
  const [targetQuery, setTargetQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AuthorityTermSummary[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<AuthorityTermSummary | null>(null);
  const [adding, setAdding] = useState(false);

  // expand preview
  const [expandDepth, setExpandDepth] = useState('1');
  const [expandResult, setExpandResult] = useState<ThesaurusExpandResult | null>(null);
  const [expanding, setExpanding] = useState(false);

  // governance：usage + merge/redirect（目前先做 subject term）
  const actorUserId = session?.user.id ?? '';

  const [usage, setUsage] = useState<AuthorityTermUsageResult | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [loadingMoreUsage, setLoadingMoreUsage] = useState(false);

  const [mergeTargetQuery, setMergeTargetQuery] = useState('');
  const [mergeSuggestions, setMergeSuggestions] = useState<AuthorityTermSummary[] | null>(null);
  const [suggestingMergeTarget, setSuggestingMergeTarget] = useState(false);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<AuthorityTermSummary | null>(null);

  const [mergeDeactivateSource, setMergeDeactivateSource] = useState(true);
  const [mergeVariantLabels, setMergeVariantLabels] = useState(true);
  const [mergeMoveRelations, setMergeMoveRelations] = useState(true);
  const [mergeNote, setMergeNote] = useState('');

  const [mergePreview, setMergePreview] = useState<MergeAuthorityTermPreviewResult | null>(null);
  const [mergeApplyResult, setMergeApplyResult] = useState<MergeAuthorityTermApplyResult | null>(null);
  const [previewingMerge, setPreviewingMerge] = useState(false);
  const [applyingMerge, setApplyingMerge] = useState(false);

  const currentTerm = detail?.term ?? null;

  // ----------------------------
  // Term 基本資料編修（Authority 主檔 CRUD）
  // ----------------------------
  //
  // 你希望「前端界面可以完整修改 authority control」：
  // - 不只治理（usage/merge），也要能直接改 term 本體（preferred/variants/vocab/status/note/source）
  // - 因此在 detail 頁直接放一個可編輯表單（避免回 list page 才能改）
  const [editPreferredLabel, setEditPreferredLabel] = useState('');
  const [editVariantLabels, setEditVariantLabels] = useState('');
  const [editVocabularyCode, setEditVocabularyCode] = useState('local');
  const [editStatus, setEditStatus] = useState<AuthorityTerm['status']>('active');
  const [editNote, setEditNote] = useState('');
  const [editSource, setEditSource] = useState('');
  const [savingTerm, setSavingTerm] = useState(false);

  // detail 重新載入 / termId 切換時，把表單 reset 成目前值（避免編輯到舊 term）
  useEffect(() => {
    if (!currentTerm) return;
    setEditPreferredLabel(currentTerm.preferred_label ?? '');
    setEditVariantLabels((currentTerm.variant_labels ?? []).join('\n'));
    setEditVocabularyCode(currentTerm.vocabulary_code ?? 'local');
    setEditStatus(currentTerm.status);
    setEditNote(currentTerm.note ?? '');
    setEditSource(currentTerm.source ?? '');
  }, [currentTerm?.id]);

  // isHierarchyKind：哪些 term.kind 允許 BT/NT（thesaurus hierarchy）
  // - 對齊 MARC：650/651/655
  const isHierarchyKind =
    currentTerm?.kind === 'subject' || currentTerm?.kind === 'geographic' || currentTerm?.kind === 'genre';
  const supportsUsageAndMerge =
    currentTerm?.kind === 'subject' ||
    currentTerm?.kind === 'geographic' ||
    currentTerm?.kind === 'genre' ||
    currentTerm?.kind === 'name';
  const usageSourceTable =
    !currentTerm
      ? null
      : currentTerm.kind === 'subject'
        ? 'bibliographic_subject_terms'
        : currentTerm.kind === 'name'
          ? 'bibliographic_name_terms'
        : currentTerm.kind === 'geographic'
          ? 'bibliographic_geographic_terms'
          : currentTerm.kind === 'genre'
            ? 'bibliographic_genre_terms'
            : null;

  // term → Bibs 過濾（term_id-driven）
  // - 讓館員在治理 term 時，可以一鍵跳去 Bibs 看「有哪些書受影響」
  // - 只對 650/651/655 對應的 kinds 提供（name term 可直接看 usage 清單即可）
  const bibsFilterHref = useMemo(() => {
    if (!currentTerm) return null;
    const base = `/orgs/${params.orgId}/bibs`;
    if (currentTerm.kind === 'subject') return `${base}?subject_term_ids=${currentTerm.id}`;
    if (currentTerm.kind === 'geographic') return `${base}?geographic_term_ids=${currentTerm.id}`;
    if (currentTerm.kind === 'genre') return `${base}?genre_term_ids=${currentTerm.id}`;
    return null;
  }, [currentTerm?.id, currentTerm?.kind, params.orgId]);

  const depthValue = useMemo(() => {
    const n = Number.parseInt(expandDepth.trim(), 10);
    if (!Number.isFinite(n) || n < 0) return 1;
    return Math.min(n, 5);
  }, [expandDepth]);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await getAuthorityTerm(params.orgId, params.termId);
      setDetail(result);
    } catch (e) {
      setDetail(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onSaveTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTerm) return;

    const preferred = editPreferredLabel.trim();
    if (!preferred) {
      setError('preferred_label 不可為空');
      return;
    }

    const vocab = editVocabularyCode.trim();
    if (!vocab) {
      setError('vocabulary_code 不可為空（至少用 local）');
      return;
    }

    // 建立 PATCH payload：只送「有變更」欄位（避免無意義改動 updated_at）
    const payload: Parameters<typeof updateAuthorityTerm>[2] = {};

    if (preferred !== currentTerm.preferred_label) payload.preferred_label = preferred;
    if (vocab !== currentTerm.vocabulary_code) payload.vocabulary_code = vocab;

    const variants = parseLines(editVariantLabels) ?? null;
    const currentVariants = currentTerm.variant_labels ?? null;
    if (JSON.stringify(variants) !== JSON.stringify(currentVariants)) payload.variant_labels = variants;

    const note = editNote.trim() ? editNote.trim() : null;
    const currentNote = currentTerm.note ?? null;
    if (note !== currentNote) payload.note = note;

    const source = editSource.trim();
    if (source && source !== currentTerm.source) payload.source = source;

    if (editStatus !== currentTerm.status) payload.status = editStatus;

    if (Object.keys(payload).length === 0) {
      setError('沒有任何變更需要儲存');
      return;
    }

    setSavingTerm(true);
    setError(null);
    setSuccess(null);
    try {
      await updateAuthorityTerm(params.orgId, currentTerm.id, payload);
      setSuccess('已更新 authority term');
      await refresh();
      await refreshAncestors();
      // 注意：term 內容改了（例如 preferred_label/variant_labels）可能影響 merge/usage 操作的理解，因此也刷新 usage。
      if (supportsUsageAndMerge) await refreshUsage();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSavingTerm(false);
    }
  }

  async function refreshAncestors() {
    setLoadingAncestors(true);
    try {
      const result = await getThesaurusAncestors(params.orgId, params.termId, { depth: 10, max_paths: 8 });
      setAncestors(result);
    } catch (e) {
      setAncestors(null);
      // ancestors 是輔助資訊；錯誤不覆蓋主錯誤（避免 UI 變得難以操作）
    } finally {
      setLoadingAncestors(false);
    }
  }

  async function refreshGraph() {
    if (!isHierarchyKind) return;
    setLoadingGraph(true);
    try {
      const result = await getThesaurusGraph(params.orgId, params.termId, {
        direction: graphDirection,
        depth: graphDepthValue,
        max_nodes: 80,
        max_edges: 200,
      });
      setGraph(result);
    } catch (e) {
      setGraph(null);
      // graph 是輔助資訊；錯誤不覆蓋主錯誤（避免 UI 變得難以操作）
    } finally {
      setLoadingGraph(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !session) return;
    void refresh();
    void refreshAncestors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, params.termId, sessionReady, session]);

  // graph：需要等 currentTerm 載入後，才知道它是不是「允許 BT/NT」的 kind。
  useEffect(() => {
    if (!sessionReady || !session) return;

    // name term 預設不做 BT/NT：保守清掉 graph，避免顯示「尚未載入」造成誤解
    if (!isHierarchyKind) {
      setGraph(null);
      return;
    }

    void refreshGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, params.termId, sessionReady, session, currentTerm?.id, isHierarchyKind, graphDirection, graphDepthValue]);

  // term usage：支援的 kinds 預設就載入一次（讓館員打開 detail 就看到影響範圍）
  useEffect(() => {
    if (!sessionReady || !session) return;
    if (!currentTerm || !supportsUsageAndMerge) {
      setUsage(null);
      return;
    }
    void refreshUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, params.termId, sessionReady, session, currentTerm?.id]);

  async function refreshUsage() {
    if (!currentTerm) return;
    if (!supportsUsageAndMerge) return;

    setLoadingUsage(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await getAuthorityTermUsage(params.orgId, currentTerm.id, { limit: 200 });
      setUsage(result);
    } catch (e) {
      setUsage(null);
      setError(formatErrorMessage(e));
    } finally {
      setLoadingUsage(false);
    }
  }

  async function loadMoreUsage() {
    if (!currentTerm) return;
    if (!supportsUsageAndMerge) return;
    if (!usage?.next_cursor) return;

    setLoadingMoreUsage(true);
    setError(null);
    setSuccess(null);
    try {
      const page = await getAuthorityTermUsage(params.orgId, currentTerm.id, { limit: 200, cursor: usage.next_cursor });
      setUsage({ ...usage, items: [...usage.items, ...page.items], next_cursor: page.next_cursor });
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingMoreUsage(false);
    }
  }

  async function runSuggestMergeTarget() {
    if (!currentTerm) return;
    const q = mergeTargetQuery.trim();
    if (!q) return;

    setSuggestingMergeTarget(true);
    setError(null);
    setSuccess(null);
    setMergeSuggestions(null);
    setSelectedMergeTarget(null);
    setMergePreview(null);
    setMergeApplyResult(null);

    try {
      // merge：只限制 kind（可允許跨 vocabulary_code，把 local term 併回 builtin）
      const result = await suggestAuthorityTerms(params.orgId, { kind: currentTerm.kind, q, limit: 20 });
      const mapped: AuthorityTermSummary[] = result
        .filter((t) => t.id !== currentTerm.id)
        .map((t) => ({
          id: t.id,
          kind: t.kind,
          vocabulary_code: t.vocabulary_code,
          preferred_label: t.preferred_label,
          status: t.status,
          source: t.source,
        }));
      setMergeSuggestions(mapped);
    } catch (e) {
      setMergeSuggestions(null);
      setError(formatErrorMessage(e));
    } finally {
      setSuggestingMergeTarget(false);
    }
  }

  async function runMergePreview() {
    if (!currentTerm) return;
    if (!actorUserId) {
      setError('缺少 actor_user_id（請重新登入）');
      return;
    }
    if (!selectedMergeTarget) {
      setError('請先選擇要併入的 target term');
      return;
    }

    setPreviewingMerge(true);
    setError(null);
    setSuccess(null);
    setMergePreview(null);
    setMergeApplyResult(null);
    try {
      const result = await previewMergeAuthorityTerm(params.orgId, currentTerm.id, {
        actor_user_id: actorUserId,
        target_term_id: selectedMergeTarget.id,
        deactivate_source_term: mergeDeactivateSource,
        merge_variant_labels: mergeVariantLabels,
        move_relations: mergeMoveRelations,
        ...(mergeNote.trim() ? { note: mergeNote.trim() } : {}),
      });
      setMergePreview(result);
      setSuccess('已產生 merge preview（請確認後再 apply）');
    } catch (e) {
      setMergePreview(null);
      setError(formatErrorMessage(e));
    } finally {
      setPreviewingMerge(false);
    }
  }

  async function runMergeApply() {
    if (!currentTerm) return;
    if (!actorUserId) {
      setError('缺少 actor_user_id（請重新登入）');
      return;
    }
    if (!selectedMergeTarget) {
      setError('請先選擇要併入的 target term');
      return;
    }

    const ok = window.confirm(
      `確認要執行 merge 嗎？\n\n` +
        `source：${currentTerm.preferred_label} (${currentTerm.vocabulary_code})\n` +
        `target：${selectedMergeTarget.preferred_label} (${selectedMergeTarget.vocabulary_code})\n\n` +
        `此動作會：\n` +
        `- 批次更新 bibliographic_subject_terms\n` +
        `- 把 source 標目收進 target.variant_labels\n` +
        `- 視設定搬移 relations / 停用 source\n` +
        `- 寫入 audit_events（authority.merge_term）`,
    );
    if (!ok) return;

    setApplyingMerge(true);
    setError(null);
    setSuccess(null);
    setMergeApplyResult(null);
    try {
      const result = await applyMergeAuthorityTerm(params.orgId, currentTerm.id, {
        actor_user_id: actorUserId,
        target_term_id: selectedMergeTarget.id,
        deactivate_source_term: mergeDeactivateSource,
        merge_variant_labels: mergeVariantLabels,
        move_relations: mergeMoveRelations,
        ...(mergeNote.trim() ? { note: mergeNote.trim() } : {}),
      });
      setMergeApplyResult(result);
      setSuccess(`已套用 merge：audit_event_id=${result.audit_event_id}`);

      // apply 後刷新（source term 可能被停用、關係/usage 也可能變）
      await refresh();
      await refreshAncestors();
      await refreshUsage();
    } catch (e) {
      setMergeApplyResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setApplyingMerge(false);
    }
  }

  async function runSuggest() {
    if (!currentTerm) return;
    const q = targetQuery.trim();
    if (!q) return;

    setSuggesting(true);
    setError(null);
    setSuccess(null);
    setSuggestions(null);
    setSelectedTarget(null);
    try {
      // thesaurus 關係目前要求同 kind + 同 vocabulary_code，因此這裡直接限制 vocabulary_code（降低選錯機率）
      const result = await suggestAuthorityTerms(params.orgId, {
        kind: currentTerm.kind,
        q,
        vocabulary_code: currentTerm.vocabulary_code,
        limit: 20,
      });
      const mapped: AuthorityTermSummary[] = result.map((t) => ({
        id: t.id,
        kind: t.kind,
        vocabulary_code: t.vocabulary_code,
        preferred_label: t.preferred_label,
        status: t.status,
        source: t.source,
      }));
      setSuggestions(mapped);
    } catch (e) {
      setSuggestions(null);
      setError(formatErrorMessage(e));
    } finally {
      setSuggesting(false);
    }
  }

  async function onAddRelation() {
    if (!currentTerm) return;
    if (!selectedTarget) {
      setError('請先從建議列表選擇要連結的 target term');
      return;
    }

    // v1 限制：name 款目不支援 BT/NT
    if ((relationKind === 'broader' || relationKind === 'narrower') && currentTerm.kind !== 'subject') {
      setError('v1 目前只允許 subject term 建立 broader/narrower（BT/NT）');
      return;
    }

    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await addAuthorityTermRelation(params.orgId, currentTerm.id, {
        kind: relationKind,
        target_term_id: selectedTarget.id,
      });
      setDetail(next);
      setSuccess('已新增關係');
      setTargetQuery('');
      setSuggestions(null);
      setSelectedTarget(null);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setAdding(false);
    }
  }

  async function onDeleteRelation(relationId: string) {
    if (!currentTerm) return;
    setError(null);
    setSuccess(null);
    try {
      const next = await deleteAuthorityTermRelation(params.orgId, currentTerm.id, relationId);
      setDetail(next);
      setSuccess('已刪除關係');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  }

  async function onExpandPreview() {
    if (!currentTerm) return;
    setExpanding(true);
    setError(null);
    setSuccess(null);
    setExpandResult(null);
    try {
      const result = await expandAuthorityTerm(params.orgId, currentTerm.id, {
        include: 'self,variants,broader,narrower,related',
        depth: depthValue,
      });
      setExpandResult(result);
      setSuccess(`已展開：labels=${result.labels.length}`);
    } catch (e) {
      setExpandResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setExpanding(false);
    }
  }

  // Login gate
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Authority Term</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Authority Term</h1>
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
        <h1 style={{ marginTop: 0 }}>Authority Term（權威控制款目）</h1>

        <div className="muted" style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <div>
            orgId：<code>{params.orgId}</code>
          </div>
          <div>
            termId：<code>{params.termId}</code>
          </div>
        </div>

        {loading ? <p className="muted">載入中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            重新整理
          </button>
          <Link href={`/orgs/${params.orgId}/authority-terms`}>回到 Authority Terms</Link>
          <Link href={`/orgs/${params.orgId}`}>回到 Dashboard</Link>
        </div>
      </section>

      {currentTerm ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>款目資訊</h2>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 700 }}>
              {currentTerm.preferred_label}{' '}
              <span className="muted" style={{ fontWeight: 400 }}>
                ({currentTerm.kind} · {currentTerm.status} · {currentTerm.vocabulary_code} · {currentTerm.source})
              </span>
            </div>
            {currentTerm.variant_labels && currentTerm.variant_labels.length > 0 ? (
              <div className="muted">variant_labels（UF）：{currentTerm.variant_labels.join(' · ')}</div>
            ) : (
              <div className="muted">variant_labels（UF）：（無）</div>
            )}
            {currentTerm.note ? <div className="muted">note：{currentTerm.note}</div> : null}
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <h3 style={{ marginTop: 0 }}>編修 term</h3>
          <p className="muted">
            這裡更新的是 <code>authority_terms</code> 主檔（preferred/variants/vocab/status/note/source）。
            若你要改「書目使用的 term」，請用下方的 <strong>merge/redirect</strong>（會批次更新 junction tables）。
          </p>

          <form onSubmit={onSaveTerm} className="stack" style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                preferred_label（必填）
                <input value={editPreferredLabel} onChange={(e) => setEditPreferredLabel(e.target.value)} />
              </label>
              <label>
                vocabulary_code（必填；例：local / builtin-zh）
                <input value={editVocabularyCode} onChange={(e) => setEditVocabularyCode(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                status
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as AuthorityTerm['status'])}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <label>
                source（追溯用；例：local / seed-demo / bib-subject-backfill）
                <input value={editSource} onChange={(e) => setEditSource(e.target.value)} />
              </label>
            </div>

            <label>
              variant_labels（每行一個；同義詞/別名）
              <textarea value={editVariantLabels} onChange={(e) => setEditVariantLabels(e.target.value)} rows={3} />
            </label>

            <label>
              note（可選）
              <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} />
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="submit" disabled={savingTerm}>
                {savingTerm ? '儲存中…' : '儲存變更'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setEditPreferredLabel(currentTerm.preferred_label ?? '');
                  setEditVariantLabels((currentTerm.variant_labels ?? []).join('\n'));
                  setEditVocabularyCode(currentTerm.vocabulary_code ?? 'local');
                  setEditStatus(currentTerm.status);
                  setEditNote(currentTerm.note ?? '');
                  setEditSource(currentTerm.source ?? '');
                }}
                disabled={savingTerm}
              >
                重置
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {currentTerm ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Usage（被哪些書目使用）</h2>
          <p className="muted">
            v1.3+ 對 <code>subject/name/geographic/genre</code> term 提供 usage（資料來源：<code>{usageSourceTable ?? '—'}</code>）。
          </p>
          {bibsFilterHref ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href={bibsFilterHref}>在 Bibs 以此 term 過濾</Link>
              <span className="muted">（會自動套用 term_id filter）</span>
            </div>
          ) : null}

          {!usageSourceTable ? (
            <p className="muted">此 term.kind 暫不支援 usage（尚未落地對應 junction table）。</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" onClick={() => void refreshUsage()} disabled={loadingUsage}>
                  {loadingUsage ? '載入中…' : '重新載入 usage'}
                </button>
                {usage ? (
                  <span className="muted">
                    total_bibs={usage.total_bibs} · showing={usage.items.length} · next_cursor={usage.next_cursor ? '有' : '無'}
                  </span>
                ) : null}
              </div>

              {usage && usage.items.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>（目前沒有書目使用此 term）</p> : null}

              {usage && usage.items.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <ul>
                    {usage.items.map((b) => (
                      <li key={b.bibliographic_id} style={{ marginBottom: 8 }}>
                        <Link href={`/orgs/${params.orgId}/bibs/${b.bibliographic_id}`}>{b.title}</Link>{' '}
                        <span className="muted">
                          (isbn={b.isbn ?? '—'} · classification={b.classification ?? '—'})
                        </span>
                        {b.roles && b.roles.length > 0 ? (
                          <span className="muted" style={{ marginLeft: 8 }}>
                            roles={b.roles.join(',')}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {usage.next_cursor ? (
                    <button type="button" onClick={() => void loadMoreUsage()} disabled={loadingMoreUsage || loadingUsage}>
                      {loadingMoreUsage ? '載入中…' : '載入更多'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {currentTerm && supportsUsageAndMerge ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Merge / Redirect（治理）</h2>
          <p className="muted">
            用於把「重複/錯用/新建 local」的 term 收斂成唯一款目：
            merge 會批次更新 <code>{usageSourceTable}</code>，並可把舊詞收進 target 的 <code>variant_labels</code>。
          </p>

          <div className="callout warn">
            <div className="muted">
              這是不可逆的批次資料異動。建議先按 <strong>Preview</strong> 看影響範圍與 warnings，再決定是否 Apply。
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label>
              搜尋 target term（只限制同 kind；可跨 vocabulary_code）
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={mergeTargetQuery}
                  onChange={(e) => setMergeTargetQuery(e.target.value)}
                  placeholder="輸入關鍵字…"
                />
                <button type="button" onClick={() => void runSuggestMergeTarget()} disabled={suggestingMergeTarget}>
                  {suggestingMergeTarget ? '搜尋中…' : '搜尋'}
                </button>
              </div>
            </label>

            {mergeSuggestions && mergeSuggestions.length > 0 ? (
              <div>
                <div className="muted">點選一筆作為 merge target：</div>
                <ul style={{ marginTop: 8 }}>
                  {mergeSuggestions.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      <button type="button" onClick={() => setSelectedMergeTarget(s)} style={{ textAlign: 'left' }}>
                        {s.preferred_label}{' '}
                        <span className="muted">
                          ({s.status} · {s.vocabulary_code} · {s.source})
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {mergeSuggestions && mergeSuggestions.length === 0 ? <p className="muted">沒有建議結果。</p> : null}

            {selectedMergeTarget ? (
              <div className="muted">
                已選 target：<strong>{selectedMergeTarget.preferred_label}</strong>（<code>{selectedMergeTarget.id}</code> ·{' '}
                {selectedMergeTarget.vocabulary_code}）
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={mergeDeactivateSource}
                  onChange={(e) => setMergeDeactivateSource(e.target.checked)}
                />
                deactivate_source_term（停用 source term；保留 row 追溯）
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={mergeVariantLabels}
                  onChange={(e) => setMergeVariantLabels(e.target.checked)}
                />
                merge_variant_labels（把 source 用詞收進 target.variant_labels）
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={mergeMoveRelations}
                  onChange={(e) => setMergeMoveRelations(e.target.checked)}
                />
                move_relations（搬移 BT/RT；僅 source/target 同 vocabulary_code 時可搬）
              </label>
            </div>

            <label>
              note（選填；寫入 audit metadata）
              <input value={mergeNote} onChange={(e) => setMergeNote(e.target.value)} placeholder="例：合併同義詞 / 清理 backfill local term" />
            </label>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void runMergePreview()} disabled={previewingMerge}>
                {previewingMerge ? '預覽中…' : 'Preview'}
              </button>
              <button type="button" onClick={() => void runMergeApply()} disabled={applyingMerge}>
                {applyingMerge ? '套用中…' : 'Apply'}
              </button>
            </div>

            {mergePreview ? (
              <div className="callout">
                <div className="muted">
                  bibs_affected={mergePreview.summary.bibs_affected} · variant_labels_added={mergePreview.summary.variant_labels_added} · relations_inserted={mergePreview.summary.relations.inserted}
                </div>
                {mergePreview.summary.warnings.length > 0 ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    warnings：{mergePreview.summary.warnings.join(' · ')}
                  </div>
                ) : null}
                <details style={{ marginTop: 8 }}>
                  <summary className="muted">檢視 merge preview JSON</summary>
                  <pre style={{ overflowX: 'auto', marginTop: 8 }}>{JSON.stringify(mergePreview, null, 2)}</pre>
                </details>
              </div>
            ) : null}

            {mergeApplyResult ? (
              <div className="callout">
                <div className="muted">
                  已套用：audit_event_id=<code>{mergeApplyResult.audit_event_id}</code>
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary className="muted">檢視 merge apply JSON</summary>
                  <pre style={{ overflowX: 'auto', marginTop: 8 }}>{JSON.stringify(mergeApplyResult, null, 2)}</pre>
                </details>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {ancestors ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Breadcrumbs（Ancestors）</h2>
          <p className="muted">
            polyhierarchy 可能會有多條路徑；這裡最多顯示 <code>{ancestors.max_paths}</code> 條（depth={ancestors.depth}）。
            {ancestors.truncated ? <span>（已截斷）</span> : null}
          </p>

          {loadingAncestors ? <p className="muted">載入中…</p> : null}

          {ancestors.paths.length === 0 ? <p className="muted">（無 ancestors；可能是 root term 或 depth=0）</p> : null}

          {ancestors.paths.length > 0 ? (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {ancestors.paths.map((p, i) => (
                <div key={i} className="muted">
                  {p.is_complete ? null : <span>[partial]</span>}{' '}
                  {p.nodes.map((n, idx) => (
                    <span key={n.id}>
                      <Link href={`/orgs/${params.orgId}/authority-terms/${n.id}`}>{n.preferred_label}</Link>
                      {idx < p.nodes.length - 1 ? ' / ' : null}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Breadcrumbs（Ancestors）</h2>
          <p className="muted">（尚未載入）</p>
          <button type="button" onClick={() => void refreshAncestors()} disabled={loadingAncestors}>
            {loadingAncestors ? '載入中…' : '重新載入 Breadcrumbs'}
          </button>
        </section>
      )}

      {isHierarchyKind ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Graph（局部視覺化）</h2>
          <p className="muted">
            這裡用 <code>thesaurus/graph</code>（depth-limited）呈現 BT/NT 關係；點節點可快速跳到該 term。
            若你想要更完整的「樹 + 右側詳情」操作，請用{' '}
            <Link href={`/orgs/${params.orgId}/authority-terms/thesaurus/visual`}>Thesaurus Visual Editor</Link>。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <label>
              direction
              <select value={graphDirection} onChange={(e) => setGraphDirection(e.target.value as any)} disabled={loadingGraph}>
                <option value="narrower">narrower（往 NT 展開）</option>
                <option value="broader">broader（往 BT 展開）</option>
              </select>
            </label>
            <label>
              depth（0..5）
              <input value={graphDepth} onChange={(e) => setGraphDepth(e.target.value)} disabled={loadingGraph} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" onClick={() => void refreshGraph()} disabled={loadingGraph}>
              {loadingGraph ? '載入中…' : '更新 graph'}
            </button>
          </div>

          {graph ? (
            <div style={{ marginTop: 12 }}>
                  <ThesaurusGraph
                    graph={graph}
                    rootTermId={params.termId}
                    selectedTermId={params.termId}
                    onSelectTerm={(id) => {
                      // 這頁是 termId route，因此用 router.push 來同步 URL（避免 full reload）
                      router.push(`/orgs/${params.orgId}/authority-terms/${id}`);
                    }}
                  />
                </div>
              ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              （尚未載入 graph）
            </p>
          )}
        </section>
      ) : null}

      {detail ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>關係（BT/NT/RT）</h2>

          <div style={{ display: 'grid', gap: 12 }}>
            <RelationList title="BT（broader terms）" items={detail.relations.broader} onDelete={onDeleteRelation} orgId={params.orgId} />
            <RelationList title="NT（narrower terms）" items={detail.relations.narrower} onDelete={onDeleteRelation} orgId={params.orgId} />
            <RelationList title="RT（related terms）" items={detail.relations.related} onDelete={onDeleteRelation} orgId={params.orgId} />
          </div>
        </section>
      ) : null}

      {currentTerm ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>新增關係</h2>
          <p className="muted">
            v1.4 規則：關係必須同 <code>kind</code> + 同 <code>vocabulary_code</code>；BT/NT 支援 <code>subject/geographic/genre</code>。
          </p>

          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label>
              relation kind
              <select value={relationKind} onChange={(e) => setRelationKind(e.target.value as ThesaurusRelationKind)}>
                <option value="related">related（RT）</option>
                <option value="broader" disabled={!isHierarchyKind}>
                  broader（BT）
                </option>
                <option value="narrower" disabled={!isHierarchyKind}>
                  narrower（NT）
                </option>
              </select>
            </label>

            <label>
              搜尋 target term（會限制同 vocabulary_code：{currentTerm.vocabulary_code}）
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={targetQuery} onChange={(e) => setTargetQuery(e.target.value)} placeholder="輸入關鍵字…" />
                <button type="button" onClick={() => void runSuggest()} disabled={suggesting}>
                  {suggesting ? '搜尋中…' : '搜尋'}
                </button>
              </div>
            </label>

            {suggestions && suggestions.length > 0 ? (
              <div>
                <div className="muted">點選一筆作為 target：</div>
                <ul style={{ marginTop: 8 }}>
                  {suggestions.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTarget(s)}
                        style={{ textAlign: 'left' }}
                      >
                        {s.preferred_label}{' '}
                        <span className="muted">
                          ({s.status} · {s.vocabulary_code} · {s.source})
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {suggestions && suggestions.length === 0 ? <p className="muted">沒有建議結果。</p> : null}

            {selectedTarget ? (
              <div className="muted">
                已選 target：<strong>{selectedTarget.preferred_label}</strong>（<code>{selectedTarget.id}</code>）
              </div>
            ) : null}

            <button type="button" onClick={() => void onAddRelation()} disabled={adding}>
              {adding ? '新增中…' : '新增關係'}
            </button>
          </div>
        </section>
      ) : null}

      {currentTerm ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>展開（expand）預覽</h2>
          <p className="muted">
            這是給「檢索擴充」用的 API 預覽：<code>GET /authority-terms/:termId/expand</code>
          </p>

          <label style={{ marginTop: 8 }}>
            depth（0..5）
            <input value={expandDepth} onChange={(e) => setExpandDepth(e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
            <button type="button" onClick={() => void onExpandPreview()} disabled={expanding}>
              {expanding ? '展開中…' : '執行 expand'}
            </button>
            {expandResult ? <span className="muted">labels：{expandResult.labels.length}</span> : null}
          </div>

          {expandResult ? (
            <details style={{ marginTop: 12 }} open>
              <summary>expand result（JSON）</summary>
              <pre style={{ overflowX: 'auto', marginTop: 8 }}>{JSON.stringify(expandResult, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function RelationList(props: {
  title: string;
  items: Array<{ relation_id: string; term: AuthorityTermSummary }>;
  onDelete: (relationId: string) => void;
  orgId: string;
}) {
  const { title, items, onDelete, orgId } = props;
  return (
    <div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      {items.length === 0 ? <div className="muted">（無）</div> : null}
      {items.length > 0 ? (
        <ul style={{ marginTop: 8 }}>
          {items.map((x) => (
            <li key={x.relation_id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>
                  <Link href={`/orgs/${orgId}/authority-terms/${x.term.id}`}>{x.term.preferred_label}</Link>{' '}
                  <span className="muted">
                    ({x.term.status} · {x.term.vocabulary_code} · {x.term.source})
                  </span>
                </span>
                <button type="button" onClick={() => onDelete(x.relation_id)}>
                  刪除
                </button>
              </div>
              <div className="muted" style={{ wordBreak: 'break-all' }}>
                term_id：<code>{x.term.id}</code> · relation_id：<code>{x.relation_id}</code>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
