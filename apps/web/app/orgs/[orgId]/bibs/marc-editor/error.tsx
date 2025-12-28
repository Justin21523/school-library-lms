'use client';

/**
 * Route Error Boundary（MARC21 編輯器）
 *
 * 使用者回報「MARC21 編輯器頁面顯示壞掉」時，Next.js 在 dev 會顯示紅色 overlay；
 * 但在某些情境（或 production）可能只會看到空白/不易理解的錯誤頁。
 *
 * 因此我們在這個 route segment 加上 error.tsx：
 * - 把 client-side exception 變成可讀訊息
 * - 引導使用者回到 Authority Terms / Bibs / Login
 * - 也方便你貼給我 console error 以便定位根因
 */

import { useEffect } from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function MarcEditorErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 讓錯誤至少會出現在 browser console（方便你截圖/貼給我）。
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[marc-editor] route error', error);
  }, [error]);

  const params = useParams();
  const orgId = typeof params?.orgId === 'string' ? params.orgId : '';

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>MARC21 編輯器（發生錯誤）</h1>
        <p className="error" style={{ whiteSpace: 'pre-wrap' }}>
          {error.message}
        </p>
        {error.digest ? (
          <p className="muted">
            digest：<code>{error.digest}</code>
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" onClick={() => reset()}>
            重試
          </button>
          <Link href="/orgs">回到 org 列表</Link>
          {orgId ? <Link href={`/orgs/${orgId}/login`}>Staff Login</Link> : null}
          {orgId ? <Link href={`/orgs/${orgId}/authority-terms`}>Authority Terms</Link> : null}
          {orgId ? <Link href={`/orgs/${orgId}/bibs`}>Bibs</Link> : null}
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          若你方便，請把瀏覽器 console 的錯誤訊息貼給我（通常會比「頁面壞掉」更好定位）。
        </p>
      </section>
    </div>
  );
}

