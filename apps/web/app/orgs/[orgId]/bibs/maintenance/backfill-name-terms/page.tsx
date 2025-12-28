/**
 * Bibs Name Backfill（/orgs/:orgId/bibs/maintenance/backfill-name-terms）
 *
 * 你在「第 4 步」要求的 name linking（creators/contributors term-based），需要一個 backfill 工具把既有資料轉成：
 * - bibliographic_records.creators/contributors（text[]）
 * → bibliographic_name_terms（role=creator|contributor + position）
 *
 * 目標：
 * - match preferred_label / variant_labels
 * - missing/ambiguous → 建/補 local term（讓 link table 填滿；之後再用 merge/redirect 治理收斂）
 * - 回寫 creators/contributors 正規化（preferred_label；避免拼法差異）
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/bibs/maintenance/backfill-name-terms（mode=preview|apply）
 *
 * 重要提示（preview）：
 * - 後端 preview 會在 transaction 內「實跑寫入」再 ROLLBACK
 * - 因此 preview 期間 auto-created term 的 UUID 只是「預覽用」，apply 時會重新產生（不要拿 preview 的 id 當成治理依據）
 */

'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type { BackfillBibNameTermsApplyResult, BackfillBibNameTermsPreviewResult } from '../../../../../lib/api';
import { applyBackfillBibNameTerms, previewBackfillBibNameTerms } from '../../../../../lib/api';
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

export default function BackfillBibNameTermsPage({ params }: { params: { orgId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // Input（limit/cursor/options）
  // ----------------------------

  const [limit, setLimit] = useState('200');
  const [cursor, setCursor] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [vocabularyCodeForNew, setVocabularyCodeForNew] = useState('local');
  const [sourceForNew, setSourceForNew] = useState('bib-name-backfill');
  const [preferVocabularyCodesText, setPreferVocabularyCodesText] = useState('local');
  const [note, setNote] = useState('');

  // ----------------------------
  // Result（preview/apply）
  // ----------------------------

  const [preview, setPreview] = useState<BackfillBibNameTermsPreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<BackfillBibNameTermsApplyResult | null>(null);

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
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Bibs Name Backfill</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Bibs Name Backfill</h1>
          <p className="error">
            這頁需要 staff 登入才能操作。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
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
      const result = await previewBackfillBibNameTerms(params.orgId, input);
      setPreview(result);
      setSuccess(`已產生 preview：scanned=${result.summary.scanned} · would_update=${result.summary.would_update}`);
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
    setPreview(null);
    try {
      const input = buildInput();
      const ok = window.confirm(
        `確認要執行 name backfill 嗎？\n\n` +
          `limit：${input.limit ?? 200}\n` +
          `only_missing：${String(input.only_missing ?? true)}\n` +
          `cursor：${input.cursor ?? '(start)'}\n` +
          `vocabulary_code_for_new：${input.vocabulary_code_for_new ?? 'local'}\n` +
          `source_for_new：${input.source_for_new ?? 'bib-name-backfill'}\n\n` +
          `此動作會：\n` +
          `- 建/補 local name terms（必要時）\n` +
          `- 寫入 bibliographic_name_terms（creator/contributor term_id linking）\n` +
          `- 正規化 bibliographic_records.creators/contributors（改成 preferred_label）\n` +
          `- 寫入 audit_events（catalog.backfill_name_terms）`,
      );
      if (!ok) return;

      const result = await applyBackfillBibNameTerms(params.orgId, input);
      setApplyResult(result);
      setSuccess(
        `已套用：audit_event_id=${result.audit_event_id} · scanned=${result.summary.scanned} · would_update=${result.summary.would_update} · skipped_invalid=${result.summary.skipped_invalid}`,
      );

      // UX：apply 後，cursor 可直接接續下一批
      if (result.next_cursor) setCursor(result.next_cursor);
    } catch (e) {
      setApplyResult(null);
      setError(formatErrorMessage(e));
    } finally {
      setApplying(false);
    }
  }

  const result = (applyResult ?? preview) as BackfillBibNameTermsApplyResult | BackfillBibNameTermsPreviewResult | null;

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Bibs Name Backfill</h1>
        <p className="muted">
          這頁用於把既有 <code>creators/contributors(text[])</code> 回填成 <code>creator_term_ids</code> /{' '}
          <code>contributor_term_ids</code>（term_id-driven）。完成後，書目編目 UI 才能完全 term-based，且人名治理（usage/merge）
          也能以 junction table 為準。
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/orgs/${params.orgId}/bibs`}>← 回 Bibs</Link>
          <Link href={`/orgs/${params.orgId}/authority-terms`}>Authority / Vocabulary</Link>
          <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <p className="muted">
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} / {session.user.role}）
        </p>

        <div className="callout warn" style={{ marginTop: 12 }}>
          <div className="muted">
            <strong>preview 提醒：</strong>preview 會在 transaction 內實跑寫入再 ROLLBACK，因此 auto-created term 的 <code>id</code>{' '}
            只是「預覽用」，apply 時會重新產生；治理（merge/redirect）請以 apply 後的 term id 為準。
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label>
            limit（一次最多掃/處理幾筆；1..500）
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>

          <label>
            cursor（選填；接續下一批；留空代表從最新開始）
            <input value={cursor} onChange={(e) => setCursor(e.target.value)} placeholder="（可貼上 API 回傳的 next_cursor）" />
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            only_missing（只處理 link table 目前為空的書目；migration 建議保持勾選）
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              vocabulary_code_for_new（自動建立 local term 用）
              <input value={vocabularyCodeForNew} onChange={(e) => setVocabularyCodeForNew(e.target.value)} />
            </label>
            <label>
              source_for_new（追溯用；寫入 authority_terms.source）
              <input value={sourceForNew} onChange={(e) => setSourceForNew(e.target.value)} />
            </label>
          </div>

          <label>
            prefer_vocabulary_codes（選填；用於消歧；可用換行或逗號）
            <textarea
              value={preferVocabularyCodesText}
              onChange={(e) => setPreferVocabularyCodesText(e.target.value)}
              rows={3}
              placeholder="例：local"
            />
          </label>

          <label>
            note（選填；寫入 audit metadata）
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：第一次 migration / 手動補跑某批" />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" onClick={() => void runPreview()} disabled={previewing}>
            {previewing ? '預覽中…' : '預覽（Preview）'}
          </button>
          <button type="button" onClick={() => void runApply()} disabled={applying}>
            {applying ? '套用中…' : '套用（Apply）'}
          </button>
          <button
            type="button"
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
        </div>

        {error ? (
          <p className="error" style={{ marginTop: 12 }}>
            錯誤：{error}
          </p>
        ) : null}
        {success ? (
          <p className="success" style={{ marginTop: 12 }}>
            {success}
          </p>
        ) : null}
      </section>

      {result ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>結果</h2>

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

          <div className="callout" style={{ marginTop: 12 }}>
            <div className="muted">
              scanned={result.summary.scanned} · would_update={result.summary.would_update} · skipped_invalid={result.summary.skipped_invalid} · no_names=
              {result.summary.no_names}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              labels：matched_preferred={result.summary.labels.matched_preferred} · matched_variant={result.summary.labels.matched_variant} · auto_created=
              {result.summary.labels.auto_created} · ambiguous_auto_created={result.summary.labels.ambiguous_auto_created} · unmatched={result.summary.labels.unmatched} · skipped_blank=
              {result.summary.labels.skipped_blank}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  `name-backfill-${params.orgId}-${result.mode}.json`,
                  JSON.stringify(result, null, 2),
                  'application/json;charset=utf-8',
                )
              }
            >
              下載 JSON 報表
            </button>
            {result.next_cursor ? (
              <button type="button" onClick={() => setCursor(result.next_cursor ?? '')}>
                將 next_cursor 填入輸入框
              </button>
            ) : null}
          </div>

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
                    creators before：{r.creators_before.filter(Boolean).length > 0 ? r.creators_before.filter(Boolean).join(' · ') : '(none)'}
                  </div>
                  <div className="muted">
                    creators after：{r.creators_after && r.creators_after.length > 0 ? r.creators_after.join(' · ') : '(unchanged)'}
                  </div>

                  <div className="muted">
                    contributors before：{r.contributors_before.filter(Boolean).length > 0 ? r.contributors_before.filter(Boolean).join(' · ') : '(none)'}
                  </div>
                  <div className="muted">
                    contributors after：{r.contributors_after && r.contributors_after.length > 0 ? r.contributors_after.join(' · ') : '(unchanged)'}
                  </div>

                  <details>
                    <summary className="muted">檢視 creator decisions（label-level）</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, marginTop: 8 }}>{JSON.stringify(r.creator_decisions, null, 2)}</pre>
                  </details>

                  <details>
                    <summary className="muted">檢視 contributor decisions（label-level）</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, marginTop: 8 }}>{JSON.stringify(r.contributor_decisions, null, 2)}</pre>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

