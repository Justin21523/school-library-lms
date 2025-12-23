import type { ReactNode } from 'react';

export const metadata = {
  title: 'Library System',
  description: 'Lean cloud library system for K–12 schools',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}

