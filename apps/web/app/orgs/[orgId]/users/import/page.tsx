/**
 * Users CSV Import Page（/orgs/:orgId/users/import）
 *
 * 目的（US-010 匯入使用者名冊）：
 * - 讓館員用 CSV 批次新增/更新學生、教師名冊
 * - 每學期/每次名冊更新時，能「預覽」將發生的變更，避免一鍵寫壞資料
 * - 可選擇 roster sync：把「未出現在 CSV」的使用者批次停用（畢業/轉出）
 *
 * 對應 API：
 * - POST /api/v1/orgs/:orgId/users/import（mode=preview|apply）
 *
 * Auth/權限（重要）：
 * - users 匯入屬於敏感操作（大量個資），因此 API 端點受 StaffAuthGuard 保護（需要 Bearer token）
 * - actor_user_id（寫 audit 用）由登入者本人推導（session.user.id），不再提供下拉選擇（避免冒用）
 */

'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type {
  RosterRole,
  UsersCsvImportApplyResult,
  UsersCsvImportPreviewResult,
  UsersCsvImportRowError,
} from '../../../../lib/api';
import {
  ApiError,
  applyUsersCsvImport,
  previewUsersCsvImport,
} from '../../../../lib/api';
import { Alert } from '../../../../components/ui/alert';
import { DataTable } from '../../../../components/ui/data-table';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { formatErrorMessage } from '../../../../lib/error';
import { useStaffSession } from '../../../../lib/use-staff-session';

/**
 * 下載文字檔（CSV template / preview）的小工具
 *
 * - 這種做法不需要後端提供「下載端點」
 * - 在 MVP 階段可以快速提供範例檔，降低現場導入成本
 */
function downloadText(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 從 ApiError.details 取出匯入錯誤（若有）
 *
 * - 我們在 apply 失敗時，仍希望把「列號/原因」清楚顯示出來
 * - 這比只顯示一行 HTTP 400 友善很多
 */
function extractImportErrors(error: unknown): UsersCsvImportRowError[] | null {
  if (!(error instanceof ApiError)) return null;
  const details = error.body?.error?.details as any;
  if (!details || typeof details !== 'object') return null;
  const errors = details.errors;
  if (!Array.isArray(errors)) return null;
  return errors as UsersCsvImportRowError[];
}

export default function UsersImportPage({ params }: { params: { orgId: string } }) {
  // ----------------------------
  // 1) staff session（登入者 / 操作者）
  // ----------------------------

  const { ready: sessionReady, session } = useStaffSession(params.orgId);
  const actorUserId = session?.user.id ?? '';

  // ----------------------------
  // 2) CSV input（檔案/文字）
  // ----------------------------

  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');

  // ----------------------------
  // 3) 匯入選項（default_role / deactivate_missing / note）
  // ----------------------------

  // defaultRole：當 CSV 沒有 role 欄位，或某列 role 為空時使用（常見：整份檔都是學生）
  // - 空字串代表「不指定」，此時 CSV 必須包含 role 欄位
  const [defaultRole, setDefaultRole] = useState<RosterRole | ''>('');

  // roster sync：停用未出現在 CSV 的使用者（畢業/轉出）
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [deactivateStudent, setDeactivateStudent] = useState(true);
  const [deactivateTeacher, setDeactivateTeacher] = useState(false);

  // 操作備註（寫入 audit event metadata）
  const [sourceNote, setSourceNote] = useState('');

  // ----------------------------
  // 4) preview/apply state
  // ----------------------------

  const [preview, setPreview] = useState<UsersCsvImportPreviewResult | null>(null);
  const [applyingResult, setApplyingResult] = useState<UsersCsvImportApplyResult | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<UsersCsvImportRowError[] | null>(null);

  // deactivate_missing_roles：依勾選組出陣列（只送 student/teacher）
  const deactivateMissingRoles = useMemo(() => {
    const roles: RosterRole[] = [];
    if (deactivateStudent) roles.push('student');
    if (deactivateTeacher) roles.push('teacher');
    return roles;
  }, [deactivateStudent, deactivateTeacher]);

  // 小提示：若勾了 deactivate_missing，但 roles 空，等於沒有實際作用
  const deactivateMissingRolesWarning =
    deactivateMissing && deactivateMissingRoles.length === 0 ? '已勾選停用未出現者，但未選任何角色（不會停用任何人）' : null;

  async function onPickFile(file: File | null) {
    setError(null);
    setSuccess(null);
    setImportErrors(null);
    setApplyingResult(null);
    setPreview(null);

    if (!file) return;

    // 記錄檔名（用於 audit）
    setSourceFilename(file.name);

    // FileReader：讀成純文字（假設 UTF-8）
    // - 若學校端用 Excel 匯出，請選「CSV UTF-8」避免 Big5 亂碼
    const reader = new FileReader();

    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvText(text);
    };

    reader.onerror = () => {
      setError('讀取檔案失敗，請重新選擇檔案');
    };

    reader.readAsText(file);
  }

  function onDownloadTemplate() {
    // 範例檔：刻意做成「最常見的名冊形狀」
    // - external_id,name,role,org_unit,status
    // - 也可改成中文 header；後端 mapping 兩者都支援
    const content = [
      'external_id,name,role,org_unit,status',
      'S1130123,王小明,student,501,active',
      'S1130456,李小華,student,502,active',
      'T9001,陳老師,teacher,,active',
      '',
    ].join('\n');

    downloadText('users-import-template.csv', content, 'text/csv;charset=utf-8');
  }

  async function runPreview() {
    setPreviewing(true);
    setApplyingResult(null);
    setError(null);
    setSuccess(null);
    setImportErrors(null);

    try {
      if (!actorUserId) throw new Error('缺少 actor_user_id（請先登入）');

      const text = csvText.trim();
      if (!text) throw new Error('CSV 內容不可為空（請上傳檔案或貼上 CSV）');

      const result = await previewUsersCsvImport(params.orgId, {
        actor_user_id: actorUserId,
        csv_text: text,
        ...(defaultRole ? { default_role: defaultRole } : {}),
        deactivate_missing: deactivateMissing,
        ...(deactivateMissing ? { deactivate_missing_roles: deactivateMissingRoles } : {}),
        ...(sourceFilename ? { source_filename: sourceFilename } : {}),
        ...(sourceNote.trim() ? { source_note: sourceNote.trim() } : {}),
      });

      setPreview(result);

      const errorCount = result.errors.length;
      if (errorCount > 0) {
        setSuccess(`已完成預覽，但有 ${errorCount} 個錯誤需要修正`);
      } else {
        setSuccess(
          `預覽完成：新增 ${result.summary.to_create} / 更新 ${result.summary.to_update} / 不變 ${result.summary.unchanged} / 將停用 ${result.summary.to_deactivate}`,
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
    setApplyingResult(null);
    setError(null);
    setSuccess(null);
    setImportErrors(null);

    try {
      if (!actorUserId) throw new Error('缺少 actor_user_id（請先登入）');

      const text = csvText.trim();
      if (!text) throw new Error('CSV 內容不可為空（請上傳檔案或貼上 CSV）');

      // UX：要求先 preview，並且 preview 必須無錯誤
      if (!preview) throw new Error('請先按「預覽」確認變更與錯誤');
      if (preview.errors.length > 0) throw new Error('預覽仍有錯誤，請先修正 CSV 再套用');

      // 額外防呆：套用前顯示一次 summary
      const ok = window.confirm(
        `確認要套用嗎？\n\n` +
          `新增：${preview.summary.to_create}\n` +
          `更新：${preview.summary.to_update}\n` +
          `不變：${preview.summary.unchanged}\n` +
          `將停用：${preview.summary.to_deactivate}\n\n` +
          `此動作會寫入資料庫並產生稽核事件（audit）。`,
      );
      if (!ok) return;

      const result = await applyUsersCsvImport(params.orgId, {
        actor_user_id: actorUserId,
        csv_text: text,
        ...(defaultRole ? { default_role: defaultRole } : {}),
        deactivate_missing: deactivateMissing,
        ...(deactivateMissing ? { deactivate_missing_roles: deactivateMissingRoles } : {}),
        ...(sourceFilename ? { source_filename: sourceFilename } : {}),
        ...(sourceNote.trim() ? { source_note: sourceNote.trim() } : {}),
      });

      setApplyingResult(result);
      setSuccess(`已套用匯入：audit_event_id=${result.audit_event_id}`);
    } catch (e) {
      setApplyingResult(null);
      setError(formatErrorMessage(e));
      setImportErrors(extractImportErrors(e));
    } finally {
      setApplying(false);
    }
  }

  // 登入門檻（放在所有 hooks 之後，避免違反 React hooks 規則）
  if (!sessionReady) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Users CSV Import</h1>
          <Alert variant="info" title="載入登入狀態中…" role="status" />
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Users CSV Import</h1>
          <Alert variant="danger" title="需要登入">
            這頁需要 staff 登入才能匯入名冊。請先前往 <Link href={`/orgs/${params.orgId}/login`}>/login</Link>。
          </Alert>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Users CSV Import</h1>

        <p className="muted">
          對應 API：<code>POST /api/v1/orgs/:orgId/users/import</code>（mode=preview|apply）
        </p>

        <p className="muted">
          建議流程：<strong>先預覽</strong> → 修正錯誤 → 再套用；套用後可到{' '}
          <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 用 action{' '}
          <code>user.import_csv</code> 查追溯。
        </p>

        <div className="toolbar">
          <div className="toolbarLeft">
            <Link href={`/orgs/${params.orgId}/users`}>← 回 Users</Link>
          </div>
          <div className="toolbarRight">
            <button type="button" className="btnSmall" onClick={onDownloadTemplate} disabled={previewing || applying}>
              下載範例 CSV
            </button>
          </div>
        </div>

        <hr className="divider" />

        <p className="muted">
          actor_user_id（操作者）已鎖定為：<code>{session.user.id}</code>（{session.user.name} /{' '}
          {session.user.role}）
        </p>

        <Form onSubmit={(e) => e.preventDefault()} style={{ marginTop: 12 }}>
          <FormSection title="來源" description="你可以上傳檔案，或直接貼上 CSV 文字（建議 UTF-8）。">
            <Field label="上傳 CSV 檔案（UTF-8）" htmlFor="users_import_file">
              <input
                id="users_import_file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                disabled={previewing || applying}
              />
            </Field>

            <Field
              label="或貼上 CSV 文字（header + data rows）"
              htmlFor="users_import_csv_text"
              hint="例：external_id,name,role,org_unit,status"
            >
              <textarea
                id="users_import_csv_text"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setPreview(null);
                  setApplyingResult(null);
                  setImportErrors(null);
                }}
                rows={10}
                placeholder="external_id,name,role,org_unit,status\nS1130123,王小明,student,501,active\n..."
                style={{ fontFamily: 'var(--font-mono)' }}
                disabled={previewing || applying}
              />
            </Field>

            <div className="muted">
              目前檔名：{sourceFilename ?? '（未選擇）'} · 內容長度：{csvText.length.toLocaleString()} 字元
            </div>
          </FormSection>

          <FormSection title="匯入選項" description="default_role 只在 CSV 沒有 role 欄位或該列 role 為空時使用。">
            <div className="grid2">
              <Field label="default_role（當 CSV 沒有 role 欄位時必填）" htmlFor="users_import_default_role">
                <select
                  id="users_import_default_role"
                  value={defaultRole}
                  onChange={(e) => {
                    setDefaultRole(e.target.value as any);
                    setPreview(null);
                    setApplyingResult(null);
                  }}
                  disabled={previewing || applying}
                >
                  <option value="">（不指定；要求 CSV 內含 role 欄）</option>
                  <option value="student">student（學生）</option>
                  <option value="teacher">teacher（教師）</option>
                </select>
              </Field>

              <Field label="source_note（選填；寫入 audit）" htmlFor="users_import_source_note" hint="例：113-1 學期名冊（學生）">
                <input
                  id="users_import_source_note"
                  value={sourceNote}
                  onChange={(e) => {
                    setSourceNote(e.target.value);
                    setPreview(null);
                    setApplyingResult(null);
                  }}
                  placeholder="例：113-1 學期名冊（學生）"
                  disabled={previewing || applying}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Roster sync（停用未出現在 CSV 的使用者）" description="建議只在你上傳「完整名冊清單」時開啟，避免誤停用。">
            <Field label="deactivate_missing" htmlFor="users_import_deactivate_missing">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  id="users_import_deactivate_missing"
                  type="checkbox"
                  checked={deactivateMissing}
                  onChange={(e) => {
                    setDeactivateMissing(e.target.checked);
                    setPreview(null);
                    setApplyingResult(null);
                  }}
                  disabled={previewing || applying}
                />
                <span className="muted">停用未出現在 CSV 的使用者（畢業/轉出）</span>
              </div>
            </Field>

            <div className="grid2">
              <Field label="包含 student（學生）" htmlFor="users_import_deactivate_student">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    id="users_import_deactivate_student"
                    type="checkbox"
                    checked={deactivateStudent}
                    onChange={(e) => {
                      setDeactivateStudent(e.target.checked);
                      setPreview(null);
                      setApplyingResult(null);
                    }}
                    disabled={!deactivateMissing || previewing || applying}
                  />
                  <span className="muted">student</span>
                </div>
              </Field>

              <Field label="包含 teacher（教師）" htmlFor="users_import_deactivate_teacher">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    id="users_import_deactivate_teacher"
                    type="checkbox"
                    checked={deactivateTeacher}
                    onChange={(e) => {
                      setDeactivateTeacher(e.target.checked);
                      setPreview(null);
                      setApplyingResult(null);
                    }}
                    disabled={!deactivateMissing || previewing || applying}
                  />
                  <span className="muted">teacher</span>
                </div>
              </Field>
            </div>

            {deactivateMissingRolesWarning ? <Alert variant="warning" title={deactivateMissingRolesWarning} /> : null}
          </FormSection>

          <FormSection title="Preview / Apply" description="建議先預覽 → 修正錯誤 → 再套用；套用後可到 Audit Events 查追溯。">
            <FormActions>
              <button type="button" className="btnSmall" onClick={() => void runPreview()} disabled={previewing || applying || !csvText.trim()}>
                {previewing ? '預覽中…' : '預覽'}
              </button>

              <button
                type="button"
                className="btnDanger"
                onClick={() => void runApply()}
                disabled={applying || previewing || !preview || preview.errors.length > 0}
              >
                {applying ? '套用中…' : '套用（Apply）'}
              </button>

              <button
                type="button"
                className="btnSmall"
                onClick={() => {
                  setCsvText('');
                  setSourceFilename(null);
                  setDefaultRole('');
                  setDeactivateMissing(false);
                  setDeactivateStudent(true);
                  setDeactivateTeacher(false);
                  setSourceNote('');
                  setPreview(null);
                  setApplyingResult(null);
                  setError(null);
                  setSuccess(null);
                  setImportErrors(null);
                }}
                disabled={previewing || applying}
              >
                清除
              </button>
            </FormActions>

            {previewing ? <Alert variant="info" title="預覽中…" role="status" /> : null}
            {applying ? <Alert variant="info" title="套用中…" role="status" /> : null}

            {error ? (
              <Alert variant="danger" title="操作失敗">
                {error}
              </Alert>
            ) : null}
            {success ? <Alert variant="success" title={success} role="status" /> : null}
          </FormSection>
        </Form>
      </section>

      {/* preview 結果 */}
      {preview ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Preview 結果</h2>

          <div className="stack">
            <Alert variant="info" title="CSV" role="status">
              <div>
                csv_sha256：<code>{preview.csv.sha256}</code>
              </div>
              <div style={{ marginTop: 6 }}>
                header：<code>{preview.csv.header.join(', ')}</code>
              </div>
            </Alert>

            <Alert variant="info" title="summary" role="status">
              <div>
                total_rows=<code>{preview.summary.total_rows}</code> · valid=<code>{preview.summary.valid_rows}</code> · invalid=
                <code>{preview.summary.invalid_rows}</code>
              </div>
              <div style={{ marginTop: 6 }}>
                新增=<code>{preview.summary.to_create}</code> · 更新=<code>{preview.summary.to_update}</code> · 不變=
                <code>{preview.summary.unchanged}</code> · 將停用=<code>{preview.summary.to_deactivate}</code>
              </div>
            </Alert>

            {preview.errors.length > 0 ? (
              <Alert variant="danger" title={`錯誤（${preview.errors.length}；請先修正再套用）`}>
                <details className="details">
                  <summary>
                    檢視錯誤（前 <code>{Math.min(200, preview.errors.length)}</code> 筆）
                  </summary>
                  <ul style={{ margin: 0, padding: '12px 18px' }}>
                    {preview.errors.slice(0, 200).map((e, idx) => (
                      <li key={`${e.row_number}-${e.code}-${idx}`}>
                        row {e.row_number} · {e.field ?? '-'} · {e.code} · {e.message}
                      </li>
                    ))}
                  </ul>
                  {preview.errors.length > 200 ? <div className="muted" style={{ padding: '0 12px 12px' }}>（只顯示前 200 筆錯誤）</div> : null}
                </details>
              </Alert>
            ) : (
              <Alert variant="success" title="預覽沒有錯誤，可套用" role="status" />
            )}

            <div>
              <h3 style={{ marginTop: 0 }}>Rows（前 {preview.rows.length} 筆）</h3>
              {preview.rows.length === 0 ? (
                <EmptyState title="Rows 為空" description="請確認 CSV 是否有資料列（不含 header）。" />
              ) : (
                <DataTable
                  rows={preview.rows}
                  getRowKey={(r) => `${r.row_number}-${r.external_id}`}
                  initialSort={{ columnId: 'row_number', direction: 'asc' }}
                  columns={[
                    { id: 'row_number', header: 'row', sortValue: (r) => r.row_number, cell: (r) => r.row_number, width: 80 },
                    { id: 'external_id', header: 'external_id', sortValue: (r) => r.external_id, cell: (r) => <code>{r.external_id}</code>, width: 160 },
                    { id: 'name', header: 'name', sortValue: (r) => r.name, cell: (r) => r.name, width: 180 },
                    { id: 'role', header: 'role', sortValue: (r) => r.role, cell: (r) => r.role, width: 120 },
                    { id: 'org_unit', header: 'org_unit', sortValue: (r) => (r.org_unit === undefined ? '(skip)' : r.org_unit ?? ''), cell: (r) => (r.org_unit === undefined ? '（不更新）' : r.org_unit ?? ''), width: 140 },
                    { id: 'status', header: 'status', sortValue: (r) => (r.status === undefined ? '(skip)' : r.status), cell: (r) => (r.status === undefined ? '（不更新）' : r.status), width: 140 },
                    { id: 'action', header: 'action', sortValue: (r) => r.action, cell: (r) => r.action, width: 120 },
                    { id: 'changes', header: 'changes', sortValue: (r) => r.changes.join(', '), cell: (r) => r.changes.join(', ') },
                  ]}
                />
              )}
            </div>

          {preview.options.deactivate_missing ? (
            <>
              <div>
                <h3 style={{ marginTop: 0 }}>將停用的使用者（前 {preview.to_deactivate_preview.length} 筆）</h3>
                {preview.to_deactivate_preview.length === 0 ? (
                  <EmptyState title="沒有將被停用的使用者" description="代表這次名冊沒有命中任何「需要停用」的使用者。" />
                ) : (
                  <DataTable
                    rows={preview.to_deactivate_preview}
                    getRowKey={(r) => r.id}
                    initialSort={{ columnId: 'external_id', direction: 'asc' }}
                    columns={[
                      { id: 'external_id', header: 'external_id', sortValue: (r) => r.external_id, cell: (r) => <code>{r.external_id}</code>, width: 160 },
                      { id: 'name', header: 'name', sortValue: (r) => r.name, cell: (r) => r.name, width: 180 },
                      { id: 'role', header: 'role', sortValue: (r) => r.role, cell: (r) => r.role, width: 120 },
                      { id: 'status', header: 'status', sortValue: (r) => r.status, cell: (r) => r.status, width: 140 },
                    ]}
                  />
                )}
              </div>
            </>
          ) : null}
          </div>
        </section>
      ) : null}

      {/* apply 結果 */}
      {applyingResult ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Apply 結果</h2>

          <Alert variant="success" title="已完成匯入" role="status">
            audit_event_id：<Link href={`/orgs/${params.orgId}/audit-events`}>{applyingResult.audit_event_id}</Link>
          </Alert>

          <Alert variant="info" title="summary" role="status">
            新增=<code>{applyingResult.summary.to_create}</code> · 更新=<code>{applyingResult.summary.to_update}</code> · 不變=
            <code>{applyingResult.summary.unchanged}</code> · 已停用=<code>{applyingResult.summary.to_deactivate}</code>
          </Alert>

          <div className="muted">
            → 到 <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 用 action <code>user.import_csv</code> 查追溯
          </div>
        </section>
      ) : null}

      {/* apply 失敗時的詳細錯誤（若後端有回 details） */}
      {importErrors && importErrors.length > 0 ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>API 回傳的匯入錯誤</h2>
          <Alert variant="danger" title={`errors=${importErrors.length}`}>
            <details className="details">
              <summary>
                檢視錯誤（前 <code>{Math.min(200, importErrors.length)}</code> 筆）
              </summary>
              <ul style={{ margin: 0, padding: '12px 18px' }}>
                {importErrors.slice(0, 200).map((e, idx) => (
                  <li key={`${e.row_number}-${e.code}-${idx}`}>
                    row {e.row_number} · {e.field ?? '-'} · {e.code} · {e.message}
                  </li>
                ))}
              </ul>
              {importErrors.length > 200 ? <div className="muted" style={{ padding: '0 12px 12px' }}>（只顯示前 200 筆錯誤）</div> : null}
            </details>
          </Alert>
        </section>
      ) : null}
    </div>
  );
}
