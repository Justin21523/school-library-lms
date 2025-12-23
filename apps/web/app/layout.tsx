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

// Next.js 會使用 metadata 來產生 <head> 的標題/描述（例如 SEO/分享卡片）。
export const metadata = {
  title: 'Library System',
  description: 'Lean cloud library system for K–12 schools',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `lang="zh-Hant"`：標示主要語言為繁體中文（對 SEO/螢幕閱讀器有幫助）。
    <html lang="zh-Hant">
      {/* 這裡先用 inline style 做最小化排版；之後可以換成 CSS/Tailwind。 */}
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
