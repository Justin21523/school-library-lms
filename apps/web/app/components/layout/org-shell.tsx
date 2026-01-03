/**
 * OrgShell（單一 organization 的 App Shell）
 *
 * 你希望的 UX 特徵：
 * - 有「清楚的 navbar + sidebar」可導覽導引
 * - sidebar 不是一條超長清單，而是 taxonomy 式階層分類（可展開/收合）
 * - sidebar 可以收合（縮到 icon-only）並支援 tooltip
 * - sidebar 可以調整寬度（resizable），讓 MARC/樹狀視覺化等頁面更好用
 *
 * 我們把這些「導覽外框」集中在 OrgShell：
 * - 讓每個 page.tsx 專注於自己的業務（表單/列表/查詢）
 * - 也避免每頁重複寫麵包屑與導覽邏輯
 */

'use client';

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getOrgConsoleNav, type OrgConsoleNavGroup, type OrgConsoleNavItem, type OrgConsoleNavNode } from '../../lib/console-nav';

import { NavIcon } from './nav-icons';
import { ApiStatusPanel } from './api-status-panel';
import { StaffSessionPanel } from './staff-session-panel';

type GroupOpenState = Record<string, boolean>;

function isItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  // 子頁面也視為 active（例如 /bibs/:id 仍算在 Bibs）
  if (pathname.startsWith(href + '/')) return true;
  return false;
}

function collectBestMatch(
  nodes: OrgConsoleNavNode[],
  pathname: string,
  trail: Array<{ label: string; href?: string }>,
): { item: OrgConsoleNavItem; trail: Array<{ label: string; href?: string }> } | null {
  let best: { item: OrgConsoleNavItem; trail: Array<{ label: string; href?: string }> } | null = null;

  for (const node of nodes) {
    if (node.type === 'item') {
      if (!isItemActive(pathname, node.href)) continue;

      // 同時匹配多個時，選「href 最長」的（更精確）
      const candidate = { item: node, trail };
      if (!best || candidate.item.href.length > best.item.href.length) best = candidate;
      continue;
    }

    const nextTrail = [...trail, { label: node.label }];
    const nested = collectBestMatch(node.children, pathname, nextTrail);
    if (nested && (!best || nested.item.href.length > best.item.href.length)) best = nested;
  }

  return best;
}

function storageKey(orgId: string, key: string) {
  return `library_system_ui:${orgId}:${key}`;
}

export function OrgShell({ orgId, children }: { orgId: string; children: ReactNode }) {
  const pathname = usePathname();

  const nav = useMemo(() => getOrgConsoleNav(orgId), [orgId]);

  // sidebar state：收合（icon-only）
  const [collapsed, setCollapsed] = useState(false);

  // sidebar width：可拖拉調整（resizable）
  const [sidebarWidth, setSidebarWidth] = useState(280);

  // resizing：避免拖拉時出現「動畫延遲感」，也能讓 cursor/user-select 更一致
  const [resizing, setResizing] = useState(false);

  // groups open state：每個 group 可以展開/收合（taxonomy）
  const [groupOpen, setGroupOpen] = useState<GroupOpenState>({});

  // 初次載入：讀 localStorage，把 UI 偏好恢復（讓 UI 有「可預期」的持久性）
  useEffect(() => {
    try {
      const collapsedRaw = window.localStorage.getItem(storageKey(orgId, 'sidebarCollapsed'));
      const collapsedParsed = collapsedRaw === '1';
      setCollapsed(collapsedParsed);

      const widthRaw = window.localStorage.getItem(storageKey(orgId, 'sidebarWidth'));
      const widthParsed = Number.parseInt((widthRaw ?? '').trim(), 10);
      if (Number.isFinite(widthParsed)) setSidebarWidth(clamp(widthParsed, 220, 420));

      const groupRaw = window.localStorage.getItem(storageKey(orgId, 'navGroupOpen'));
      if (groupRaw) {
        const parsed = JSON.parse(groupRaw) as unknown;
        if (parsed && typeof parsed === 'object') setGroupOpen(parsed as GroupOpenState);
      } else {
        // 沒有記錄時，用 nav 的 defaultOpen 當初始值
        setGroupOpen(buildDefaultGroupOpen(nav));
      }
    } catch {
      // localStorage 可能被禁用；遇到錯誤就用預設值即可（不影響功能）
      setGroupOpen(buildDefaultGroupOpen(nav));
    }
  }, [orgId, nav]);

  // 持久化：collapsed / width / groupOpen
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(orgId, 'sidebarCollapsed'), collapsed ? '1' : '0');
    } catch {}
  }, [orgId, collapsed]);
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(orgId, 'sidebarWidth'), String(sidebarWidth));
    } catch {}
  }, [orgId, sidebarWidth]);
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(orgId, 'navGroupOpen'), JSON.stringify(groupOpen));
    } catch {}
  }, [orgId, groupOpen]);

  // resizer：拖拉調整 sidebar 寬度
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  function onResizeStart(e: ReactMouseEvent) {
    if (collapsed) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: sidebarWidth };
    setResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
  }
  function onResizeMove(e: MouseEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clamp(drag.startW + (e.clientX - drag.startX), 220, 420);
    setSidebarWidth(next);
  }
  function onResizeEnd() {
    dragRef.current = null;
    setResizing(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
  }

  const active = useMemo(() => collectBestMatch(nav, pathname, []), [nav, pathname]);

  return (
    <div className="orgShell">
      <aside
        className={collapsed ? 'sidebar collapsed' : resizing ? 'sidebar resizing' : 'sidebar'}
        style={
          collapsed
            ? undefined
            : {
                // CSS variable 讓我們能在 pure CSS 裡做 sticky/overflow，而不用一直傳 props
                ['--sidebar-w' as any]: `${sidebarWidth}px`,
              }
        }
        aria-label="Organization Navigation"
      >
        <div className="sidebarHeader">
          <div className="sidebarHeaderTitle" title={`Organization: ${orgId}`}>
            {collapsed ? <NavIcon id="dashboard" /> : <span style={{ fontWeight: 800 }}>Console</span>}
          </div>
          <div className="sidebarHeaderActions">
            <button type="button" className="btnSmall" onClick={() => setCollapsed((v) => !v)} title="收合/展開側邊欄">
              {collapsed ? '展開' : '收合'}
            </button>
          </div>
        </div>

        {/* breadcrumbs（放在 sidebar 頂部）：讓使用者知道自己在哪個 taxonomy 節點 */}
        {!collapsed ? (
          <div className="sidebarCrumbs" aria-label="Breadcrumbs">
            <div className="muted" style={{ fontSize: 12 }}>
              位置
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Link href={`/orgs/${orgId}`} className="crumb">
                org
              </Link>
              {active
                ? active.trail.map((t) => (
                    <span key={t.label} className="crumb muted">
                      / {t.label}
                    </span>
                  ))
                : null}
              {active ? (
                <span className="crumb" style={{ fontWeight: 700 }}>
                  / {active.item.label}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <nav className="navTree" aria-label="Navigation Tree">
          {nav.map((node) => (
            <NavNode
              key={node.id}
              node={node}
              pathname={pathname}
              collapsed={collapsed}
              groupOpen={groupOpen}
              onToggleGroup={(id) => setGroupOpen((prev) => ({ ...prev, [id]: !prev[id] }))}
            />
          ))}
        </nav>

        {/* footer：留給後續「快捷工具」/「最近使用」等 UX 強化 */}
        {!collapsed ? (
          <div className="sidebarFooter">
            <div className="sidebarStatus">
              <StaffSessionPanel orgId={orgId} />
              <ApiStatusPanel />
              <div className="muted" style={{ fontSize: 12 }}>
                提示：按 <code>Ctrl/Cmd + K</code> 可快速跳轉功能
              </div>
            </div>
          </div>
        ) : null}
      </aside>

      {/* resizer：拖拉調整 sidebar 寬度（collapsed 時隱藏） */}
      {!collapsed ? <div className="sidebarResizer" role="separator" aria-orientation="vertical" onMouseDown={onResizeStart} /> : null}

      <main className="orgContent" aria-label="Content">
        {children}
      </main>
    </div>
  );
}

function NavNode({
  node,
  pathname,
  collapsed,
  groupOpen,
  onToggleGroup,
}: {
  node: OrgConsoleNavNode;
  pathname: string;
  collapsed: boolean;
  groupOpen: GroupOpenState;
  onToggleGroup: (groupId: string) => void;
}) {
  if (node.type === 'item') {
    const active = isItemActive(pathname, node.href);
    const label = node.label;
    const title = node.description ? `${label} — ${node.description}` : label;
    return (
      <Link
        href={node.href}
        className={active ? 'navItem active' : 'navItem'}
        title={collapsed ? title : undefined}
        data-tooltip={collapsed ? label : undefined}
      >
        {node.icon ? (
          <span className="navIcon">
            <NavIcon id={node.icon} />
          </span>
        ) : null}
        {!collapsed ? <span className="navLabel">{label}</span> : null}
      </Link>
    );
  }

  const open = groupOpen[node.id] ?? node.defaultOpen ?? false;
  const showChildren = collapsed ? false : open;
  const active = isNodeActive(node, pathname);

  // 收合（icon-only）模式的 UX：
  // - 若收合時「完全看不到 items」，使用者就無法靠 sidebar 導覽
  // - 因此我們把每個 group 映射成「該群組的預設入口」（第一個可用的 leaf item）
  //
  // 這樣的好處：
  // - icon-only sidebar 仍然可用（點一下就能跳到該模組）
  // - 更細的頁面仍可透過 Ctrl/Cmd+K 的 command palette 到達
  if (collapsed) {
    const first = findFirstItem(node);
    if (!first) {
      // 理論上不會發生（我們的 group 都會有 children items），但保底：render 成 disabled button
      return (
        <button type="button" className="navItem" disabled title={node.label} data-tooltip={node.label}>
          {node.icon ? (
            <span className="navIcon">
              <NavIcon id={node.icon} />
            </span>
          ) : null}
        </button>
      );
    }

    return (
      <Link
        href={first.href}
        className={active ? 'navItem active' : 'navItem'}
        title={node.label}
        data-tooltip={node.label}
      >
        {node.icon ? (
          <span className="navIcon">
            <NavIcon id={node.icon} />
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <div className="navGroup">
      <button
        type="button"
        className={active ? 'navGroupHeader active' : 'navGroupHeader'}
        onClick={() => onToggleGroup(node.id)}
      >
        {node.icon ? (
          <span className="navIcon">
            <NavIcon id={node.icon} />
          </span>
        ) : null}
        <span className="navLabel">{node.label}</span>
        <span className="navChevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {showChildren ? (
        <div className="navGroupChildren">
          {node.children.map((child) => (
            <NavNode
              key={child.id}
              node={child}
              pathname={pathname}
              collapsed={collapsed}
              groupOpen={groupOpen}
              onToggleGroup={onToggleGroup}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isNodeActive(node: OrgConsoleNavNode, pathname: string): boolean {
  if (node.type === 'item') return isItemActive(pathname, node.href);
  return node.children.some((c) => isNodeActive(c, pathname));
}

function findFirstItem(group: OrgConsoleNavGroup): OrgConsoleNavItem | null {
  for (const child of group.children) {
    if (child.type === 'item') return child;
    const nested = findFirstItem(child);
    if (nested) return nested;
  }
  return null;
}

function buildDefaultGroupOpen(nav: OrgConsoleNavGroup[]): GroupOpenState {
  const state: GroupOpenState = {};
  for (const g of nav) {
    state[g.id] = Boolean(g.defaultOpen);
    walkGroup(g);
  }
  return state;

  function walkGroup(group: OrgConsoleNavGroup) {
    for (const child of group.children) {
      if (child.type !== 'group') continue;
      state[child.id] = Boolean(child.defaultOpen);
      walkGroup(child);
    }
  }
}
