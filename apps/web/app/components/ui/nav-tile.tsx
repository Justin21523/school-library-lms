import type { ReactNode } from 'react';

import Link from 'next/link';

/**
 * NavTile（導覽用的「方塊/卡片」）
 *
 * 你希望「少文字、更多視覺語言」的導覽：
 * - 讓使用者看到 icon + title 就能理解「這是什麼功能區」
 * - 點進去後再用模組 Hub page（卡片/段落）承接細項導航
 *
 * 注意：
 * - 不用外部 UI library（network restricted）
 * - 視覺 tokens 走 globals.css（保持單一真相來源）
 */

export function NavTile(props: {
  href: string;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <Link href={props.href} className={['navTile', props.className ?? ''].join(' ')}>
      {props.icon ? <div className="navTileIcon">{props.icon}</div> : null}

      <div className="navTileBody">
        <div className="navTileTitle">{props.title}</div>
        {props.description ? <div className="navTileDescription">{props.description}</div> : null}
      </div>

      {props.right ? <div className="navTileRight">{props.right}</div> : null}
    </Link>
  );
}

