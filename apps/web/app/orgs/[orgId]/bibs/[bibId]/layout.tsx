import type { ReactNode } from 'react';

export function generateStaticParams() {
  return [{ bibId: 'demo-bib' }];
}

export default function BibDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
