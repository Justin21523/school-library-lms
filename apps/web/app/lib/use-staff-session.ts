/**
 * useStaffSession（React hook）
 *
 * 目的：
 * - 在 Client Component 中讀取 localStorage 的 staff session（Bearer token）
 * - 提供「ready」狀態，避免 SSR/hydration 階段 UI 閃爍
 *
 * 為什麼需要「ready」？
 * - Next.js App Router：Client Component 仍可能先被 SSR 產出 HTML
 * - SSR 階段沒有 window/localStorage，因此我們只能在瀏覽器端（useEffect）讀取
 * - 若沒有 ready，頁面會先渲染成「未登入」→ hydration 後又變「已登入」，造成 UX 閃爍
 */

'use client';

import { useEffect, useState } from 'react';

import type { StaffSession } from './staff-session';
import { clearStaffSession, loadStaffSession } from './staff-session';

export function useStaffSession(orgId: string) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StaffSession | null>(null);

  useEffect(() => {
    const loaded = loadStaffSession(orgId);

    // 若 token 過期：直接清掉（避免帶著過期 token 呼叫 API 一直 401）。
    if (loaded && isExpired(loaded.expires_at)) {
      clearStaffSession(orgId);
      setSession(null);
    } else {
      setSession(loaded);
    }

    setReady(true);
  }, [orgId]);

  return { ready, session };
}

function isExpired(expiresAtIso: string) {
  // expires_at 來自 API（ISO string）；parse 失敗就保守視為過期。
  const ms = Date.parse(expiresAtIso);
  if (Number.isNaN(ms)) return true;
  return ms <= Date.now();
}

