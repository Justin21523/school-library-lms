/**
 * Organization Layout（單一 organization 的導覽框架）
 *
 * 本輪重點：把導覽 UI 從「超長清單」升級成「taxonomy 式階層導覽 + 可收合/可調整寬度」。
 *
 * 實作策略：
 * - 導覽資訊（IA）集中在 `app/lib/console-nav.ts`（單一真相來源）
 * - layout.tsx 保持乾淨：只負責把 orgId 交給 OrgShell
 * - 互動（收合、拖拉、tooltip、breadcrumbs）全部在 Client Component 處理
 */

import type { ReactNode } from 'react';

import { OrgShell } from '../../components/layout/org-shell';

export default function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { orgId: string };
}) {
  // orgId 來自動態路由段：/orgs/[orgId]/...
  const { orgId } = params;

  return <OrgShell orgId={orgId}>{children}</OrgShell>;
}
