/**
 * useOpacSession（React hook）
 *
 * 目的：
 * - 在 Client Component 中讀取 localStorage 的 OPAC session（Patron Bearer token）
 * - 提供「ready」狀態，避免 SSR/hydration 階段 UI 閃爍
 *
 * 這個 hook 的行為與 useStaffSession 類似：
 * - 兩者都採「localStorage + expires_at」的 MVP session 模式
 * - 差別只在於：OPAC session 用於 /me（PatronAuthGuard），staff session 用於後台（StaffAuthGuard）
 */

'use client';

import { useEffect, useState } from 'react';

import type { OpacSession } from './opac-session';
import { clearOpacSession, loadOpacSession } from './opac-session';

export function useOpacSession(orgId: string) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<OpacSession | null>(null);

  useEffect(() => {
    const loaded = loadOpacSession(orgId);

    // 若 token 過期：直接清掉（避免帶著過期 token 呼叫 /me 一直 401）。
    if (loaded && isExpired(loaded.expires_at)) {
      clearOpacSession(orgId);
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

