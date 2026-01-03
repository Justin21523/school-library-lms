/**
 * Catalog CSV Import Page（/orgs/:orgId/bibs/import）
 *
 * 對應 user story：
 * - US-022 批次匯入書目/冊（CSV）
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/bibs/import（mode=preview|apply）
 *
 * 這頁的目的，是讓學校在「第一次導入」時，用最少人力把館藏建起來：
 * - 一列 CSV = 一冊 item（barcode/call_number/location...）
 * - 依列上的 bibliographic_id 或 isbn 決定要連到既有書目，或建立新書目
 *
 * Auth/權限：
 * - 匯入是高風險批次寫入，因此 API 端點受 StaffAuthGuard 保護
 * - actor_user_id 由 staff session 推導（session.user.id）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type {
  CatalogCsvImportApplyResult,
  CatalogCsvImportPreviewResult,
  CatalogCsvImportRowError,
  Location,
} from '../../../../lib/api';
import {
  ApiError,
  applyCatalogCsvImport,
  listLocations,
  previewCatalogCsvImport,
} from '../../../../lib/api';
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader, SectionHeader } from '../../../../components/ui/page-header';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

function isActiveLocation(location: Location) {
  return location.status === 'active';
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

function extractImportErrors(error: unknown): CatalogCsvImportRowError[] | null {
  if (!(error instanceof ApiError)) return null;
  const details = error.body?.error?.details as any;
  if (!details || typeof details !== 'object') return null;
  const errors = details.errors;
  if (!Array.isArray(errors)) return null;
  return errors as CatalogCsvImportRowError[];
}

export default function CatalogImportPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) staff session（登入者 / 操作者）
  // ----------------------------

  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 2) locations（用於 default_location_id）
  // ----------------------------

  const [locations, setLocations] = useState<Location[] | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const activeLocations = useMemo(() => (locations ?? []).filter(isActiveLocation), [locations]);

  const [defaultLocationId, setDefaultLocationId] = useState<string>('');

  useEffect(() => {
    if (!sessionReady || !session) return;
    async function run() {
      setLoadingLocations(true);
      try {
        const result = await listLocations(params.orgId);
        setLocations(result);
        if (!defaultLocationId) {
          const first = result.find(isActiveLocation);
          if (first) setDefaultLocationId(first.id);
        }
      } catch (e) {
        setLocations(null);
      } finally {
        setLoadingLocations(false);
      }
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId, sessionReady, session]);

  // ----------------------------
  // 3) CSV input（檔案/文字）
  // ----------------------------

  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');

  // ----------------------------
  // 4) options（update / relink / note）
  // ----------------------------

  const [updateExistingItems, setUpdateExistingItems] = useState(true);
  const [allowRelinkBibliographic, setAllowRelinkBibliographic] = useState(false);
  const [sourceNote, setSourceNote] = useState('');

  // ----------------------------
  // 5) preview/apply state
  // ----------------------------

  const [preview, setPreview] = useState<CatalogCsvImportPreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<CatalogCsvImportApplyResult | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<CatalogCsvImportRowError[] | null>(null);

  async function onPickFile(file: File | null) {
    setError(null);
    setSuccess(null);
    setImportErrors(null);
    setApplyResult(null);
    setPreview(null);

    if (!file) return;
    setSourceFilename(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvText(text);
    };
    reader.onerror = () => setError('讀取檔案失敗，請重新選擇檔案');
    reader.readAsText(file);
  }

  function onDownloadTemplate() {
    const content = [
      'barcode,call_number,location_code,status,acquired_at,notes,title,creators,isbn,classification,publisher,published_year,language,subjects',
      'LIB-000001,823.914 R86,MAIN,available,2025-01-01,,哈利波特（示例）,J. K. Rowling,9789573317240,823.914,皇冠,2000,zh,魔法;小說',
      'LIB-000002,823.914 R86,MAIN,available,2025-01-01,,哈利波特（示例）,J. K. Rowling,9789573317240,823.914,皇冠,2000,zh,魔法;小說',
      '',
    ].join('\n');

    downloadText('catalog-import-template.csv', content, 'text/csv;charset=utf-8');
  }

  async function runPreview() {
    setPreviewing(true);
    setApplyResult(null);
    setError(null);
    setSuccess(null);
    setImportErrors(null);

    try {
      if (!actorUserId) throw new Error('缺少 actor_user_id（請先登入）');
      const text = csvText.trim();
      if (!text) throw new Error('CSV 內容不可為空');

      const result = await previewCatalogCsvImport(params.orgId, {
        actor_user_id: actorUserId,
        csv_text: text,
        ...(defaultLocationId.trim() ? { default_location_id: defaultLocationId.trim() } : {}),
        update_existing_items: updateExistingItems,
        allow_relink_bibliographic: allowRelinkBibliographic,
        ...(sourceFilename ? { source_filename: sourceFilename } : {}),
        ...(sourceNote.trim() ? { source_note: sourceNote.trim() } : {}),
      });

      setPreview(result);
      if (result.errors.length > 0) {
        setSuccess(`已完成預覽，但有 ${result.errors.length} 個錯誤需要修正`);
      } else {
        setSuccess(
          `預覽完成：bibs_to_create=${result.summary.bibs_to_create} · items_to_create=${result.summary.items_to_create} · items_to_update=${result.summary.items_to_update}`,
        );
      }
    } catch (e) {
      setPreview(null);
      setError(formatErrorMessage(e));
    } finally {
      setPreviewing(false);
    }
  }

  async function runApply() {
    setApplying(true);
    setApplyResult(null);
    setError(null);
    setSuccess(null);
    setImportErrors(null);

    try {
      if (!actorUserId) throw new Error('缺少 actor_user_id（請先登入）');
      const text = csvText.trim();
      if (!text) throw new Error('CSV 內容不可為空');
      if (!preview) throw new Error('請先按「預覽」確認變更與錯誤');
      if (preview.errors.length > 0) throw new Error('預覽仍有錯誤，請先修正 CSV 再套用');

      const ok = window.confirm(
        `確認要套用匯入嗎？\n\n` +
          `bibs_to_create：${preview.summary.bibs_to_create}\n` +
          `items_to_create：${preview.summary.items_to_create}\n` +
          `items_to_update：${preview.summary.items_to_update}\n\n` +
          `此動作會寫入資料庫並產生稽核事件（audit）。`,
      );
      if (!ok) return;

      const result = await applyCatalogCsvImport(params.orgId, {
        actor_user_id: actorUserId,
        csv_text: text,
        ...(defaultLocationId.trim() ? { default_location_id: defaultLocationId.trim() } : {}),
        update_existing_items: updateExistingItems,
        allow_relink_bibliographic: allowRelinkBibliographic,
        ...(sourceFilename ? { source_filename: sourceFilename } : {}),
        ...(sourceNote.trim() ? { source_note: sourceNote.trim() } : {}),
      });

      setApplyResult(result);
      setSuccess(`已套用匯入：audit_event_id=${result.audit_event_id}`);
    } catch (e) {
      setApplyResult(null);
      setError(formatErrorMessage(e));
      setImportErrors(extractImportErrors(e));
    } finally {
      setApplying(false);
    }
  }

  // ----------------------------
  // Login gate
  // ----------------------------

  if (!sessionReady) {
    return (
      <div className="stack">
        <PageHeader title="Catalog CSV Import" description="載入登入狀態中…">
          <Alert variant="info" title="載入登入狀態中…" role="status" />
        </PageHeader>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <PageHeader
          title="Catalog CSV Import"
          description="匯入屬於高風險批次寫入（會建立/更新 items），因此需要 staff 登入。"
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

  // ----------------------------
  // Render
  // ----------------------------

  return (
    <div className="stack">
      <PageHeader
        title="Catalog CSV Import（US-022）"
        description={
          <>
            對應 API：<code>POST /api/v1/orgs/:orgId/bibs/import</code>（preview/apply）。actor_user_id：
            <code>{session.user.id}</code>（{session.user.name} / {session.user.role}）
          </>
        }
        actions={
          <>
            <button type="button" className="btnSmall" onClick={onDownloadTemplate}>
              下載 CSV 範本
            </button>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/audit-events`}>
              Audit
            </Link>
            <Link className="btnSmall" href={`/orgs/${params.orgId}/bibs`}>
              回 Bibs
            </Link>
          </>
        }
      >
        {error ? (
          <Alert variant="danger" title="操作失敗">
            {error}
          </Alert>
        ) : null}
        {success ? <Alert variant="success" title={success} role="status" /> : null}
      </PageHeader>

      <section className="panel">
        <SectionHeader title="1) CSV 檔案 / 文字" description="上傳檔案或貼上 CSV 文字（建議 UTF-8）；每列代表一冊 item。" />

        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="來源" description="你可以上傳檔案，或直接貼上 CSV 文字（建議 UTF-8）。">
            <Field label="上傳檔案（CSV UTF-8）" htmlFor="catalog_import_file">
              <input
                id="catalog_import_file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                disabled={previewing || applying}
              />
            </Field>

            <Field label="或貼上 CSV 文字" htmlFor="catalog_import_csv_text" hint="需包含 header；每列代表一冊 item。">
              <textarea
                id="catalog_import_csv_text"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setPreview(null);
                  setApplyResult(null);
                  setImportErrors(null);
                }}
                rows={10}
                placeholder="barcode,call_number,location_code,..."
                style={{ fontFamily: 'var(--font-mono)' }}
                disabled={previewing || applying}
              />
            </Field>

            <div className="muted">
              目前檔名：{sourceFilename ?? '（未選擇）'} · 內容長度：{csvText.length.toLocaleString()} 字元
            </div>

            <Alert variant="info" title="小提示" role="status">
              建議：<code>location_code</code> 請使用 <code>locations.code</code>（可在{' '}
              <Link href={`/orgs/${params.orgId}/locations`}>Locations</Link> 查看）。
            </Alert>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="2) 匯入選項" description="控制預設 location、更新策略與高風險 relink 行為。" />

        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="Options" description="高風險選項（relink）建議只在你完全理解資料後才開啟。">
            {loadingLocations ? <Alert variant="info" title="載入 locations 中…" role="status" /> : null}
            {!loadingLocations && activeLocations.length === 0 ? (
              <Alert variant="warning" title="沒有可用的 locations">
                你目前沒有任何 <code>active</code> locations。若 CSV 沒有提供 location，將無法套用預設 location。你可以先到{' '}
                <Link href={`/orgs/${params.orgId}/locations`}>Locations</Link> 建立地點。
              </Alert>
            ) : null}

            {allowRelinkBibliographic ? (
              <Alert variant="warning" title="allow_relink_bibliographic 已開啟">
                允許同一個 barcode 從「書目 A」改連到「書目 B」。這通常只在「初次導入後修正錯誤 mapping」時使用。
              </Alert>
            ) : null}

            <div className="grid2">
              <Field label="default_location_id（選填）" htmlFor="catalog_import_default_location_id" hint="CSV 未提供 location 時的預設值">
                <select
                  id="catalog_import_default_location_id"
                  value={defaultLocationId}
                  onChange={(e) => setDefaultLocationId(e.target.value)}
                  disabled={loadingLocations || previewing || applying}
                >
                  <option value="">（不指定）</option>
                  {activeLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} · {l.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="source_note（選填）" htmlFor="catalog_import_source_note" hint="寫入 audit metadata（追溯用）">
                <input
                  id="catalog_import_source_note"
                  value={sourceNote}
                  onChange={(e) => setSourceNote(e.target.value)}
                  placeholder="例：113-1 初次導入（Excel 匯出）"
                  disabled={previewing || applying}
                />
              </Field>
            </div>

            <div className="grid2">
              <Field label="update_existing_items" htmlFor="catalog_import_update_existing_items" hint="barcode 已存在時允許更新">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    id="catalog_import_update_existing_items"
                    type="checkbox"
                    checked={updateExistingItems}
                    onChange={(e) => setUpdateExistingItems(e.target.checked)}
                    disabled={previewing || applying}
                  />
                  <span className="muted">update_existing_items</span>
                </div>
              </Field>

              <Field
                label="allow_relink_bibliographic"
                htmlFor="catalog_import_allow_relink_bibliographic"
                hint="允許同 barcode 重新指到不同書目（高風險）"
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    id="catalog_import_allow_relink_bibliographic"
                    type="checkbox"
                    checked={allowRelinkBibliographic}
                    onChange={(e) => setAllowRelinkBibliographic(e.target.checked)}
                    disabled={previewing || applying}
                  />
                  <span className="muted">allow_relink_bibliographic</span>
                </div>
              </Field>
            </div>
          </FormSection>
        </Form>
      </section>

      <section className="panel">
        <SectionHeader title="3) Preview / Apply" description="先 preview 再 apply；有 errors 時 apply 會拒絕寫入。" />

        <Form onSubmit={(e) => e.preventDefault()}>
          <FormSection title="執行" description="建議先 preview，再 apply（有 errors 時 apply 會失敗）。">
            <FormActions>
              <button type="button" className="btnSmall" onClick={() => void runPreview()} disabled={previewing || applying || !csvText.trim()}>
                {previewing ? '預覽中…' : '預覽（preview）'}
              </button>
              <button
                type="button"
                className="btnDanger"
                onClick={() => void runApply()}
                disabled={applying || previewing || !preview || preview.errors.length > 0}
              >
                {applying ? '套用中…' : '套用（apply）'}
              </button>
            </FormActions>

            {previewing ? <Alert variant="info" title="預覽中…" role="status" /> : null}
            {applying ? <Alert variant="info" title="套用中…" role="status" /> : null}

            {applyResult ? (
              <Alert variant="success" title="已套用匯入" role="status">
                audit_event_id：<Link href={`/orgs/${params.orgId}/audit-events`}>{applyResult.audit_event_id}</Link>
              </Alert>
            ) : null}

            {importErrors && importErrors.length > 0 ? (
              <Alert variant="danger" title={`套用失敗（後端回傳列錯誤：${importErrors.length}）`}>
                <details className="details">
                  <summary>檢視前 50 筆錯誤</summary>
                  <ul style={{ margin: 0, padding: '12px 18px' }}>
                    {importErrors.slice(0, 50).map((e) => (
                      <li key={`${e.row_number}-${e.code}`}>
                        row {e.row_number} · {e.code} · {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              </Alert>
            ) : null}
          </FormSection>
        </Form>

        <div style={{ marginTop: 12 }}>
          {!preview ? (
            <EmptyState title="尚未預覽" description="建議先下載範本，或貼上 CSV 後按「預覽」。" />
          ) : (
            <div className="stack">
              <Alert variant="info" title="preview summary" role="status">
                bibs_to_create=<code>{preview.summary.bibs_to_create}</code> · items_to_create=
                <code>{preview.summary.items_to_create}</code> · items_to_update=<code>{preview.summary.items_to_update}</code> · errors=
                <code>{preview.errors.length}</code>
              </Alert>

              {preview.errors.length > 0 ? (
                <details className="details">
                  <summary>
                    Preview errors（前 <code>{Math.min(50, preview.errors.length)}</code> 筆；請先修正再套用）
                  </summary>
                  <ul style={{ margin: 0, padding: '12px 18px' }}>
                    {preview.errors.slice(0, 50).map((e) => (
                      <li key={`${e.row_number}-${e.code}`}>
                        row {e.row_number} · {e.code} · {e.message}
                        {e.field ? ` · field=${e.field}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <Alert variant="success" title="preview 沒有 errors，可套用" role="status" />
              )}

              {preview.bibs_to_create_preview.length > 0 ? (
                <details className="details">
                  <summary>
                    將建立的書目（前 <code>{preview.bibs_to_create_preview.length}</code> 筆）
                  </summary>
                  <ul style={{ margin: 0, padding: '12px 18px' }}>
                    {preview.bibs_to_create_preview.map((b) => (
                      <li key={b.bib_key}>
                        {b.isbn ? `isbn=${b.isbn}` : b.bib_key} · {b.title ?? '(no title)'}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {preview.rows.length === 0 ? (
                <EmptyState title="preview rows 為空" description="請確認 CSV 是否有資料列（不含 header）。" />
              ) : (
                <DataTable
                  rows={preview.rows}
                  getRowKey={(r) => String(r.row_number)}
                  initialSort={{ columnId: 'row_number', direction: 'asc' }}
                  columns={[
                    { id: 'row_number', header: 'row', sortValue: (r) => r.row_number, cell: (r) => r.row_number, width: 80 },
                    { id: 'item_action', header: 'item_action', sortValue: (r) => r.item_action, cell: (r) => r.item_action, width: 130 },
                    { id: 'bib_action', header: 'bib_action', sortValue: (r) => r.bib_action, cell: (r) => r.bib_action, width: 130 },
                    { id: 'barcode', header: 'barcode', sortValue: (r) => r.barcode, cell: (r) => <code>{r.barcode}</code>, width: 160 },
                    { id: 'call_number', header: 'call_number', sortValue: (r) => r.call_number, cell: (r) => r.call_number, width: 180 },
                    { id: 'location_id', header: 'location_id', sortValue: (r) => r.location_id, cell: (r) => <code style={{ fontSize: 12 }}>{r.location_id}</code>, width: 220 },
                    { id: 'isbn', header: 'isbn', sortValue: (r) => r.isbn ?? '', cell: (r) => r.isbn ?? '—', width: 140 },
                    { id: 'title', header: 'title', sortValue: (r) => r.title ?? '', cell: (r) => r.title ?? '' },
                  ]}
                />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
