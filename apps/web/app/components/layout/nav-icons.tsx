/**
 * Nav Icons（小型 SVG）
 *
 * 我們刻意不用外部 icon library：
 * - MVP 階段避免增加依賴（尤其在 network restricted 環境）
 * - 保持 bundle 小、也方便你之後替換成正式設計系統（例如 lucide/heroicons）
 */

import type { NavIconId } from '../../lib/console-nav';

export function NavIcon({
  id,
  size = 18,
}: {
  id: NavIconId;
  size?: number;
}) {
  // 統一的 SVG 屬性：讓 icon 在 dark/light theme 都能跟著文字顏色走（currentColor）
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  switch (id) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="M3 13h8V3H3z" />
          <path d="M13 21h8V11h-8z" />
          <path d="M13 3h8v6h-8z" />
          <path d="M3 21h8v-6H3z" />
        </svg>
      );
    case 'catalog':
      return (
        <svg {...common}>
          <path d="M4 19a2 2 0 0 0 2 2h14" />
          <path d="M6 3a2 2 0 0 0-2 2v14" />
          <path d="M20 3H8a2 2 0 0 0-2 2v16" />
          <path d="M8 7h12" />
          <path d="M8 11h12" />
        </svg>
      );
    case 'marc':
      return (
        <svg {...common}>
          <path d="M4 4h16v16H4z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h6" />
        </svg>
      );
    case 'authority':
      return (
        <svg {...common}>
          <path d="M12 2l3 7h7l-5.5 4.2L18.5 21 12 16.8 5.5 21l2-7.8L2 9h7z" />
        </svg>
      );
    case 'holdings':
      return (
        <svg {...common}>
          <path d="M6 3h12v18H6z" />
          <path d="M9 7h6" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
        </svg>
      );
    case 'circulation':
      return (
        <svg {...common}>
          <path d="M3 12h18" />
          <path d="M7 8l-4 4 4 4" />
          <path d="M17 8l4 4-4 4" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 17v-6" />
          <path d="M12 17V7" />
          <path d="M16 17v-3" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...common}>
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      );
    case 'maintenance':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0 4.9 4.9l-6.2 6.2a2 2 0 0 1-2.8 0l-3.8-3.8a2 2 0 0 1 0-2.8z" />
          <path d="M9 7l1 1" />
        </svg>
      );
    case 'opac':
      return (
        <svg {...common}>
          <path d="M4 4h16v12H4z" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </svg>
      );
  }
}

