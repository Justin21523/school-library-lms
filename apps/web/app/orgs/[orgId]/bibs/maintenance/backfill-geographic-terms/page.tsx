/**
 * Bibs Geographic Backfill（/orgs/:orgId/bibs/maintenance/backfill-geographic-terms）
 *
 * 你要求的「既有資料 backfill 工具（按 org 批次）」v1.3 延伸：
 * - 把 bibliographic_records.geographics（MARC 651；text[]）回填成 term_id-driven（junction table）
 * - 來源（優先順序）：
 *   1) bibliographic_records.geographics
 *   2) bibliographic_records.marc_extras 的 651$a（匯入時保留的欄位）
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/bibs/maintenance/backfill-geographic-terms（mode=preview|apply）
 *
 * 重要提示（preview）：
 * - 後端 preview 會用 transaction 實跑「寫入」再 ROLLBACK
 * - 因此 preview 期間 auto-created term 的 UUID 只是「預覽用」，apply 時會重新產生（不要拿 preview 的 id 當成治理依據）
 */

'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type { BackfillBibGeographicTermsApplyResult, BackfillBibGeographicTermsPreviewResult } from '../../../../../lib/api';
import { applyBackfillBibGeographicTerms, previewBackfillBibGeographicTerms } from '../../../../../lib/api';
import { Alert } from '../../../../../components/ui/alert';
import { EmptyState } from '../../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../../components/ui/page-header';
import { SkeletonText } from '../../../../../components/ui/skeleton';
import { formatErrorMessage } from '../../../../../lib/error';
import { useStaffSession } from '../../../../../lib/use-staff-session';

function parseVocabularyList(value: string) {
  // allow:
  // - newline separated
  // - comma separated
  const raw = value
    .split(/\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return raw.length > 0 ? raw : undefined;
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

export default function BackfillBibGeographicTermsPage({ params }: { params: { orgId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // Input（limit/cursor/options）
  // ----------------------------

  const [limit, setLimit] = useState('200');
  const [cursor, setCursor] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [vocabularyCodeForNew, setVocabularyCodeForNew] = useState('local');
  const [sourceForNew, setSourceForNew] = useState('bib-geographic-backfill');
  const [preferVocabularyCodesText, setPreferVocabularyCodesText] = useState('builtin-zh\nlocal');
  const [note, setNote] = useState('');

  // ----------------------------
  // Result（preview/apply）
  // ----------------------------

  const [preview, setPreview] = useState<BackfillBibGeographicTermsPreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<BackfillBibGeographicTermsApplyResult | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const limitNumber = useMemo(() => {
    const n = Number.parseInt(limit.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) return 200;
    return Math.min(n, 500);
  }, [limit]);

  // Login gate
  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Bibs Geographic Backfill" description="載入登入狀態中…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader title="Bibs Geographic Backfill" description="這頁需要 staff 登入才能操作。">
          <Alert variant="danger" title="需要登入">
            請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  function buildInput() {
    if (!actorUserId) throw new Error('缺少 actor_user_id（請重新登入）');

    const prefer = parseVocabularyList(preferVocabularyCodesText);
    return {
      actor_user_id: actorUserId,
      limit: limitNumber,
      ...(cursor.trim() ? { cursor: cursor.trim() } : {}),
      only_missing: onlyMissing,
      ...(vocabularyCodeForNew.trim() ? { vocabulary_code_for_new: vocabularyCodeForNew.trim() } : {}),
      ...(sourceForNew.trim() ? { source_for_new: sourceForNew.trim() } : {}),
      ...(prefer ? { prefer_vocabulary_codes: prefer } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
  }

  async function runPreview() {
    setPreviewing(true);
    setError(null);
    setSuccess(null);
    setApplyResult(null);
    try {
      const input = buildInput();
      const result = await previewBackfillBibGeographicTerms(params.orgId, input);
      setPreview(result);
      setSuccess(
        `預覽完成：scanned=${result.summary.scanned} · would_update=${result.summary.would_update} · skipped_invalid=${result.summary.skipped_invalid} · no_geographics=${result.summary.no_geographics}`,
      );
    } catch (e) {
      setPreview(null);
      setError(formatErrorMessage(e));
    } finally {
      setPreviewing(false);
    }
  }

  async function runApply() {
    setApplying(true);
    setError(null);
    setSuccess(null);
    try {
      const input = buildInput();
      const ok = window.confirm(
        `確認要執行 geographics（651）backfill 嗎？\n\n` +
          `limit：${input.limit ?? 200}\n` +
          `only_missing：${String(input.only_missing ?? true)}\n` +
          `cursor：${input.cursor ?? '(start)'}\n` +
          `vocabulary_code_for_new：${input.vocabulary_code_for_new ?? 'local'}\n` +
          `source_for_new：${input.source_for_new ?? 'bib-geographic-backfill'}\n\n` +
          `此動作會：\n` +
          `- 建/補 local geographic terms（必要時）\n` +
          `- 寫入 bibliographic_geographic_terms（term_id linking）\n` +
          `- 正規化 bibliographic_records.geographics（改成 preferred_label）\n` +
          `- 寫入 audit_events（catalog.backfill_geographic_terms）`,
      );
      if (!ok) return;

      const result = await applyBackfillBibGeographicTerms(params.orgId, input);
      setApplyResult(result);
      setSuccess(
        `已套用：audit_event_id=${result.audit_event_id} · scanned=${result.summary.scanned} · would_update=${result.summary.would_update} · skipped_invalid=${result.summary.skipped_invalid}`,
      );

      // UX：apply 後，cursor 可直接接續下一批
      if (result.next_cursor) setCursor(result.next_cursor);

      // apply 後 preview 可能過期；清掉避免誤判
      setPreview(null);
    } catch (e) {
      setApplyResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setApplying(false);
    }
  }

  const result = (applyResult ?? preview) as BackfillBibGeographicTermsApplyResult | BackfillBibGeographicTermsPreviewResult | null;

  return (
    <div className="stack">
      <PageHeader
        title="Bibs Geographic Backfill（651）"
        description={
          <>
            把既有 <code>geographics(text[])</code>（MARC 651）回填成 <code>geographic_term_ids</code>（term_id-driven）。完成後，書目編目與檢索才可以完全以 term 為準。
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs`}>
              Bibs
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/authority`}>
              Authority 主控
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/audit-events`}>
              Audit
            </Link>
          </>
        }
      >
        <div className="muted" style={{ display: 'grid', gap: 4 }}>
          <div>
            actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} / {session.user.role}）
          </div>
        </div>

        <Alert variant="warning" title="preview 提醒">
          preview 會在 transaction 內實跑寫入再 ROLLBACK，因此 auto-created term 的 <code>id</code> 只是「預覽用」，apply 時會重新產生；治理（merge/redirect）請以 apply 後的 term id 為準。
        </Alert>

        {previewing || applying ? <Alert variant="info" title={previewing ? '預覽中…' : '套用中…'} role="status" /> : null}
        {previewing && !preview ? <SkeletonText lines={3} /> : null}

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="參數" description="建議先 preview，再逐批 apply；可用 next_cursor 接續下一批。" />
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="參數" description="建議先 preview，再逐批 apply；可用 next_cursor 接續下一批。">
            <div className="grid2">
              <Field label="limit（一次最多掃/處理幾筆；1..500）" htmlFor="geo_limit">
                <input id="geo_limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </Field>

              <Field label="cursor（選填；接續下一批）" htmlFor="geo_cursor" hint="留空代表從最新開始；可貼上 API 回傳的 next_cursor。">
                <input
                  id="geo_cursor"
                  value={cursor}
                  onChange={(e) => setCursor(e.target.value)}
                  placeholder="（可貼上 API 回傳的 next_cursor）"
                />
              </Field>
            </div>

            <Field label="only_missing" htmlFor="geo_only_missing" hint="只處理 link table 目前為空的書目；migration 建議保持勾選。">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  id="geo_only_missing"
                  type="checkbox"
                  checked={onlyMissing}
                  onChange={(e) => setOnlyMissing(e.target.checked)}
                />
                <span className="muted">only_missing</span>
              </div>
            </Field>

            <div className="grid2">
              <Field label="vocabulary_code_for_new（自動建立 local term 用）" htmlFor="geo_vocabulary_code_for_new">
                <input
                  id="geo_vocabulary_code_for_new"
                  value={vocabularyCodeForNew}
                  onChange={(e) => setVocabularyCodeForNew(e.target.value)}
                />
              </Field>
              <Field label="source_for_new（追溯用；寫入 authority_terms.source）" htmlFor="geo_source_for_new">
                <input id="geo_source_for_new" value={sourceForNew} onChange={(e) => setSourceForNew(e.target.value)} />
              </Field>
            </div>

            <Field
              label="prefer_vocabulary_codes（選填；用於消歧）"
              htmlFor="geo_prefer_vocabulary_codes"
              hint="可用換行或逗號分隔（例：builtin-zh,local）。"
            >
              <textarea
                id="geo_prefer_vocabulary_codes"
                value={preferVocabularyCodesText}
                onChange={(e) => setPreferVocabularyCodesText(e.target.value)}
                rows={3}
                placeholder="例：builtin-zh\nlocal"
              />
            </Field>

            <Field label="note（選填；寫入 audit metadata）" htmlFor="geo_note" hint="例：第一次 migration / 手動補跑某批">
              <input
                id="geo_note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例：第一次 migration / 手動補跑某批"
              />
            </Field>

            <FormActions>
              <button type="button" className="btnPrimary" onClick={() => void runPreview()} disabled={previewing || applying}>
                {previewing ? '預覽中…' : '預覽（Preview）'}
              </button>
              <button type="button" className="btnDanger" onClick={() => void runApply()} disabled={applying || previewing}>
                {applying ? '套用中…' : '套用（Apply）'}
              </button>
              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  setPreview(null);
                  setApplyResult(null);
                  setError(null);
                  setSuccess(null);
                }}
                disabled={previewing || applying}
              >
                清除結果
              </button>
            </FormActions>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="結果" description="Preview：實跑寫入再 rollback；Apply：寫入 junction table 並更新 bib 正規化字串。" />

        {!result ? (
          <EmptyState title="尚無結果" description="先在上方設定參數後執行 Preview 或 Apply。" />
        ) : (
          <>
            <div className="muted" style={{ display: 'grid', gap: 4 }}>
              <div>
                mode：<code>{result.mode}</code>
              </div>
              {'audit_event_id' in result ? (
                <div>
                  audit_event_id：<code>{result.audit_event_id}</code>
                </div>
              ) : null}
              <div>
                next_cursor：<code>{result.next_cursor ?? '(none)'}</code>
              </div>
            </div>

            <Alert variant="info" title="摘要" role="status">
              <div>
                scanned=<code>{result.summary.scanned}</code> · would_update=<code>{result.summary.would_update}</code> · skipped_invalid=
                <code>{result.summary.skipped_invalid}</code> · no_geographics=<code>{result.summary.no_geographics}</code>
              </div>
              <div style={{ marginTop: 6 }}>
                labels：matched_preferred=<code>{result.summary.labels.matched_preferred}</code> · matched_variant=
                <code>{result.summary.labels.matched_variant}</code> · auto_created=<code>{result.summary.labels.auto_created}</code> ·
                ambiguous_auto_created=<code>{result.summary.labels.ambiguous_auto_created}</code> · unmatched=
                <code>{result.summary.labels.unmatched}</code> · skipped_blank=<code>{result.summary.labels.skipped_blank}</code>
              </div>
            </Alert>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              <button
                type="button"
                className="btnSmall"
                onClick={() =>
                  downloadText(
                    `geographic-backfill-${params.orgId}-${result.mode}.json`,
                    JSON.stringify(result, null, 2),
                    'application/json;charset=utf-8',
                  )
                }
              >
                下載 JSON 報表
              </button>
              {result.next_cursor ? (
                <button type="button" className="btnSmall" onClick={() => setCursor(result.next_cursor ?? '')}>
                  將 next_cursor 填入輸入框
                </button>
              ) : null}
            </div>

            {result.rows.length === 0 ? (
              <EmptyState title="本批次沒有列出任何書目" description="可能沒有候選、或都被 skipped/無 geographics。" />
            ) : (
              <div className="stack" style={{ marginTop: 12 }}>
                {result.rows.map((r) => (
                  <div key={r.bibliographic_id} className="callout">
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{r.title}</div>
                        <span className="muted">
                          bibId=<code>{r.bibliographic_id}</code>
                        </span>
                        <span className="muted">
                          status=<code>{r.status}</code>
                        </span>
                        <Link href={`/orgs/${params.orgId}/bibs/${r.bibliographic_id}`}>開啟書目</Link>
                      </div>

                      <div className="muted">
                        before：
                        {r.geographics_before.filter(Boolean).length > 0
                          ? r.geographics_before.filter(Boolean).join(' · ')
                          : '(none)'}
                      </div>
                      <div className="muted">
                        after：{r.geographics_after && r.geographics_after.length > 0 ? r.geographics_after.join(' · ') : '(unchanged)'}
                      </div>

                      <details>
                        <summary className="muted">檢視 decisions（label-level 報表）</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', margin: 0, marginTop: 8 }}>
                          {JSON.stringify(r.decisions, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
