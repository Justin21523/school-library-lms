/**
 * OPAC 首頁（/opac）
 *
 * 讀者端在 MVP 階段先提供：
 * - 選擇學校（org）
 * - 搜尋書目並預約（place hold）
 * - 查詢/取消自己的預約
 *
 * 版本演進：
 * - 已支援 OPAC Account（讀者登入）：可安全使用 `/me/*`（我的借閱/我的預約）
 * - 仍保留 `user_external_id` 模式作為過渡（可用但不安全）
 */

import Link from 'next/link';

export default function OpacHomePage() {
  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>OPAC（讀者自助）</h1>
        <p className="muted">
          這裡是讀者端入口：先選擇學校（organization），再搜尋書目並預約（holds），或查詢/取消自己的預約。
        </p>

        <p className="muted">
          建議使用 OPAC Account 登入（student/teacher），以安全地查看「我的借閱/我的預約」；未登入時仍可用{' '}
          <code>user_external_id</code>（學號/員編）進行預約（過渡模式）。
        </p>

        <Link href="/opac/orgs">開始使用：選擇學校</Link>
      </section>
    </div>
  );
}
