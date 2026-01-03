'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { UiIcon } from '../ui/icons';

type UiScale = 'sm' | 'md' | 'lg' | 'xl';

function normalizeScale(raw: string | null): UiScale {
  const v = (raw ?? '').trim();
  if (v === 'sm' || v === 'md' || v === 'lg' || v === 'xl') return v;
  return 'md';
}

function applyScaleToDom(scale: UiScale) {
  const root = document.documentElement;
  if (scale === 'md') {
    root.removeAttribute('data-ui-scale');
    return;
  }
  root.setAttribute('data-ui-scale', scale);
}

export function UiScaleToggle() {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState<UiScale>('md');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const stored = normalizeScale(window.localStorage.getItem('ui.scale'));
    setScale(stored);
    applyScaleToDom(stored);
  }, []);

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

  function setAndPersist(next: UiScale) {
    setScale(next);
    window.localStorage.setItem('ui.scale', next);
    applyScaleToDom(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  const label = useMemo(() => {
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
        title={`字體大小：${label}（全站）`}
      >
        <UiIcon id="text" size={16} />
        字體
      </button>

      {open ? (
        <div className="menuPopup" role="menu" aria-label="UI Scale">
          <button
            type="button"
            role="menuitem"
            className="menuItem"
            onClick={() => setAndPersist('sm')}
            data-selected={scale === 'sm' ? 'true' : 'false'}
          >
            小
          </button>
          <button
            type="button"
            role="menuitem"
            className="menuItem"
            onClick={() => setAndPersist('md')}
            data-selected={scale === 'md' ? 'true' : 'false'}
          >
            標準
          </button>
          <button
            type="button"
            role="menuitem"
            className="menuItem"
            onClick={() => setAndPersist('lg')}
            data-selected={scale === 'lg' ? 'true' : 'false'}
          >
            大
          </button>
          <button
            type="button"
            role="menuitem"
            className="menuItem"
            onClick={() => setAndPersist('xl')}
            data-selected={scale === 'xl' ? 'true' : 'false'}
          >
            特大
          </button>
        </div>
      ) : null}
    </div>
  );
}
