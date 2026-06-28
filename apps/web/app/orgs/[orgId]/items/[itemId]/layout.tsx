import type { ReactNode } from 'react';

export function generateStaticParams() {
  return [{ itemId: 'demo-item' }];
}

export default function ItemDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
