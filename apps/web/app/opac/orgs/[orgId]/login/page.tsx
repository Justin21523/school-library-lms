/**
 * OPAC Login Page（/opac/orgs/:orgId/login）
 *
 * 目的：
 * - 讓讀者（student/teacher）在單一 org 範圍內登入，取得 Patron Bearer token
 * - 登入後：
 *   - 前端會把 access_token 存到 localStorage（依 orgId）
 *   - apps/web/app/lib/api.ts 會在呼叫 `/me/*` 時自動帶上 Authorization header
 *   - 後端 PatronAuthGuard 會驗證 token，並保證 `/me/*` 只回本人資料
 *
 * MVP 登入策略：
 * - 先採 external_id + password（與 staff 相同形狀）
 * - password 由館員在 Web Console 的 Users 頁用「設定/重設密碼」建立（或未來接 SSO）
 */

'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { patronLogin } from '../../../../lib/api';
import { Alert } from '../../../../components/ui/alert';
import { Field, Form, FormActions, FormSection } from '../../../../components/ui/form';
import { PageHeader } from '../../../../components/ui/page-header';
import { formatErrorMessage } from '../../../../lib/error';
import { saveOpacSession } from '../../../../lib/opac-session';

export default function OpacLoginPage({ params }: { params: { orgId: string } }) {
  const router = useRouter();

  // external_id：學號/員編
  const [externalId, setExternalId] = useState('');

  // password：讀者密碼（由館員設定；或未來串接 SSO/PIN）
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

      const result = await patronLogin(params.orgId, {
        external_id: trimmedExternalId,
        password: trimmedPassword,
      });

      // 保存 OPAC session（依 orgId）
      saveOpacSession(params.orgId, {
        access_token: result.access_token,
        expires_at: result.expires_at,
        user: result.user,
      });

      setSuccess(`登入成功：${result.user.name} (${result.user.role})`);

      // UX：稍微延遲，讓使用者看到成功訊息
      setTimeout(() => {
        router.push(`/opac/orgs/${params.orgId}`);
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
        title="OPAC Login"
        description={
          <>
            你正在登入 organization：<code>{params.orgId}</code>。登入後系統會把 <code>Authorization: Bearer</code>{' '}
            token 存在瀏覽器（localStorage），用於存取 <code>/me/*</code>（我的借閱/我的預約）。
          </>
        }
      >
        {error ? (
          <Alert variant="danger" title="登入失敗">
            {error}
            {error.includes('PASSWORD_NOT_SET') ? (
              <>
                <br />
                <span className="muted">提示：此帳號尚未設定密碼；請請館員到 Web Console → Users 使用「設定/重設密碼」先設定。</span>
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
          <FormSection title="登入" description="使用讀者帳號（student/teacher）登入 OPAC。">
            <div className="grid2">
              <Field label="external_id（學號/員編）" htmlFor="opac_external_id">
                <input
                  id="opac_external_id"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="例：S1130123"
                  autoComplete="username"
                />
              </Field>

              <Field label="password" htmlFor="opac_password">
                <input
                  id="opac_password"
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
              <Link href={`/opac/orgs/${params.orgId}`}>回到搜尋</Link>
              <Link href="/opac/orgs">切換學校</Link>
            </FormActions>
          </FormSection>
        </Form>
      </PageHeader>
    </div>
  );
}
