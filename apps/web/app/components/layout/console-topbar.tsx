/**
 * ConsoleTopbar（後台頂部導覽列）
 *
 * 你希望 UI/UX 更「有層次」且「可導引」：
 * - Topbar 承擔全域操作：品牌/回到 org 列表、全域查詢、快捷跳轉、主題切換、登入狀態
 * - Sidebar 才放 taxonomy 式的功能樹
 *
 * 這個元件用 Client Component 的原因：
 * - 需要快捷鍵（Ctrl/Cmd+K）打開 command palette
 * - 需要 theme toggle（localStorage + DOM attribute）
 * - 需要顯示 staff session（localStorage）
 */

'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { getOrgConsoleNav, flattenOrgConsoleNav, type OrgConsoleNavItem } from '../../lib/console-nav';
import { useStaffSession } from '../../lib/use-staff-session';

import { CommandPalette } from './command-palette';
import { ThemeToggle } from './theme-toggle';

type GlobalSearchScope = 'bibs' | 'authority_terms';

function extractOrgId(pathname: string): string | null {
  // 只處理 console routes：/orgs/:orgId/...
  const m = pathname.match(/^\/orgs\/([^/]+)(?:\/|$)/);
  const raw = m?.[1];
  if (!raw) return null;
  return decodeURIComponent(raw);
}

export function ConsoleTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const orgId = useMemo(() => extractOrgId(pathname), [pathname]);

  // staff session：只在 org 範圍內才有意義（orgId 不存在時用 dummy key 避免誤讀）
  const { ready: staffReady, session: staffSession } = useStaffSession(orgId ?? '__no_org__');

  // command palette：只有在 org 範圍內才提供（因為 items 是 org-specific routes）
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteItems: OrgConsoleNavItem[] = useMemo(() => {
    if (!orgId) return [];
    return flattenOrgConsoleNav(getOrgConsoleNav(orgId));
  }, [orgId]);

  // global search：把「快速查詢入口」放在 topbar（符合你希望的清楚查詢體驗）
  const [searchScope, setSearchScope] = useState<GlobalSearchScope>('bibs');
  const [searchQuery, setSearchQuery] = useState('');

  function submitGlobalSearch(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;

    const q = searchQuery.trim();
    if (!q) return;

    if (searchScope === 'bibs') {
      router.push(`/orgs/${orgId}/bibs?query=${encodeURIComponent(q)}`);
      return;
    }

    router.push(`/orgs/${orgId}/authority-terms?query=${encodeURIComponent(q)}`);
  }

  // Ctrl/Cmd + K：開啟 palette（UX：快速跳轉）
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // 不干擾輸入框：如果使用者正在打字，就不要搶快捷鍵
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || (target as HTMLElement | null)?.isContentEditable;

      const isK = e.key.toLowerCase() === 'k';
      const withMeta = e.metaKey || e.ctrlKey;
      if (!isK || !withMeta) return;

      e.preventDefault();
      if (!orgId) return;
      if (isTyping) return;
      setPaletteOpen(true);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orgId]);

  // staff menu：避免 topbar 右側塞滿連結（改成「工具/狀態」收納成 dropdown）
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);
  const staffMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!staffMenuOpen) return;

    function onMouseDown(e: MouseEvent) {
      const el = staffMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setStaffMenuOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setStaffMenuOpen(false);
    }

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [staffMenuOpen]);

  return (
    <>
      <header className="topbar">
        <div className="topbarInner">
          <div className="topbarLeft">
            <div className="topbarTitle">
              <Link href="/orgs" style={{ color: 'inherit' }}>
                Library System
              </Link>
            </div>
            {orgId ? (
              <div className="topbarCrumb" title="目前 organization（URL 代表多租戶邊界）">
                org：<span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{orgId}</span>
              </div>
            ) : null}
          </div>

          <div className="topbarCenter">
            {orgId ? (
              <form onSubmit={submitGlobalSearch} className="topbarSearch" aria-label="Global Search">
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value as GlobalSearchScope)}
                  aria-label="Search scope"
                >
                  <option value="bibs">書目</option>
                  <option value="authority_terms">權威詞</option>
                </select>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="全域查詢（書名/作者/ISBN 或 權威詞）…"
                />
                <button type="submit" className="btnSmall">
                  查詢
                </button>
                <button type="button" className="btnSmall" onClick={() => setPaletteOpen(true)} title="Ctrl/Cmd + K">
                  快捷
                </button>
              </form>
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                選擇 organization 後可使用全域查詢與快捷跳轉
              </div>
            )}
          </div>

          <div className="topbarRight">
            <ThemeToggle />

            {orgId ? (
              <div ref={staffMenuRef} className="menu" style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btnSmall"
                  aria-haspopup="menu"
                  aria-expanded={staffMenuOpen}
                  onClick={() => setStaffMenuOpen((v) => !v)}
                  title="Staff session / 快捷連結"
                >
                  {staffReady
                    ? staffSession
                      ? `Staff：${staffSession.user.name}（${staffSession.user.role}）`
                      : 'Staff：未登入'
                    : 'Staff：載入中…'}
                </button>

                {staffMenuOpen ? (
                  <div className="menuPopup" role="menu" aria-label="Staff menu">
                    <Link className="menuItemLink" role="menuitem" href="/">
                      回首頁
                    </Link>
                    <Link className="menuItemLink" role="menuitem" href="/orgs">
                      Organizations
                    </Link>
                    <Link className="menuItemLink" role="menuitem" href={`/orgs/${orgId}`}>
                      Dashboard
                    </Link>

                    <div className="menuSeparator" />

                    {!staffSession ? (
                      <Link className="menuItemLink" role="menuitem" href={`/orgs/${orgId}/login`}>
                        Staff Login
                      </Link>
                    ) : (
                      <Link className="menuItemLink" role="menuitem" href={`/orgs/${orgId}/logout`}>
                        Logout
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <nav className="topbarNav" aria-label="Console">
                <Link href="/">首頁</Link>
                <Link href="/orgs">Organizations</Link>
              </nav>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
