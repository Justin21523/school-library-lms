import type { SVGProps } from 'react';

export type UiIconId =
  | 'search'
  | 'command'
  | 'sun'
  | 'moon'
  | 'computer'
  | 'text'
  | 'settings';

export function UiIcon({
  id,
  size = 18,
  ...props
}: { id: UiIconId; size?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>) {
  const common: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    ...props,
  };

  switch (id) {
    case 'search':
      return (
        <svg {...common}>
          <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case 'command':
      return (
        <svg {...common}>
          <path d="M18 9a3 3 0 1 0-3-3v3h3z" />
          <path d="M18 15a3 3 0 1 1-3 3v-3h3z" />
          <path d="M6 9a3 3 0 1 1 3-3v3H6z" />
          <path d="M6 15a3 3 0 1 0 3 3v-3H6z" />
          <path d="M9 9h6" />
          <path d="M9 15h6" />
          <path d="M12 9v6" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.93 19.07l1.41-1.41" />
          <path d="M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3a7 7 0 1 0 9.8 9.8z" />
        </svg>
      );
    case 'computer':
      return (
        <svg {...common}>
          <path d="M4 4h16v12H4z" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </svg>
      );
    case 'text':
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M8 6v14" />
          <path d="M16 6v14" />
          <path d="M6 20h12" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
          <path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.6-2-3.4-2.4 1a8.4 8.4 0 0 0-1.7-1L15 4h-6l-.4 3a8.4 8.4 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 13a7.9 7.9 0 0 0 .1 2l-2 1.6 2 3.4 2.4-1a8.4 8.4 0 0 0 1.7 1L9 22h6l.4-3a8.4 8.4 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.6z" />
        </svg>
      );
  }
}
