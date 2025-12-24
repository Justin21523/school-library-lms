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
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Catalog CSV Import</h1>
          <p className="muted">載入登入狀態中…</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Catalog CSV Import</h1>
          <p className="error">
            這頁需要 staff 登入才能操作。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </p>
        </section>
      </div>
    );
  }

  // ----------------------------
  // Render
  // ----------------------------

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Catalog CSV Import（US-022）</h1>
        <p className="muted">
          對應 API：<code>POST /api/v1/orgs/:orgId/bibs/import</code>（preview/apply）
        </p>
        <p className="muted">
          actor_user_id：<code>{session.user.id}</code>（{session.user.name} / {session.user.role}）
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={onDownloadTemplate}>
            下載 CSV 範本
          </button>
          <Link href={`/orgs/${params.orgId}/audit-events`}>前往 Audit Events</Link>
        </div>

        {error ? <p className="error">錯誤：{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>1) CSV 檔案 / 文字</h2>

        <label>
          上傳檔案（CSV UTF-8）
          <input type="file" accept=".csv,text/csv" onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)} />
        </label>

        <label>
          或貼上 CSV 文字
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={10} placeholder="barcode,call_number,location_code,..." />
        </label>

        <p className="muted">
          建議：location_code 請使用 <code>locations.code</code>（可在 <Link href={`/orgs/${params.orgId}/locations`}>Locations</Link> 查看）。
        </p>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>2) 匯入選項</h2>

        <label>
          default_location_id（選填；CSV 未提供 location 時的預設）
          <select value={defaultLocationId} onChange={(e) => setDefaultLocationId(e.target.value)} disabled={loadingLocations}>
            <option value="">（不指定）</option>
            {activeLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={updateExistingItems} onChange={(e) => setUpdateExistingItems(e.target.checked)} />
          update_existing_items（barcode 已存在時允許更新）
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={allowRelinkBibliographic}
            onChange={(e) => setAllowRelinkBibliographic(e.target.checked)}
          />
          allow_relink_bibliographic（允許同 barcode 重新指到不同書目；高風險）
        </label>

        <label>
          source_note（選填；寫入 audit metadata）
          <input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="例：113-1 初次導入（Excel 匯出）" />
        </label>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>3) Preview / Apply</h2>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void runPreview()} disabled={previewing}>
            {previewing ? '預覽中…' : '預覽（preview）'}
          </button>
          <button type="button" onClick={() => void runApply()} disabled={applying}>
            {applying ? '套用中…' : '套用（apply）'}
          </button>
        </div>

        {importErrors && importErrors.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <p className="error">套用失敗（後端回傳列錯誤）：</p>
            <ul>
              {importErrors.slice(0, 50).map((e) => (
                <li key={`${e.row_number}-${e.code}`}>
                  row {e.row_number} · {e.code} · {e.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {preview ? (
          <div style={{ marginTop: 12 }}>
            <p className="muted">
              summary：bibs_to_create={preview.summary.bibs_to_create} · items_to_create={preview.summary.items_to_create} · items_to_update={preview.summary.items_to_update} · errors={preview.errors.length}
            </p>

            {preview.errors.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <p className="error">Preview errors（前 50 筆）：</p>
                <ul>
                  {preview.errors.slice(0, 50).map((e) => (
                    <li key={`${e.row_number}-${e.code}`}>
                      row {e.row_number} · {e.code} · {e.message}
                      {e.field ? ` · field=${e.field}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.bibs_to_create_preview.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <p className="muted">將建立的書目（前 {preview.bibs_to_create_preview.length} 筆）：</p>
                <ul>
                  {preview.bibs_to_create_preview.map((b) => (
                    <li key={b.bib_key}>
                      {b.isbn ? `isbn=${b.isbn}` : b.bib_key} · {b.title ?? '(no title)'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.rows.length > 0 ? (
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>row</th>
                      <th>item_action</th>
                      <th>bib_action</th>
                      <th>barcode</th>
                      <th>call_number</th>
                      <th>location_id</th>
                      <th>isbn</th>
                      <th>title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row_number}>
                        <td>{r.row_number}</td>
                        <td>{r.item_action}</td>
                        <td>{r.bib_action}</td>
                        <td>
                          <code>{r.barcode}</code>
                        </td>
                        <td>{r.call_number}</td>
                        <td>
                          <code style={{ fontSize: 12 }}>{r.location_id}</code>
                        </td>
                        <td>{r.isbn ?? ''}</td>
                        <td>{r.title ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            尚未預覽。建議先下載範本，或貼上 CSV 後按「預覽」。
          </p>
        )}

        {applyResult ? (
          <p className="muted" style={{ marginTop: 12 }}>
            apply 結果：audit_event_id={applyResult.audit_event_id}
          </p>
        ) : null}
      </section>
    </div>
  );
}

