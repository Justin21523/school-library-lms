/**
 * Next.js App Router：Root Layout
 *
 * 在 Next.js（App Router）中：
 * - `app/layout.tsx` 是整個網站的「外框」與共用設定（例如 <html>、<body>）
 * - `children` 代表「每個頁面內容」會被塞進來的位置
 *
 * 你可以把它想成：所有頁面都會被包在這個 layout 裡。
 */

// ReactNode 是 React 裡用來表示「可被渲染的內容」的型別（例如文字、元素、元件）。
import type { ReactNode } from 'react';

// Next.js 的 Metadata 型別：讓你在 TS 下寫 title/description 時有提示與檢查。
import type { Metadata } from 'next';

import Script from 'next/script';

// 全站共用 CSS（App Router 規則：只能在 layout.tsx 這種「根」層級 import global CSS）。
import './globals.css';

// Next.js 會使用 metadata 來產生 <head> 的標題/描述（例如 SEO/分享卡片）。
export const metadata: Metadata = {
  title: 'Library System',
  description: 'Lean cloud library system for K–12 schools',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `lang="zh-Hant"`：標示主要語言為繁體中文（對 SEO/螢幕閱讀器有幫助）。
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        {/* UI init：避免 Light/Dark / 字體大小 切換時出現「閃一下」的 FOUC（Flash of Unstyled Content） */}
        <Script id="ui-init" strategy="beforeInteractive">
          {`
(() => {
  try {
    const root = document.documentElement;

    // theme
    const themeRaw = window.localStorage.getItem('ui.theme');
    const theme = (themeRaw || '').trim();
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');

    // ui scale（字體大小）
    const scaleRaw = window.localStorage.getItem('ui.scale');
    const scale = (scaleRaw || '').trim();
    if (scale === 'sm' || scale === 'md' || scale === 'lg' || scale === 'xl') {
      if (scale === 'md') root.removeAttribute('data-ui-scale');
      else root.setAttribute('data-ui-scale', scale);
    } else {
      root.removeAttribute('data-ui-scale');
    }
  } catch {
    // localStorage 可能被禁用；忽略即可（會回退到 CSS 的 system theme / default scale）
  }
})();
          `}
        </Script>
      </head>
      {/* body 的全站樣式在 globals.css，這裡只放 children。 */}
      <body>{children}</body>
    </html>
  );
}
