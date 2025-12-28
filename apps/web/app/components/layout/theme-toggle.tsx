/**
 * ThemeToggle（Light/Dark/System）
 *
 * 目標：
 * - 讓使用者能在「白底 / 深色」之間切換（你要求的 white/dark mode）
 * - 預設跟隨系統（system），並允許使用者覆蓋
 *
 * 設計取捨（MVP）：
 * - 不引入第三方套件（next-themes 等），避免增加依賴與行為黑箱
 * - 用最小的 data attribute：`<html data-theme="dark">`
 * - localStorage 只存「使用者偏好」：`ui.theme = light|dark|system`
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';

function normalizeMode(raw: string | null): ThemeMode {
  const v = (raw ?? '').trim();
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function applyModeToDom(mode: ThemeMode) {
  // 我們把 theme 掛在 <html>（documentElement）：
  // - CSS 變數統一由 :root / :root[data-theme="..."] 控制
  // - 讓整站（包含表單、scrollbar）能跟著 color-scheme 一起切換
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
    return;
  }
  root.setAttribute('data-theme', mode);
}

export function ThemeToggle() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>('system');
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // 讀取 localStorage 的偏好，並套用到 DOM。
  useEffect(() => {
    const stored = normalizeMode(window.localStorage.getItem('ui.theme'));
    setMode(stored);
    applyModeToDom(stored);
  }, []);

  // 寫回 localStorage + 套用到 DOM（單一真相來源：mode state）
  function setAndPersist(next: ThemeMode) {
    setMode(next);
    window.localStorage.setItem('ui.theme', next);
    applyModeToDom(next);
    setOpen(false);

    // 對鍵盤使用者更友善：關閉 menu 後把 focus 還給按鈕。
    buttonRef.current?.focus();
  }

  const label = useMemo(() => {
    switch (mode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
      default:
        return 'System';
    }
  }, [mode]);

  return (
    <div className="menu" style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        className="btnSmall"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="切換顏色主題（Light/Dark/System）"
      >
        Theme：{label}
      </button>

      {open ? (
        <div className="menuPopup" role="menu" aria-label="Theme">
          <button
            type="button"
            role="menuitem"
            className="menuItem"
            onClick={() => setAndPersist('system')}
          >
            跟隨系統（System）
          </button>
          <button type="button" role="menuitem" className="menuItem" onClick={() => setAndPersist('light')}>
            白底（Light）
          </button>
          <button type="button" role="menuitem" className="menuItem" onClick={() => setAndPersist('dark')}>
            深色（Dark）
          </button>
        </div>
      ) : null}
    </div>
  );
}

