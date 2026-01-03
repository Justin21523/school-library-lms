/**
 * Bootstrap Set Password Page（/orgs/:orgId/bootstrap-set-password）
 *
 * 這頁是「初始化用」的 UI：呼叫後端的 bootstrap endpoint 來替 staff（admin/librarian）設定第一組密碼。
 *
 * 為什麼需要？
 * - 第一次導入時：user_credentials 表通常是空的 → 沒有人能登入 → 也就無法用 `/auth/set-password`（需要 staff token）
 * - 因此後端提供一次性的 `/auth/bootstrap-set-password`：
 *   - 需要 `AUTH_BOOTSTRAP_SECRET`（環境變數）作為通關密語
 *   - 若未設定，後端會回 BOOTSTRAP_DISABLED（避免 production 誤開）
 *
 * 安全注意（很重要）：
 * - 這頁不會把 bootstrap secret 存到 localStorage / cookie / URL query。
 * - 你必須「手動貼上」 bootstrap secret；完成後即可清空。
 * - 實務上建議只在 dev/staging 使用；production 建議改用更正式的初始化流程（一次性邀請連結、或 migration 寫入）。
 */

'use client';

import { useState } from 'react';

import Link from 'next/link';

import { bootstrapSetStaffPassword } from '../../../lib/api';
import { Alert } from '../../../components/ui/alert';
import { Field, Form, FormActions, FormSection } from '../../../components/ui/form';
import { PageHeader } from '../../../components/ui/page-header';
import { formatErrorMessage } from '../../../lib/error';

export default function BootstrapSetPasswordPage({ params }: { params: { orgId: string } }) {
  // bootstrapSecret：由操作者手動輸入；不保存、不記錄、不寫入 URL
  const [bootstrapSecret, setBootstrapSecret] = useState('');

  // targetExternalId：要設定密碼的目標（必須是 staff：admin/librarian）
  const [targetExternalId, setTargetExternalId] = useState('');

  // newPassword / confirmPassword：避免手滑打錯（confirmPassword 不送到後端）
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // note：可選，用於寫入 audit metadata（方便日後追溯初始化時做了什麼）
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const trimmedSecret = bootstrapSecret.trim();
      const trimmedExternalId = targetExternalId.trim();

      if (!trimmedSecret) throw new Error('bootstrap_secret 不可為空');
      if (!trimmedExternalId) throw new Error('target_external_id 不可為空');
      if (!newPassword) throw new Error('new_password 不可為空');
      if (newPassword !== confirmPassword) throw new Error('兩次輸入的新密碼不一致');

      await bootstrapSetStaffPassword(params.orgId, {
        bootstrap_secret: trimmedSecret,
        target_external_id: trimmedExternalId,
        new_password: newPassword,
        ...(note.trim() ? { note: note.trim() } : {}),
      });

      setSuccess(`已設定密碼：${trimmedExternalId}（建議立刻到 Staff Login 驗證可登入）`);

      // UX：成功後清空密語與密碼欄位，避免不小心留在畫面上。
      setBootstrapSecret('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Bootstrap：Set Staff Password"
        description={
          <>
            你正在操作 organization：<code>{params.orgId}</code> · 對應 API：
            <code>POST /api/v1/orgs/:orgId/auth/bootstrap-set-password</code>
          </>
        }
      >
        <Alert variant="warning" title="高風險操作">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              需要後端環境變數：<code>AUTH_BOOTSTRAP_SECRET</code>
            </li>
            <li>本頁不會保存 secret；請勿把 secret 放在一般 UI 或文件中</li>
            <li>此功能主要給 dev/staging 初始化；production 建議採用更正式的流程</li>
          </ul>
        </Alert>

        {error ? (
          <Alert variant="danger" title="設定失敗">
            {error}
            {error.includes('BOOTSTRAP_DISABLED') ? (
              <>
                <br />
                <span className="muted">
                  提示：後端尚未設定 <code>AUTH_BOOTSTRAP_SECRET</code>，因此 bootstrap 被停用。
                </span>
              </>
            ) : null}
          </Alert>
        ) : null}

        {success ? (
          <Alert variant="success" title="已完成" role="status">
            {success}
          </Alert>
        ) : null}

        <Form onSubmit={onSubmit}>
          <FormSection title="設定密碼" description="完成後建議立刻到 Staff Login 驗證可登入。">
            <Field label="bootstrap_secret（AUTH_BOOTSTRAP_SECRET）" htmlFor="bootstrap_secret">
              <input
                id="bootstrap_secret"
                type="password"
                value={bootstrapSecret}
                onChange={(e) => setBootstrapSecret(e.target.value)}
                placeholder="貼上一次性密語"
                autoComplete="off"
              />
            </Field>

            <Field label="target_external_id（要設定密碼的 staff）" htmlFor="target_external_id" hint="必須是 admin/librarian">
              <input
                id="target_external_id"
                value={targetExternalId}
                onChange={(e) => setTargetExternalId(e.target.value)}
                placeholder="例：A0001"
              />
            </Field>

            <div className="grid2">
              <Field label="new_password" htmlFor="bootstrap_new_password">
                <input
                  id="bootstrap_new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>

              <Field label="confirm_password" htmlFor="bootstrap_confirm_password">
                <input
                  id="bootstrap_confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <Field label="note（選填）" htmlFor="bootstrap_note">
              <input
                id="bootstrap_note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例：dev bootstrap init"
              />
            </Field>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '設定中…' : '設定密碼'}
              </button>
              <Link href={`/orgs/${params.orgId}/login`}>前往 Staff Login</Link>
              <Link href={`/orgs/${params.orgId}`}>回到 Dashboard</Link>
            </FormActions>
          </FormSection>
        </Form>
      </PageHeader>
    </div>
  );
}
