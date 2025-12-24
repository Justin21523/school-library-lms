/**
 * OPAC 首頁（/opac）
 *
 * 讀者端在 MVP 階段先提供：
 * - 選擇學校（org）
 * - 搜尋書目並預約（place hold）
 * - 查詢/取消自己的預約
 *
 * 注意：目前沒有登入，因此「查詢/取消」是用 `user_external_id` 來定位讀者。
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
          MVP 尚未實作登入，因此會使用 <code>user_external_id</code>（學號/員編）作為讀者識別。
        </p>

        <Link href="/opac/orgs">開始使用：選擇學校</Link>
      </section>
    </div>
  );
}

