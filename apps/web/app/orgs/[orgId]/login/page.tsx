/**
 * Staff Login Page（/orgs/:orgId/login）
 *
 * 目的：
 * - 讓 Web Console（staff）在單一 org 範圍內登入，取得 Bearer token
 * - 登入後：
 *   - 前端會把 access_token 存到 localStorage（依 orgId）
 *   - apps/web/app/lib/api.ts 會自動帶上 Authorization header
 *   - 後端 StaffAuthGuard 會驗證 token，並要求 actor_user_id 必須等於登入者（避免冒用）
 */

'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { staffLogin } from '../../../lib/api';
import { Alert } from '../../../components/ui/alert';
import { Field, Form, FormActions, FormSection } from '../../../components/ui/form';
import { PageHeader } from '../../../components/ui/page-header';
import { formatErrorMessage } from '../../../lib/error';
import { saveStaffSession } from '../../../lib/staff-session';

export default function OrgLoginPage({ params }: { params: { orgId: string } }) {
  const router = useRouter();

  // external_id：員編（或 admin 的識別碼）
  const [externalId, setExternalId] = useState('');

  // password：staff 密碼（由 admin 設定；或 bootstrap 初始化）
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const trimmedExternalId = externalId.trim();
      const trimmedPassword = password;

      if (!trimmedExternalId) throw new Error('external_id 不可為空');
      if (!trimmedPassword) throw new Error('password 不可為空');

      const result = await staffLogin(params.orgId, {
        external_id: trimmedExternalId,
        password: trimmedPassword,
      });

      // 保存 session（依 orgId）
      saveStaffSession(params.orgId, {
        access_token: result.access_token,
        expires_at: result.expires_at,
        user: result.user,
      });

      setSuccess(`登入成功：${result.user.name} (${result.user.role})`);

      // UX：稍微延遲，讓使用者看到成功訊息
      setTimeout(() => {
        router.push(`/orgs/${params.orgId}`);
      }, 300);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Staff Login"
        description={
          <>
            你正在登入 organization：<code>{params.orgId}</code>。登入後系統會把 <code>Authorization: Bearer</code>{' '}
            token 存在瀏覽器（localStorage），並在 Web Console 呼叫 API 時自動帶上。
          </>
        }
      >
        {error ? (
          <Alert variant="danger" title="登入失敗">
            {error}
            {error.includes('PASSWORD_NOT_SET') ? (
              <>
                <br />
                <span className="muted">
                  提示：此帳號尚未設定密碼；若是第一次初始化，可用{' '}
                  <Link href={`/orgs/${params.orgId}/bootstrap-set-password`}>Bootstrap Set Password</Link>（需要{' '}
                  <code>AUTH_BOOTSTRAP_SECRET</code>）。
                </span>
              </>
            ) : null}
          </Alert>
        ) : null}

        {success ? (
          <Alert variant="success" title="登入成功" role="status">
            {success}
          </Alert>
        ) : null}

        <Form onSubmit={onSubmit}>
          <FormSection title="登入" description="使用館員帳號（admin/librarian）登入後台。">
            <div className="grid2">
              <Field label="external_id（員編）" htmlFor="staff_external_id">
                <input
                  id="staff_external_id"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="例：A0001"
                  autoComplete="username"
                />
              </Field>

              <Field label="password" htmlFor="staff_password">
                <input
                  id="staff_password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
            </div>

            <FormActions>
              <button type="submit" className="btnPrimary" disabled={loading}>
                {loading ? '登入中…' : '登入'}
              </button>
              <Link href={`/orgs/${params.orgId}`}>回到 Dashboard</Link>
            </FormActions>
          </FormSection>
        </Form>
      </PageHeader>
    </div>
  );
}
