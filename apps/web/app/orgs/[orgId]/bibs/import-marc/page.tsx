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

import type { MarcField, MarcImportApplyResult, MarcImportDecision, MarcImportPreviewResult, MarcRecord } from '../../../../lib/api';
import { MarcFieldsEditor } from '../../../../components/marc/marc-fields-editor';
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { SkeletonText } from '../../../../components/ui/skeleton';
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

  const busy = parsing || previewing || applying;

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
  const [applyResult, setApplyResult] = useState<MarcImportApplyResult | null>(null);

  function patchSelectedDraft(patch: Partial<Draft>) {
    setDrafts((prev) => (prev ? updateDraftAt(prev, selectedIndex, patch) : prev));
    setPreview(null);
    setDecisionsByIndex({});
    setApplyResult(null);
  }

  async function onPickFile(file: File | null) {
    setError(null);
    setSuccess(null);
    setPreview(null);
    setDecisionsByIndex({});
    setApplyResult(null);
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
    setApplyResult(null);

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
    setApplyResult(null);

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

      setApplyResult(result);
      setSuccess(`已套用匯入：audit_event_id=${result.audit_event_id} · records=${result.summary.total_records}`);
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
        <PageHeader title="MARC Import" description="載入登入狀態中…">
          <Alert variant="info" title="載入登入狀態中…" role="status" />
        </PageHeader>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader
          title="MARC Import"
          description="匯入是高風險批次寫入（會建立/更新書目並寫入 marc_extras），因此需要 staff 登入。"
          actions={
            <Link className="btnSmall btnPrimary" href={`/orgs/${params.orgId}/login`}>
              前往登入
            </Link>
          }
        >
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能操作。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title="MARC Import（批次 preview/apply）"
        description={
          <>
            支援：<code>.mrc</code> / <code>.xml</code> / <code>.json</code>（可多筆 record）。API：<code>POST /bibs/import-marc</code>（preview/apply），支援 ISBN/035
            去重、逐筆決策（create/update/skip），並寫入一筆 audit。
          </>
        }
        actions={
          <>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs`}>
              回 Bibs
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/marc-dictionary`}>
              欄位字典
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs/marc-editor`}>
              MARC 編輯器
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/audit-events`}>
              Audit
            </Link>
          </>
        }
      >
        <div className="grid3">
          <div className="callout">
            <div className="muted">orgId</div>
            <div style={{ fontFamily: 'var(--font-mono)' }}>{params.orgId}</div>
          </div>
          <div className="callout">
            <div className="muted">source</div>
            <div>{sourceFilename ? <code>{sourceFilename}</code> : <span className="muted">（未選擇）</span>}</div>
          </div>
          <div className="callout">
            <div className="muted">records</div>
            <div>
              <code>{records ? records.length : 0}</code>
            </div>
          </div>
        </div>

        {busy ? (
          <Alert
            variant="info"
            title={parsing ? '解析中…' : previewing ? '預覽中…' : '套用中…'}
            role="status"
          />
        ) : null}
        {parsing ? <SkeletonText lines={2} /> : null}

        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="來源檔案" description="選擇檔案後會先在瀏覽器端解析；preview/apply 才會送到 API。" />
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="選擇檔案" description="（提示）建議先用 preview 檢查 warnings/errors，再做 apply。">
            <Field label="MARC 檔案（.mrc / .xml / .json）" htmlFor="marc_import_file">
              <input
                id="marc_import_file"
                type="file"
                accept=".mrc,.xml,.json"
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
            </Field>

            {records && records.length > 1 ? (
              <Field label={`選擇 record（共 ${records.length} 筆）`} htmlFor="marc_import_record_index">
                <select
                  id="marc_import_record_index"
                  value={String(selectedIndex)}
                  onChange={(e) => setSelectedIndex(Number.parseInt(e.target.value, 10))}
                  disabled={busy}
                >
                  {records.map((_, idx) => (
                    <option key={idx} value={String(idx)}>
                      #{idx + 1}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {!records ? <EmptyState title="尚未選擇檔案" description="請先選擇 .mrc / .xml / .json 檔案以產生可編輯的草稿。" /> : null}
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="匯入選項" description="控制 marc_extras/authority term 建立策略；有 errors 時 apply 會拒絕寫入。" />
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="匯入選項" description="建議先 preview 再 apply；有 errors 時 apply 會拒絕寫入。">
            <Field label="保留未對映欄位到 marc_extras" htmlFor="marc_import_save_marc_extras" hint={<code>save_marc_extras</code>}>
              <input
                id="marc_import_save_marc_extras"
                type="checkbox"
                checked={saveMarcExtras}
                onChange={(e) => setSaveMarcExtras(e.target.checked)}
                disabled={busy}
              />
            </Field>

            <Field
              label="自動建立缺少的 authority terms（name/subject/geographic/genre）"
              htmlFor="marc_import_upsert_authority_terms"
              hint={<code>upsert_authority_terms</code>}
            >
              <input
                id="marc_import_upsert_authority_terms"
                type="checkbox"
                checked={upsertAuthorityTerms}
                onChange={(e) => setUpsertAuthorityTerms(e.target.checked)}
                disabled={busy}
              />
            </Field>

            <Field
              label="新建 authority terms 的 vocabulary_code（建議：local）"
              htmlFor="marc_import_authority_vocabulary_code"
              hint={<code>authority_vocabulary_code</code>}
            >
              <input
                id="marc_import_authority_vocabulary_code"
                value={authorityVocabularyCode}
                onChange={(e) => setAuthorityVocabularyCode(e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field
              label="source_note（可選；會寫入 audit metadata）"
              htmlFor="marc_import_source_note"
              hint="例：OCLC 匯出檔（2025-12）"
            >
              <input
                id="marc_import_source_note"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                placeholder="例：OCLC 匯出檔（2025-12）"
                disabled={busy}
              />
            </Field>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>映射到書目表單（逐筆可微調）</h2>
        {!selectedDraft ? <EmptyState title="尚未產生草稿" description="請先選擇檔案並解析，才會出現可微調的書目欄位。" /> : null}

        {selectedDraft ? (
          <Form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 12 }}>
            <FormSection title={`Record #${selectedIndex + 1}`} description="修改後請重新 preview（避免套用舊的比對/去重結果）。">
              <Field label="title（必填）" htmlFor="marc_import_title">
                <input
                  id="marc_import_title"
                  value={selectedDraft.title}
                  onChange={(e) => patchSelectedDraft({ title: e.target.value })}
                  disabled={busy}
                />
              </Field>

              <div className="grid2">
                <Field label="creators（每行一位）" htmlFor="marc_import_creators">
                  <textarea
                    id="marc_import_creators"
                    value={selectedDraft.creators}
                    onChange={(e) => patchSelectedDraft({ creators: e.target.value })}
                    rows={4}
                    disabled={busy}
                  />
                </Field>
                <Field label="contributors（每行一位）" htmlFor="marc_import_contributors">
                  <textarea
                    id="marc_import_contributors"
                    value={selectedDraft.contributors}
                    onChange={(e) => patchSelectedDraft({ contributors: e.target.value })}
                    rows={4}
                    disabled={busy}
                  />
                </Field>
              </div>

              <div className="grid2">
                <Field label="subjects（650；每行一個）" htmlFor="marc_import_subjects">
                  <textarea
                    id="marc_import_subjects"
                    value={selectedDraft.subjects}
                    onChange={(e) => patchSelectedDraft({ subjects: e.target.value })}
                    rows={4}
                    disabled={busy}
                  />
                </Field>
                <Field label="geographics（651；每行一個）" htmlFor="marc_import_geographics">
                  <textarea
                    id="marc_import_geographics"
                    value={selectedDraft.geographics}
                    onChange={(e) => patchSelectedDraft({ geographics: e.target.value })}
                    rows={4}
                    disabled={busy}
                  />
                </Field>
              </div>

              <Field label="genres（655；每行一個）" htmlFor="marc_import_genres">
                <textarea
                  id="marc_import_genres"
                  value={selectedDraft.genres}
                  onChange={(e) => patchSelectedDraft({ genres: e.target.value })}
                  rows={4}
                  disabled={busy}
                />
              </Field>

              <div className="grid4">
                <Field label="publisher" htmlFor="marc_import_publisher">
                  <input
                    id="marc_import_publisher"
                    value={selectedDraft.publisher}
                    onChange={(e) => patchSelectedDraft({ publisher: e.target.value })}
                    disabled={busy}
                  />
                </Field>
                <Field label="published_year" htmlFor="marc_import_published_year">
                  <input
                    id="marc_import_published_year"
                    value={selectedDraft.publishedYear}
                    onChange={(e) => patchSelectedDraft({ publishedYear: e.target.value })}
                    disabled={busy}
                  />
                </Field>
                <Field label="language" htmlFor="marc_import_language" hint="例：zh-TW / chi">
                  <input
                    id="marc_import_language"
                    value={selectedDraft.language}
                    onChange={(e) => patchSelectedDraft({ language: e.target.value })}
                    placeholder="例：zh-TW / chi"
                    disabled={busy}
                  />
                </Field>
                <Field label="isbn" htmlFor="marc_import_isbn">
                  <input
                    id="marc_import_isbn"
                    value={selectedDraft.isbn}
                    onChange={(e) => patchSelectedDraft({ isbn: e.target.value })}
                    disabled={busy}
                  />
                </Field>
              </div>

              <Field label="classification" htmlFor="marc_import_classification">
                <input
                  id="marc_import_classification"
                  value={selectedDraft.classification}
                  onChange={(e) => patchSelectedDraft({ classification: e.target.value })}
                  disabled={busy}
                />
              </Field>

              <details className="details">
                <summary>
                  marc_extras（共 <code>{selectedDraft.marcExtras.length}</code> 個 fields；用於保留未對映欄位與進階子欄位）
                </summary>
                <div style={{ padding: 12 }}>
                  <MarcFieldsEditor
                    orgId={params.orgId}
                    value={selectedDraft.marcExtras}
                    onChange={(next) => patchSelectedDraft({ marcExtras: next })}
                    disabled={busy}
                  />

                  <details className="details" style={{ marginTop: 12 }}>
                    <summary>檢視 marc_extras JSON</summary>
                    <textarea value={JSON.stringify(selectedDraft.marcExtras, null, 2)} readOnly rows={10} style={{ marginTop: 8 }} />
                  </details>
                </div>
              </details>

              {preview && preview.errors.length > 0 ? (
                <Alert variant="warning" title={`preview 有 errors（${preview.errors.length}）`} role="status">
                  請先修正草稿內容並重新 preview；有 errors 時 apply 會拒絕寫入。
                </Alert>
              ) : null}

              <FormActions>
                <button type="button" className="btnPrimary" disabled={busy || !drafts || drafts.length === 0} onClick={() => void onPreview()}>
                  {previewing ? '預覽中…' : '預覽（Preview）'}
                </button>
                <button type="button" className="btnDanger" disabled={busy || !preview || preview.errors.length > 0} onClick={() => void onApply()}>
                  {applying ? '套用中…' : '套用（Apply）'}
                </button>
              </FormActions>

              {applyResult ? (
                <Alert variant="success" title="已寫入 audit" role="status">
                  <Link href={`/orgs/${params.orgId}/audit-events`}>{applyResult.audit_event_id}</Link>
                </Alert>
              ) : null}
            </FormSection>
          </Form>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>批次預覽結果</h2>
        {!preview ? <EmptyState title="尚未執行 preview" description="請先在上方完成草稿調整，並點選「預覽（Preview）」。" /> : null}

        {preview ? (
          <div className="stack">
            <Alert variant="info" title="摘要" role="status">
              <div>
                records=<code>{preview.source.records}</code> · sha256=<code>{preview.source.sha256.slice(0, 12)}…</code>
              </div>
              <div style={{ marginTop: 6 }}>
                create=<code>{preview.summary.to_create}</code> · update=<code>{preview.summary.to_update}</code> · skip=
                <code>{preview.summary.to_skip}</code>
              </div>
              <div style={{ marginTop: 6 }}>
                matched：ISBN=<code>{preview.summary.matched_by_isbn}</code> · 035=<code>{preview.summary.matched_by_035}</code>
              </div>
              <div style={{ marginTop: 6 }}>
                warnings=<code>{preview.warnings.length}</code> · errors=<code>{preview.errors.length}</code>
              </div>
            </Alert>

            {preview.warnings.length > 0 ? (
              <details className="details">
                <summary>
                  Warnings（<code>{preview.warnings.length}</code>）
                </summary>
                <pre style={{ overflowX: 'auto', padding: 12, margin: 0 }}>{JSON.stringify(preview.warnings, null, 2)}</pre>
              </details>
            ) : null}

            {preview.errors.length > 0 ? (
              <details className="details">
                <summary>
                  Errors（<code>{preview.errors.length}</code>；apply 會拒絕寫入）
                </summary>
                <pre style={{ overflowX: 'auto', padding: 12, margin: 0 }}>{JSON.stringify(preview.errors, null, 2)}</pre>
              </details>
            ) : null}

            <DataTable
              rows={preview.records}
              getRowKey={(r) => String(r.record_index)}
              initialSort={{ columnId: 'record_index', direction: 'asc' }}
              sortHint={
                <>
                  排序僅影響此預覽表格的呈現；apply 仍以 <code>record_index</code> 作為逐筆決策對應鍵。
                </>
              }
              columns={[
                {
                  id: 'record_index',
                  header: '#（record_index）',
                  sortValue: (r) => r.record_index,
                  cell: (r) => <code>{r.record_index + 1}</code>,
                  width: 130,
                },
                {
                  id: 'title',
                  header: 'title',
                  sortValue: (r) => r.bib.title,
                  cell: (r) => (
                    <div style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.bib.title}
                    </div>
                  ),
                },
                { id: 'isbn', header: 'isbn', sortValue: (r) => r.isbn ?? '', cell: (r) => r.isbn ?? '—', width: 140 },
                {
                  id: 'match',
                  header: 'match',
                  sortValue: (r) => r.match.bib_id ?? '',
                  cell: (r) => {
                    const matchLabel = r.match.bib_id
                      ? `${r.match.by ?? 'match'} → ${r.match.bib_title ?? r.match.bib_id}`
                      : '—';
                    return (
                      <div style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {matchLabel}
                      </div>
                    );
                  },
                },
                { id: 'suggested', header: 'suggested', sortValue: (r) => r.suggested_decision, cell: (r) => r.suggested_decision, width: 130 },
                {
                  id: 'decision',
                  header: 'decision',
                  cell: (r) => {
                    const canUpdate = Boolean(r.match.bib_id || r.target_bib_id);
                    const decision = decisionsByIndex[r.record_index] ?? r.decision;
                    return (
                      <select
                        value={decision}
                        onChange={(e) =>
                          setDecisionsByIndex((prev) => ({
                            ...prev,
                            [r.record_index]: e.target.value as MarcImportDecision,
                          }))
                        }
                        disabled={busy}
                      >
                        <option value="create">create</option>
                        <option value="update" disabled={!canUpdate}>
                          update{!canUpdate ? '（no match）' : ''}
                        </option>
                        <option value="skip">skip</option>
                      </select>
                    );
                  },
                  width: 180,
                },
              ]}
            />
          </div>
        ) : null}
      </section>

      {applyResult ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>批次套用結果</h2>

          <Alert variant="success" title="已套用匯入" role="status">
            audit_event_id：<Link href={`/orgs/${params.orgId}/audit-events`}>{applyResult.audit_event_id}</Link>
          </Alert>

          <Alert variant="info" title="摘要" role="status">
            total=<code>{applyResult.summary.total_records}</code> · valid=<code>{applyResult.summary.valid_records}</code> · invalid=
            <code>{applyResult.summary.invalid_records}</code> · create=<code>{applyResult.summary.to_create}</code> · update=
            <code>{applyResult.summary.to_update}</code> · skip=<code>{applyResult.summary.to_skip}</code>
          </Alert>

          {applyResult.results.length === 0 ? (
            <EmptyState title="沒有任何結果" description="（理論上不太會發生）若持續出現請檢查 API 回傳。" />
          ) : (
            <DataTable
              rows={applyResult.results}
              getRowKey={(r) => String(r.record_index)}
              initialSort={{ columnId: 'record_index', direction: 'asc' }}
              columns={[
                {
                  id: 'record_index',
                  header: '#（record_index）',
                  sortValue: (r) => r.record_index,
                  cell: (r) => <code>{r.record_index + 1}</code>,
                  width: 130,
                },
                { id: 'decision', header: 'decision', sortValue: (r) => r.decision, cell: (r) => r.decision, width: 140 },
                {
                  id: 'bib_id',
                  header: 'bib_id',
                  sortValue: (r) => r.bib_id ?? '',
                  cell: (r) => (r.bib_id ? <Link href={`/orgs/${params.orgId}/bibs/${r.bib_id}`}>{r.bib_id}</Link> : '—'),
                },
              ]}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
