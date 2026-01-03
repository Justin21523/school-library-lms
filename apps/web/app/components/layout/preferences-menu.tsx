/**
 * PreferencesMenu（主題/字體大小 整合選單）
 *
 * 你指出 topbar 的「UI 設定」太擠，原因是：
 * - ThemeToggle 與 UiScaleToggle 各佔一顆按鈕
 * - OPAC topbar 還會再加上導航連結，視覺與空間都容易擁擠
 *
 * 這個元件把兩者收斂成「一顆設定按鈕」：
 * - 減少 topbar 右側擁擠感（改善可掃描性）
 * - 行為仍維持既有鍵值（localStorage：ui.theme / ui.scale）
 * - DOM 套用方式維持一致（data-theme / data-ui-scale）
 *
 * 注意：
 * - RootLayout 已用 beforeInteractive script 做「避免 FOUC」的初始化
 * - 這裡仍要在 mount 後讀 localStorage，讓 React state 與真相一致（避免 UI 顯示錯誤）
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { UiIcon } from '../ui/icons';

type ThemeMode = 'system' | 'light' | 'dark';
type UiScale = 'sm' | 'md' | 'lg' | 'xl';

function normalizeTheme(raw: string | null): ThemeMode {
  const v = (raw ?? '').trim();
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function normalizeScale(raw: string | null): UiScale {
  const v = (raw ?? '').trim();
  if (v === 'sm' || v === 'md' || v === 'lg' || v === 'xl') return v;
  return 'md';
}

function applyThemeToDom(mode: ThemeMode) {
  // 與 ThemeToggle 的策略一致：掛在 <html data-theme="...">
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
    return;
  }
  root.setAttribute('data-theme', mode);
}

function applyScaleToDom(scale: UiScale) {
  // 與 UiScaleToggle 的策略一致：md 代表「預設」→ 移除 attribute
  const root = document.documentElement;
  if (scale === 'md') {
    root.removeAttribute('data-ui-scale');
    return;
  }
  root.setAttribute('data-ui-scale', scale);
}

export function PreferencesMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [scale, setScale] = useState<UiScale>('md');

  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // mount：讀 localStorage，並把 state 與 DOM 對齊
  useEffect(() => {
    const storedTheme = normalizeTheme(window.localStorage.getItem('ui.theme'));
    const storedScale = normalizeScale(window.localStorage.getItem('ui.scale'));

    setTheme(storedTheme);
    setScale(storedScale);

    applyThemeToDom(storedTheme);
    applyScaleToDom(storedScale);
  }, []);

  // UX：點擊外部/按 Esc 關閉 menu
  useEffect(() => {
    if (!open) return;

    function onMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function setAndPersistTheme(next: ThemeMode) {
    setTheme(next);
    window.localStorage.setItem('ui.theme', next);
    applyThemeToDom(next);
  }

  function setAndPersistScale(next: UiScale) {
    setScale(next);
    window.localStorage.setItem('ui.scale', next);
    applyScaleToDom(next);
  }

  const themeLabel = useMemo(() => {
    switch (theme) {
      case 'light':
        return '白底';
      case 'dark':
        return '深色';
      case 'system':
      default:
        return '系統';
    }
  }, [theme]);

  const scaleLabel = useMemo(() => {
    switch (scale) {
      case 'sm':
        return '小';
      case 'lg':
        return '大';
      case 'xl':
        return '特大';
      case 'md':
      default:
        return '標準';
    }
  }, [scale]);

  return (
    <div ref={rootRef} className="menu" style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        className="btnSmall"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={`設定：主題=${themeLabel} · 字體=${scaleLabel}`}
      >
        <UiIcon id="settings" size={16} />
        設定
      </button>

      {open ? (
        <div className="menuPopup" role="menu" aria-label="Preferences">
          <div className="muted" style={{ fontSize: 12, fontWeight: 850, padding: '4px 10px' }}>
            主題（Theme）
          </div>
          <button
            type="button"
            role="menuitem"
            className="menuItem"
            onClick={() => {
              setAndPersistTheme('system');
              setOpen(false);
              buttonRef.current?.focus();
            }}
            data-selected={theme === 'system' ? 'true' : 'false'}
          >
            <span className="menuItemIcon" aria-hidden="true">
              <UiIcon id="computer" size={16} />
            </span>
            跟隨系統（System）
          </button>
          <button
            type="button"
            role="menuitem"
            className="menuItem"
            onClick={() => {
              setAndPersistTheme('light');
              setOpen(false);
              buttonRef.current?.focus();
            }}
            data-selected={theme === 'light' ? 'true' : 'false'}
          >
            <span className="menuItemIcon" aria-hidden="true">
              <UiIcon id="sun" size={16} />
            </span>
            白底（Light）
          </button>
          <button
            type="button"
            role="menuitem"
            className="menuItem"
            onClick={() => {
              setAndPersistTheme('dark');
              setOpen(false);
              buttonRef.current?.focus();
            }}
            data-selected={theme === 'dark' ? 'true' : 'false'}
          >
            <span className="menuItemIcon" aria-hidden="true">
              <UiIcon id="moon" size={16} />
            </span>
            深色（Dark）
          </button>

          <div className="menuSeparator" />

          <div className="muted" style={{ fontSize: 12, fontWeight: 850, padding: '4px 10px' }}>
            字體大小（UI Scale）
          </div>
          {(['sm', 'md', 'lg', 'xl'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="menuitem"
              className="menuItem"
              onClick={() => {
                setAndPersistScale(v);
                setOpen(false);
                buttonRef.current?.focus();
              }}
              data-selected={scale === v ? 'true' : 'false'}
            >
              <span className="menuItemIcon" aria-hidden="true">
                <UiIcon id="text" size={16} />
              </span>
              {v === 'sm' ? '小' : v === 'md' ? '標準' : v === 'lg' ? '大' : '特大'}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

