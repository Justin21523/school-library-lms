/**
 * Skeleton（載入骨架）
 *
 * 為什麼不只用「載入中...」：
 * - 列表/表格載入時，使用者最在意「大概會出現什麼」與「版面會不會跳」
 * - skeleton 可以預先占位，讓 layout 更穩定、感覺更快
 *
 * 使用方式（例）：
 * - <SkeletonBlock height={28} />
 * - <SkeletonText lines={3} />
 */

import type { CSSProperties } from 'react';

function px(value: number | string | undefined) {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

export function SkeletonBlock(props: {
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={['skeleton', props.className ?? ''].join(' ')}
      style={{
        width: px(props.width) ?? '100%',
        height: px(props.height) ?? 14,
        ...props.style,
      }}
    />
  );
}

export function SkeletonText(props: {
  lines?: number;
  /** 每行高度（px）；預設 12 */
  lineHeight?: number;
  /** 行距（px）；預設 10 */
  gap?: number;
  /** 最後一行縮短比例（0~1）；讓「文字感」更像真實段落 */
  lastLineWidthRatio?: number;
}) {
  const lines = Math.max(1, props.lines ?? 2);
  const lineHeight = props.lineHeight ?? 12;
  const gap = props.gap ?? 10;
  const lastRatio = props.lastLineWidthRatio ?? 0.65;

  return (
    <div style={{ display: 'grid', gap }}>
      {Array.from({ length: lines }).map((_, idx) => (
        <SkeletonBlock
          // skeleton 是純視覺占位，不參與 reordering，因此 idx 當 key 可接受
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          height={lineHeight}
          width={idx === lines - 1 ? `${Math.round(lastRatio * 100)}%` : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonTable(props: {
  /** 欄位數量 */
  columns: number;
  /** 資料列數量（不含 header） */
  rows?: number;
  /** 每列的 skeleton 高度（px）；預設 14 */
  rowHeight?: number;
  /** 可選：指定每個欄位的寬度（例如 [220, '20%']） */
  columnWidths?: Array<number | string>;
}) {
  const rows = Math.max(1, props.rows ?? 6);
  const rowHeight = props.rowHeight ?? 14;
  const columns = Math.max(1, props.columns);

  return (
    <div className="dataTable">
      <div className="dataTableScroller">
        <table>
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, idx) => (
                <th
                  // skeleton table 是純占位；idx 當 key 可接受
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  style={props.columnWidths?.[idx] ? { width: px(props.columnWidths[idx]) } : undefined}
                >
                  <SkeletonBlock height={10} width="70%" style={{ borderRadius: 999 }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={r}>
                {Array.from({ length: columns }).map((_, c) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <td key={c}>
                    <SkeletonBlock height={rowHeight} width={c === 0 ? '92%' : '76%'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * SkeletonTiles（卡片/tiles 的載入骨架）
 *
 * 使用情境：
 * - /orgs：載入 org list 時用 tileGrid 呈現（「入口索引」比 table 更直覺）
 * - 之後若我們把更多「模組入口」改成動態載入，也能沿用這個骨架保持版面穩定
 */
export function SkeletonTiles(props: { count?: number }) {
  const count = Math.max(1, props.count ?? 6);

  return (
    <div className="tileGrid" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={idx} className="navTile" style={{ pointerEvents: 'none' }}>
          <div className="navTileIcon">
            <SkeletonBlock width={20} height={20} style={{ borderRadius: 6 }} />
          </div>
          <div className="navTileBody">
            <SkeletonBlock height={12} width="70%" />
            <SkeletonBlock height={10} width="92%" />
          </div>
          <div className="navTileRight">
            <SkeletonBlock height={10} width={56} />
          </div>
        </div>
      ))}
    </div>
  );
}
