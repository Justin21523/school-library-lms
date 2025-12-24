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
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Staff Login</h1>

        <p className="muted">
          你正在登入 organization：<code>{params.orgId}</code>
        </p>

        <p className="muted">
          登入後系統會把 <code>Authorization: Bearer</code> token 存在瀏覽器（localStorage），並在 Web Console 呼叫 API 時自動帶上。
        </p>

        <form onSubmit={onSubmit} className="stack" style={{ marginTop: 12 }}>
          <label>
            external_id（員編）
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="例：A0001" />
          </label>

          <label>
            password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? '登入中…' : '登入'}
          </button>
        </form>

        {error ? (
          <p className="error">
            錯誤：{error}
            {error.includes('PASSWORD_NOT_SET') ? (
              <>
                <br />
                <span className="muted">
                  提示：此帳號尚未設定密碼；請由 admin 使用 bootstrap 或 set-password 先設定。
                </span>
              </>
            ) : null}
          </p>
        ) : null}
        {success ? <p className="success">{success}</p> : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={`/orgs/${params.orgId}`}>回到 Dashboard</Link>
        </div>
      </section>
    </div>
  );
}
