'use client';

/**
 * Org Route Error Boundary（/orgs/:orgId/*）
 *
 * 使用者回報「某些編目/權威頁面進不去」時，
 * Next.js 在 dev 會顯示紅色 overlay，但在 production 常會變成不易理解的空白/錯誤頁。
 *
 * 我們在 org segment 放一個 error.tsx，讓：
 * - 任何子頁（authority/MARC/circulation…）炸掉時，都能顯示可讀的錯誤訊息
 * - 方便你直接把 digest/message 貼給我定位根因
 */

import { useEffect } from 'react';

import Link from 'next/link';

import { Alert } from '../../components/ui/alert';
import { PageHeader } from '../../components/ui/page-header';

export default function OrgErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[org] route error', error);
  }, [error]);

  return (
    <div className="stack">
      <PageHeader title="頁面發生錯誤" description="這通常代表前端程式在此頁面遇到例外（或某個依賴未正確啟動）。" />

      <section className="panel">
        <Alert variant="danger" title="錯誤訊息">
          <div style={{ whiteSpace: 'pre-wrap' }}>{error.message}</div>
        </Alert>

        {error.digest ? (
          <div className="muted" style={{ marginTop: 10 }}>
            digest：<code>{error.digest}</code>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btnPrimary" onClick={() => reset()}>
            重試
          </button>
          <Link href="/orgs">回到 org 列表</Link>
          <Link href="..">回上一層</Link>
        </div>

        <div className="muted" style={{ marginTop: 12, lineHeight: 1.45 }}>
          提示：左側 sidebar footer 會顯示「登入狀態」與「API 狀態」（/health + DB probe），可用來快速判斷是否是 API/DB 未啟動造成的連線問題。
        </div>
      </section>
    </div>
  );
}

