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
 * MVP 權限策略（沒有 auth）：
 * - 這個功能會處理大量個資（姓名/學號），因此必須由前端提供 actor_user_id
 * - 後端會驗證 actor 必須是 active 的 admin/librarian（最小 RBAC）
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import type {
  RosterRole,
  User,
  UsersCsvImportApplyResult,
  UsersCsvImportPreviewResult,
  UsersCsvImportRowError,
} from '../../../../lib/api';
import {
  ApiError,
  applyUsersCsvImport,
  listUsers,
  previewUsersCsvImport,
} from '../../../../lib/api';
import { formatErrorMessage } from '../../../../lib/error';

// actor 候選人：必須是 active 的 admin/librarian（對齊後端最小 RBAC）
function isActorCandidate(user: User) {
  return user.status === 'active' && (user.role === 'admin' || user.role === 'librarian');
}

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
  // 1) actor（操作者）選擇
  // ----------------------------

  const [users, setUsers] = useState<User[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actorUserId, setActorUserId] = useState('');

  const actorCandidates = useMemo(() => (users ?? []).filter(isActorCandidate), [users]);

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

  // 初次載入：抓 users（讓館員選 actor）
  useEffect(() => {
    async function run() {
      setLoadingUsers(true);
      setError(null);
      try {
        const result = await listUsers(params.orgId);
        setUsers(result);

        // 若尚未選 actor，就預設第一個可用館員（提升可用性）
        if (!actorUserId) {
          const first = result.find(isActorCandidate);
          if (first) setActorUserId(first.id);
        }
      } catch (e) {
        setUsers(null);
        setError(formatErrorMessage(e));
      } finally {
        setLoadingUsers(false);
      }
    }

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgId]);

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
      if (!actorUserId) throw new Error('請先選擇 actor_user_id（館員/管理者）');

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
      if (!actorUserId) throw new Error('請先選擇 actor_user_id（館員/管理者）');

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

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/orgs/${params.orgId}/users`}>← 回 Users</Link>
          <button type="button" onClick={onDownloadTemplate}>
            下載範例 CSV
          </button>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <label>
          actor_user_id（操作者：admin/librarian）
          <select value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} disabled={loadingUsers}>
            <option value="">（請選擇）</option>
            {actorCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role}) · {u.external_id}
              </option>
            ))}
          </select>
        </label>

        {loadingUsers ? <p className="muted">載入可用操作者中…</p> : null}

        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label>
            上傳 CSV 檔案（UTF-8）
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label>
            或貼上 CSV 文字（header + data rows）
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setPreview(null);
                setApplyingResult(null);
              }}
              rows={10}
              placeholder="external_id,name,role,org_unit,status\nS1130123,王小明,student,501,active\n..."
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
          </label>

          <div className="muted">
            目前檔名：{sourceFilename ?? '（未選擇）'} · 內容長度：{csvText.length.toLocaleString()} 字元
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            default_role（當 CSV 沒有 role 欄位時必填）
            <select value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as any)}>
              <option value="">（不指定；要求 CSV 內含 role 欄）</option>
              <option value="student">student（學生）</option>
              <option value="teacher">teacher（教師）</option>
            </select>
          </label>

          <label>
            source_note（操作備註；寫入 audit；選填）
            <input
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="例：113-1 學期名冊（學生）"
            />
          </label>

          <div className="panel" style={{ background: 'var(--bgSubtle)' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={deactivateMissing}
                  onChange={(e) => setDeactivateMissing(e.target.checked)}
                />
                停用未出現在 CSV 的使用者（roster sync；畢業/轉出）
              </label>

              <div className="muted" style={{ marginLeft: 24 }}>
                <div>建議：只在你上傳「完整名冊清單」時開啟，避免誤停用。</div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginLeft: 24 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={deactivateStudent}
                    onChange={(e) => setDeactivateStudent(e.target.checked)}
                    disabled={!deactivateMissing}
                  />
                  student（學生）
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={deactivateTeacher}
                    onChange={(e) => setDeactivateTeacher(e.target.checked)}
                    disabled={!deactivateMissing}
                  />
                  teacher（教師）
                </label>
              </div>

              {deactivateMissingRolesWarning ? <div className="error">{deactivateMissingRolesWarning}</div> : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void runPreview()} disabled={previewing}>
              {previewing ? '預覽中…' : '預覽'}
            </button>

            <button
              type="button"
              onClick={() => void runApply()}
              disabled={applying || !preview || preview.errors.length > 0}
            >
              {applying ? '套用中…' : '套用（Apply）'}
            </button>

            <button
              type="button"
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
          </div>

          {error ? <p className="error">錯誤：{error}</p> : null}
          {success ? <p className="success">{success}</p> : null}
        </div>
      </section>

      {/* preview 結果 */}
      {preview ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Preview 結果</h2>

          <div className="muted" style={{ display: 'grid', gap: 6 }}>
            <div>
              csv_sha256：<code>{preview.csv.sha256}</code>
            </div>
            <div>
              header：<code>{preview.csv.header.join(', ')}</code>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <div style={{ display: 'grid', gap: 6 }}>
            <div>
              共有 <strong>{preview.summary.total_rows}</strong> 列資料（不含 header）
            </div>
            <div className="muted">
              valid={preview.summary.valid_rows} · invalid={preview.summary.invalid_rows}
            </div>
            <div className="muted">
              新增={preview.summary.to_create} · 更新={preview.summary.to_update} · 不變={preview.summary.unchanged} ·
              將停用={preview.summary.to_deactivate}
            </div>
          </div>

          {preview.errors.length > 0 ? (
            <>
              <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />
              <h3 style={{ marginTop: 0 }}>錯誤（請先修正再套用）</h3>
              <ul>
                {preview.errors.slice(0, 200).map((e, idx) => (
                  <li key={`${e.row_number}-${e.code}-${idx}`}>
                    row {e.row_number} · {e.field ?? '-'} · {e.code} · {e.message}
                  </li>
                ))}
              </ul>
              {preview.errors.length > 200 ? <p className="muted">（只顯示前 200 筆錯誤）</p> : null}
            </>
          ) : (
            <p className="success">預覽沒有錯誤，可套用。</p>
          )}

          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <h3 style={{ marginTop: 0 }}>Rows（前 {preview.rows.length} 筆）</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>row</th>
                  <th>external_id</th>
                  <th>name</th>
                  <th>role</th>
                  <th>org_unit</th>
                  <th>status</th>
                  <th>action</th>
                  <th>changes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={`${r.row_number}-${r.external_id}`}>
                    <td>{r.row_number}</td>
                    <td>{r.external_id}</td>
                    <td>{r.name}</td>
                    <td>{r.role}</td>
                    <td>{r.org_unit === undefined ? '（不更新）' : r.org_unit ?? ''}</td>
                    <td>{r.status === undefined ? '（不更新）' : r.status}</td>
                    <td>{r.action}</td>
                    <td>{r.changes.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.options.deactivate_missing ? (
            <>
              <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />
              <h3 style={{ marginTop: 0 }}>
                將停用的使用者（前 {preview.to_deactivate_preview.length} 筆）
              </h3>
              {preview.to_deactivate_preview.length === 0 ? (
                <p className="muted">（沒有將被停用的使用者）</p>
              ) : (
                <ul>
                  {preview.to_deactivate_preview.map((u) => (
                    <li key={u.id}>
                      {u.external_id} · {u.name} · {u.role} · {u.status}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {/* apply 結果 */}
      {applyingResult ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Apply 結果</h2>

          <p className="success">
            已完成匯入：audit_event_id=<code>{applyingResult.audit_event_id}</code>
          </p>
          <p className="muted">
            新增={applyingResult.summary.to_create} · 更新={applyingResult.summary.to_update} · 不變=
            {applyingResult.summary.unchanged} · 已停用={applyingResult.summary.to_deactivate}
          </p>

          <p>
            → 到 <Link href={`/orgs/${params.orgId}/audit-events`}>Audit Events</Link> 用 action{' '}
            <code>user.import_csv</code> 查追溯
          </p>
        </section>
      ) : null}

      {/* apply 失敗時的詳細錯誤（若後端有回 details） */}
      {importErrors && importErrors.length > 0 ? (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>API 回傳的匯入錯誤</h2>
          <ul>
            {importErrors.slice(0, 200).map((e, idx) => (
              <li key={`${e.row_number}-${e.code}-${idx}`}>
                row {e.row_number} · {e.field ?? '-'} · {e.code} · {e.message}
              </li>
            ))}
          </ul>
          {importErrors.length > 200 ? <p className="muted">（只顯示前 200 筆錯誤）</p> : null}
        </section>
      ) : null}
    </div>
  );
}
