/**
 * CommandPalette（快速跳轉 / 搜尋功能）
 *
 * UX 目的：
 * - 當功能變多，光靠左側 nav 會「捲很久」或「不知道要去哪裡」
 * - Command palette 讓使用者用鍵盤快速找到頁面（Ctrl/Cmd + K）
 *
 * 本元件專注於「導覽跳轉」：
 * - 資料來源：flattened nav items（console-nav.ts）
 * - 不做資料查詢（例如書目搜尋）；那會另外是 global search bar 的責任
 */

'use client';

import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import type { OrgConsoleNavItem } from '../../lib/console-nav';

export function CommandPalette({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: OrgConsoleNavItem[];
  onClose: () => void;
}) {
  const router = useRouter();

  // query：使用者在 palette 中輸入的關鍵字
  const [query, setQuery] = useState('');

  // activeIndex：鍵盤上下選取的高亮項目
  const [activeIndex, setActiveIndex] = useState(0);

  // inputRef：開啟時自動 focus，降低操作成本
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 開啟時 reset（避免上次搜尋殘留造成困惑）
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    // 等下一個 tick 再 focus（確保 DOM 已出現）
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 60);

    // MVP：用簡單的「包含」搜尋 + 基本排序
    const scored = items
      .map((item) => {
        const hay = [item.label, item.href, ...(item.keywords ?? [])].join(' ').toLowerCase();
        const idx = hay.indexOf(q);
        const score = idx === -1 ? Infinity : idx; // 越接近開頭越好
        return { item, score };
      })
      .filter((x) => x.score !== Infinity)
      .sort((a, b) => a.score - b.score)
      .slice(0, 60);

    return scored.map((x) => x.item);
  }, [items, query]);

  function goTo(item: OrgConsoleNavItem) {
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) goTo(item);
      return;
    }
  }

  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Command Palette" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(e) => {
          // 阻止 overlay click 直接關閉（讓點擊 modal 內部不會關）
          e.stopPropagation();
        }}
        onKeyDown={onKeyDown}
      >
        <div className="modalHeader">
          <div style={{ fontWeight: 700 }}>快速跳轉</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Ctrl/Cmd + K · Esc 關閉
          </div>
        </div>

        <div className="modalBody">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="輸入功能名稱或關鍵字…（例如：MARC、權威、逾期）"
          />

          <div className="list" role="listbox" aria-label="Results">
            {filtered.length === 0 ? (
              <div className="muted" style={{ padding: 12 }}>
                找不到符合的功能。
              </div>
            ) : (
              filtered.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={idx === activeIndex ? 'listRow active' : 'listRow'}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => goTo(item)}
                >
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {item.href}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
