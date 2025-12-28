/**
 * MARC Import Page（/orgs/:orgId/bibs/import-marc）
 *
 * 目的：
 * - 讓館員把外部系統/館藏資料的 MARC 交換檔匯入成「本系統可治理」的書目表單欄位
 * - 同時把未對映欄位保留到 `marc_extras`（避免資料丟失）
 *
 * 支援格式（v1）：
 * - ISO2709 `.mrc`
 * - MARCXML（MARC21 slim）
 * - MARC-in-JSON（含本專案 JSON-friendly MarcRecord）
 *
 * v1 追加（你列出的缺口）：
 * - 批次匯入/更新：preview/apply
 * - 去重：ISBN（020）/ 035
 * - 逐筆選擇：create/update/skip
 * - 回傳 warnings/errors 報表（預覽可審查；apply 若仍有 errors 會拒絕寫入）
 *
 * 權限：
 * - 匯入會建立書目並寫入 marc_extras，因此需要 staff 登入（Bearer token）
 */

'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type { MarcField, MarcImportDecision, MarcImportPreviewResult, MarcRecord } from '../../../../lib/api';
import { MarcFieldsEditor } from '../../../../components/marc/marc-fields-editor';
import { importMarcBatch } from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';
import { deriveBibFromMarcRecord, parseIso2709Records, parseMarcJsonRecords, parseMarcXmlRecords } from '../../../../lib/marc-import';

type Draft = {
  title: string;
  creators: string;
  contributors: string;
  subjects: string;
  geographics: string;
  genres: string;
  publisher: string;
  publishedYear: string;
  language: string;
  isbn: string;
  classification: string;
  marcExtras: MarcField[];
};

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('讀取檔案失敗'));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0));
    reader.onerror = () => reject(new Error('讀取檔案失敗'));
    reader.readAsArrayBuffer(file);
  });
}

function parseLines(value: string) {
  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function toDraft(record: MarcRecord): Draft {
  const derived = deriveBibFromMarcRecord(record);
  return {
    title: derived.bib.title ?? '',
    creators: (derived.bib.creators ?? []).join('\n'),
    contributors: (derived.bib.contributors ?? []).join('\n'),
    subjects: (derived.bib.subjects ?? []).join('\n'),
    geographics: (derived.bib.geographics ?? []).join('\n'),
    genres: (derived.bib.genres ?? []).join('\n'),
    publisher: derived.bib.publisher ?? '',
    publishedYear: derived.bib.published_year ? String(derived.bib.published_year) : '',
    language: derived.bib.language ?? '',
    isbn: derived.bib.isbn ?? '',
    classification: derived.bib.classification ?? '',
    marcExtras: derived.marc_extras ?? [],
  };
}

function updateDraftAt(
  drafts: Draft[],
  index: number,
  patch: Partial<Draft>,
) {
  return drafts.map((d, i) => (i === index ? { ...d, ...patch } : d));
}

function buildBibPayload(d: Draft) {
  const title = d.title.trim();
  if (!title) throw new Error('title 不可為空（請先在表單中修正）');

  const creatorsList = parseLines(d.creators);
  const contributorsList = parseLines(d.contributors);
  const subjectsList = parseLines(d.subjects);
  const geographicsList = parseLines(d.geographics);
  const genresList = parseLines(d.genres);

  const yearText = d.publishedYear.trim();
  const year = yearText ? Number.parseInt(yearText, 10) : undefined;
  if (yearText && !Number.isFinite(year)) throw new Error('published_year 必須是整數');

  const bib: any = { title };
  if (creatorsList) bib.creators = creatorsList;
  if (contributorsList) bib.contributors = contributorsList;
  if (subjectsList) bib.subjects = subjectsList;
  if (geographicsList) bib.geographics = geographicsList;
  if (genresList) bib.genres = genresList;

  if (d.publisher.trim()) bib.publisher = d.publisher.trim();
  if (year !== undefined) bib.published_year = year;
  if (d.language.trim()) bib.language = d.language.trim();
  if (d.isbn.trim()) bib.isbn = d.isbn.trim();
  if (d.classification.trim()) bib.classification = d.classification.trim();

  return bib as {
    title: string;
    creators?: string[];
    contributors?: string[];
    publisher?: string;
    published_year?: number;
    language?: string;
    subjects?: string[];
    geographics?: string[];
    genres?: string[];
    isbn?: string;
    classification?: string;
  };
}

export default function MarcImportPage({ params }: { params: { orgId: string } }) {
  const { ready: sessionReady, session } = useStaffSession(params.orgId);

  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [records, setRecords] = useState<MarcRecord[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const selectedDraft = useMemo(() => (drafts ? drafts[selectedIndex] ?? null : null), [drafts, selectedIndex]);

  // 解析/preview/apply 狀態
  const [parsing, setParsing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 匯入選項
  const [saveMarcExtras, setSaveMarcExtras] = useState(true);
  const [upsertAuthorityTerms, setUpsertAuthorityTerms] = useState(true);
  const [authorityVocabularyCode, setAuthorityVocabularyCode] = useState('local');
  const [sourceNote, setSourceNote] = useState('');

  // preview/apply 結果
  const [preview, setPreview] = useState<MarcImportPreviewResult | null>(null);
  const [decisionsByIndex, setDecisionsByIndex] = useState<Record<number, MarcImportDecision>>({});
  const [applyAuditEventId, setApplyAuditEventId] = useState<string | null>(null);

  async function onPickFile(file: File | null) {
    setError(null);
    setSuccess(null);
    setPreview(null);
    setDecisionsByIndex({});
    setApplyAuditEventId(null);
    setRecords(null);
    setDrafts(null);
    setSelectedIndex(0);
    setSourceFilename(null);

    if (!file) return;
    setSourceFilename(file.name);

    setParsing(true);
    try {
      const name = file.name.toLowerCase();

      let next: MarcRecord[] = [];
      if (name.endsWith('.mrc')) {
        const bytes = await readFileAsArrayBuffer(file);
        next = parseIso2709Records(bytes);
      } else if (name.endsWith('.xml')) {
        const text = await readFileAsText(file);
        next = parseMarcXmlRecords(text);
      } else if (name.endsWith('.json')) {
        const text = await readFileAsText(file);
        const json = JSON.parse(text) as unknown;
        next = parseMarcJsonRecords(json);
      } else {
        throw new Error('不支援的副檔名（請用 .mrc / .xml / .json）');
      }

      if (next.length === 0) throw new Error('解析完成但沒有任何 record（檔案可能是空的或格式不正確）');

      setRecords(next);
      setDrafts(next.map(toDraft));
      setSelectedIndex(0);
      setSuccess(`已解析：records=${next.length}`);
    } catch (e) {
      setRecords(null);
      setDrafts(null);
      setError(formatErrorMessage(e));
    } finally {
      setParsing(false);
    }
  }

  async function onPreview() {
    setPreviewing(true);
    setError(null);
    setSuccess(null);
    setPreview(null);
    setDecisionsByIndex({});
    setApplyAuditEventId(null);

    try {
      if (!session) throw new Error('這頁需要 staff 登入');
      if (!drafts || drafts.length === 0) throw new Error('請先選擇檔案並解析');

      const vocab = authorityVocabularyCode.trim() || 'local';

      const payloadRecords = drafts.map((d) => ({
        bib: buildBibPayload(d),
        marc_extras: d.marcExtras,
      }));

      const result = await importMarcBatch(params.orgId, {
        actor_user_id: session.user.id,
        mode: 'preview',
        records: payloadRecords,
        options: {
          save_marc_extras: saveMarcExtras,
          upsert_authority_terms: upsertAuthorityTerms,
          authority_vocabulary_code: vocab,
        },
        source_filename: sourceFilename ?? undefined,
        source_note: sourceNote.trim() ? sourceNote.trim() : undefined,
      });

      if (result.mode !== 'preview') throw new Error('Unexpected response: expected preview');

      setPreview(result);
      const nextDecisions: Record<number, MarcImportDecision> = {};
      for (const r of result.records) nextDecisions[r.record_index] = r.decision;
      setDecisionsByIndex(nextDecisions);

      setSuccess(`已完成預覽：records=${result.source.records}；warnings=${result.warnings.length}；errors=${result.errors.length}`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setPreviewing(false);
    }
  }

  async function onApply() {
    setApplying(true);
    setError(null);
    setSuccess(null);
    setApplyAuditEventId(null);

    try {
      if (!session) throw new Error('這頁需要 staff 登入');
      if (!drafts || drafts.length === 0) throw new Error('請先選擇檔案並解析');
      if (!preview) throw new Error('請先執行一次預覽（preview）');

      const vocab = authorityVocabularyCode.trim() || 'local';
      const payloadRecords = drafts.map((d) => ({
        bib: buildBibPayload(d),
        marc_extras: d.marcExtras,
      }));

      const decisions = preview.records.map((r) => {
        const decision = decisionsByIndex[r.record_index] ?? r.decision;
        const out: any = { index: r.record_index, decision };
        if (decision === 'update' && r.target_bib_id) out.target_bib_id = r.target_bib_id;
        return out as { index: number; decision: MarcImportDecision; target_bib_id?: string };
      });

      const result = await importMarcBatch(params.orgId, {
        actor_user_id: session.user.id,
        mode: 'apply',
        records: payloadRecords,
        options: {
          save_marc_extras: saveMarcExtras,
          upsert_authority_terms: upsertAuthorityTerms,
          authority_vocabulary_code: vocab,
        },
        decisions,
        source_filename: sourceFilename ?? undefined,
        source_note: sourceNote.trim() ? sourceNote.trim() : undefined,
      });

      if (result.mode !== 'apply') throw new Error('Unexpected response: expected apply');

      setApplyAuditEventId(result.audit_event_id);
      setSuccess(`已套用匯入：audit_event_id=${result.audit_event_id}`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setApplying(false);
    }
  }

  // Login gate
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>MARC Import</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>MARC Import</h1>
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
        <h1 style={{ marginTop: 0 }}>MARC Import（v1：批次 preview/apply）</h1>
        <p className="muted">
          支援：<code>.mrc</code> / <code>.xml</code> / <code>.json</code>（可多筆 record）
        </p>
        <p className="muted">
          批次匯入使用：<code>POST /bibs/import-marc</code>（preview/apply），可去重 ISBN/035、選擇 create/update/skip，並寫入一筆 audit。
        </p>

        <div className="muted" style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          <div>
            orgId：<code>{params.orgId}</code>
          </div>
          {sourceFilename ? (
            <div>
              source：<code>{sourceFilename}</code>
            </div>
          ) : null}
        </div>

        {parsing ? <p className="muted">解析中…</p> : null}
        {previewing ? <p className="muted">預覽中…</p> : null}
        {applying ? <p className="muted">套用中…</p> : null}
        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <div style={{ marginTop: 12 }}>
          <input
            type="file"
            accept=".mrc,.xml,.json"
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            disabled={parsing || previewing || applying}
          />
        </div>

        {records && records.length > 1 ? (
          <label style={{ marginTop: 12 }}>
            選擇 record（共 {records.length} 筆）
            <select
              value={String(selectedIndex)}
              onChange={(e) => setSelectedIndex(Number.parseInt(e.target.value, 10))}
              disabled={parsing || previewing || applying}
            >
              {records.map((_, idx) => (
                <option key={idx} value={String(idx)}>
                  #{idx + 1}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>匯入選項</h2>
        <label>
          <input type="checkbox" checked={saveMarcExtras} onChange={(e) => setSaveMarcExtras(e.target.checked)} />{' '}
          保留未對映欄位到 <code>marc_extras</code>
        </label>
        <label>
          <input
            type="checkbox"
            checked={upsertAuthorityTerms}
            onChange={(e) => setUpsertAuthorityTerms(e.target.checked)}
          />{' '}
          自動建立缺少的 authority terms（name/subject/geographic/genre）
        </label>
        <label style={{ marginTop: 8 }}>
          新建 authority terms 的 vocabulary_code（建議：local）
          <input value={authorityVocabularyCode} onChange={(e) => setAuthorityVocabularyCode(e.target.value)} />
        </label>
        <label style={{ marginTop: 8 }}>
          source_note（可選；會寫入 audit metadata）
          <input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="例：OCLC 匯出檔（2025-12）" />
        </label>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>映射到書目表單（逐筆可微調）</h2>
        {!selectedDraft ? <p className="muted">請先選擇檔案並解析。</p> : null}

        {selectedDraft ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <label>
              title（必填）
              <input
                value={selectedDraft.title}
                onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { title: e.target.value }))}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                creators（每行一位）
                <textarea
                  value={selectedDraft.creators}
                  onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { creators: e.target.value }))}
                  rows={4}
                />
              </label>
              <label>
                contributors（每行一位）
                <textarea
                  value={selectedDraft.contributors}
                  onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { contributors: e.target.value }))}
                  rows={4}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                subjects（650；每行一個）
                <textarea
                  value={selectedDraft.subjects}
                  onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { subjects: e.target.value }))}
                  rows={4}
                />
              </label>
              <label>
                geographics（651；每行一個）
                <textarea
                  value={selectedDraft.geographics}
                  onChange={(e) =>
                    drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { geographics: e.target.value }))
                  }
                  rows={4}
                />
              </label>
            </div>

            <label>
              genres（655；每行一個）
              <textarea
                value={selectedDraft.genres}
                onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { genres: e.target.value }))}
                rows={4}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <label>
                publisher
                <input
                  value={selectedDraft.publisher}
                  onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { publisher: e.target.value }))}
                />
              </label>
              <label>
                published_year
                <input
                  value={selectedDraft.publishedYear}
                  onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { publishedYear: e.target.value }))}
                />
              </label>
              <label>
                language
                <input
                  value={selectedDraft.language}
                  onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { language: e.target.value }))}
                  placeholder="例：zh-TW / chi"
                />
              </label>
              <label>
                isbn
                <input
                  value={selectedDraft.isbn}
                  onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { isbn: e.target.value }))}
                />
              </label>
            </div>

            <label>
              classification
              <input
                value={selectedDraft.classification}
                onChange={(e) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { classification: e.target.value }))}
              />
            </label>

            <details>
              <summary>marc_extras（共 {selectedDraft.marcExtras.length} 個 fields；用於保留未對映欄位與進階子欄位）</summary>
              <div style={{ marginTop: 12 }}>
                <MarcFieldsEditor
                  orgId={params.orgId}
                  value={selectedDraft.marcExtras}
                  onChange={(next) => drafts && setDrafts(updateDraftAt(drafts, selectedIndex, { marcExtras: next }))}
                  disabled={parsing || previewing || applying}
                />
              </div>

              <details style={{ marginTop: 12 }}>
                <summary className="muted">檢視 marc_extras JSON</summary>
                <textarea
                  value={JSON.stringify(selectedDraft.marcExtras, null, 2)}
                  readOnly
                  rows={10}
                  style={{ marginTop: 8 }}
                />
              </details>
            </details>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" disabled={parsing || previewing || applying} onClick={() => void onPreview()}>
                {previewing ? '預覽中…' : '預覽批次匯入'}
              </button>
              <button type="button" disabled={parsing || previewing || applying || !preview} onClick={() => void onApply()}>
                {applying ? '套用中…' : '套用（apply）'}
              </button>
              <Link href={`/orgs/${params.orgId}/bibs`}>回到 Bibs</Link>
            </div>

            {applyAuditEventId ? (
              <p className="success">
                已寫入 audit：<Link href={`/orgs/${params.orgId}/audit-events`}>{applyAuditEventId}</Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>批次預覽結果</h2>
        {!preview ? <p className="muted">尚未執行 preview。</p> : null}

        {preview ? (
          <div className="stack">
            <div className="muted" style={{ display: 'grid', gap: 4 }}>
              <div>
                records：<code>{preview.source.records}</code>，sha256：<code>{preview.source.sha256.slice(0, 12)}…</code>
              </div>
              <div>
                summary：create=<code>{preview.summary.to_create}</code>，update=<code>{preview.summary.to_update}</code>，skip=<code>{preview.summary.to_skip}</code>
              </div>
              <div>
                matched：ISBN=<code>{preview.summary.matched_by_isbn}</code>，035=<code>{preview.summary.matched_by_035}</code>
              </div>
              <div>
                warnings=<code>{preview.warnings.length}</code>，errors=<code>{preview.errors.length}</code>
              </div>
            </div>

            {preview.warnings.length > 0 ? (
              <details>
                <summary>Warnings（{preview.warnings.length}）</summary>
                <pre style={{ overflowX: 'auto', marginTop: 8 }}>{JSON.stringify(preview.warnings, null, 2)}</pre>
              </details>
            ) : null}

            {preview.errors.length > 0 ? (
              <details>
                <summary>Errors（{preview.errors.length}；apply 會拒絕寫入）</summary>
                <pre style={{ overflowX: 'auto', marginTop: 8 }}>{JSON.stringify(preview.errors, null, 2)}</pre>
              </details>
            ) : null}

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>title</th>
                    <th>isbn</th>
                    <th>match</th>
                    <th>suggested</th>
                    <th>decision</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.records.map((r) => {
                    const canUpdate = Boolean(r.match.bib_id || r.target_bib_id);
                    const decision = decisionsByIndex[r.record_index] ?? r.decision;
                    const matchLabel = r.match.bib_id
                      ? `${r.match.by ?? 'match'} → ${r.match.bib_title ?? r.match.bib_id}`
                      : '—';
                    return (
                      <tr key={r.record_index}>
                        <td>{r.record_index + 1}</td>
                        <td style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.bib.title}
                        </td>
                        <td>{r.isbn ?? '—'}</td>
                        <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {matchLabel}
                        </td>
                        <td>{r.suggested_decision}</td>
                        <td>
                          <select
                            value={decision}
                            onChange={(e) =>
                              setDecisionsByIndex((prev) => ({
                                ...prev,
                                [r.record_index]: e.target.value as MarcImportDecision,
                              }))
                            }
                          >
                            <option value="create">create</option>
                            <option value="update" disabled={!canUpdate}>
                              update{!canUpdate ? '（no match）' : ''}
                            </option>
                            <option value="skip">skip</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
