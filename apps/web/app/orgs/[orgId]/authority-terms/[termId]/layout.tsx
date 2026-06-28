import type { ReactNode } from 'react';

export function generateStaticParams() {
  return [{ termId: 'demo-term' }];
}

export default function AuthorityTermDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
