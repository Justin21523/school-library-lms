/**
 * Next.js App Router：首頁（/）
 *
 * `app/page.tsx` 對應根路由 `/`。
 * 目前只放一個「提示頁」，告訴你倉庫的重點文件在哪裡。
 */

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container">
      <div className="stack">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>國中小學雲端圖書館系統</h1>
          <p className="muted">
            目前倉庫以「可開發的規格文件」＋「可跑起來的 API/Web 骨架」為主。
          </p>

          {/* 這些是 repo 內的文件路徑；Web 本身不會直接 serve 這些檔案。 */}
          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <code>README.md</code>
            </li>
            <li>
              <code>MVP-SPEC.md</code>
            </li>
            <li>
              <code>API-DRAFT.md</code>
            </li>
            <li>
              <code>DATA-DICTIONARY.md</code>
            </li>
            <li>
              <code>db/schema.sql</code>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>開始操作（Web Console）</h2>
          <p className="muted">
            目前 Web 會以「直接呼叫既有 API」的方式逐步補齊功能；第一步從建立/選擇
            organization 開始。
          </p>
          <Link href="/orgs">前往 Organizations</Link>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>讀者端（OPAC）</h2>
          <p className="muted">
            OPAC 提供讀者自助的查詢與預約流程（MVP 目前尚未做登入，因此會以{' '}
            <code>user_external_id</code> 作為臨時識別）。
          </p>
          <Link href="/opac">前往 OPAC</Link>
        </section>
      </div>
    </main>
  );
}
