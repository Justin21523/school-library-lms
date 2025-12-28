'use client';

/**
 * Route Error Boundary（MARC Import）
 *
 * MARC 匯入頁會在瀏覽器端做：
 * - 讀檔（FileReader）
 * - 解析 ISO2709/MARCXML/JSON
 *
 * 若遇到來源資料不合法（例如 MARC-8、破損 XML）或程式 bug，
 * 沒有 error boundary 時使用者可能只看到「頁面壞掉」。
 *
 * 加上 error.tsx 的目的：
 * - 讓錯誤可讀且可重試
 * - 引導使用者回到 Bibs / MARC21 編輯器 進一步人工修正/補欄位
 */

import { useEffect } from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function MarcImportErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[import-marc] route error', error);
  }, [error]);

  const params = useParams();
  const orgId = typeof params?.orgId === 'string' ? params.orgId : '';

  return (
    <div className="stack">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>MARC Import（發生錯誤）</h1>
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
          {orgId ? <Link href={`/orgs/${orgId}/bibs`}>回 Bibs</Link> : null}
          {orgId ? <Link href={`/orgs/${orgId}/bibs/marc-editor`}>MARC21 編輯器</Link> : null}
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          常見原因：來源檔案不是 UTF-8（例如 MARC-8）、XML 破損、或欄位內容不符合 ISO2709 目錄長度。
        </p>
      </section>
    </div>
  );
}

