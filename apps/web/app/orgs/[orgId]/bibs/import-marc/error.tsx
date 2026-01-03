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

import { Alert } from '../../../../components/ui/alert';
import { PageHeader } from '../../../../components/ui/page-header';

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
      <PageHeader
        title="MARC Import（發生錯誤）"
        description="這頁在瀏覽器端會做檔案解析與草稿生成；若來源檔案格式不合法或遇到程式 bug，會在這裡顯示。"
        actions={
          <button type="button" className="btnSmall btnPrimary" onClick={() => reset()}>
            重試
          </button>
        }
      >
        <Alert variant="danger" title="錯誤訊息">
          <div style={{ whiteSpace: 'pre-wrap' }}>{error.message}</div>
        </Alert>
        {error.digest ? (
          <p className="muted">
            digest：<code>{error.digest}</code>
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Link className="btnSmall" href="/orgs">
            回到 org 列表
          </Link>
          {orgId ? (
            <Link className="btnSmall" href={`/orgs/${orgId}/bibs`}>
              回 Bibs
            </Link>
          ) : null}
          {orgId ? (
            <Link className="btnSmall" href={`/orgs/${orgId}/bibs/marc-editor`}>
              MARC21 編輯器
            </Link>
          ) : null}
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          常見原因：來源檔案不是 UTF-8（例如 MARC-8）、XML 破損、或欄位內容不符合 ISO2709 目錄長度。
        </p>
      </PageHeader>
    </div>
  );
}
