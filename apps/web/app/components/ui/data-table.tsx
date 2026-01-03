/**
 * DataTable（統一列表/表格：排序 UI + 一致樣式）
 *
 * 核心目標：
 * - 把「列表」轉成可掃描的表格（尤其是 bibs/items/loans 這類高密度資料）
 * - 統一：
 *   - 表頭（header）視覺
 *   - 欄位對齊（左/中/右）
 *   - client-side sorting 的互動（點表頭切換排序）
 *
 * 重要取捨（先做最有感的 v1）：
 * - 目前 API 多是 cursor pagination（next_cursor），因此前端拿到的是「已載入的局部資料」
 * - v1 的 sorting 採「只排序已載入資料」：
 *   - 優點：不用立刻改 API，UI 立刻可用
 *   - 缺點：不是全量排序，但我們會用 sortHint 明確告知
 *
 * 之後若要做真正的全量排序：
 * - API：GET /... 追加 sort_by / sort_dir（並用 index 支援）
 * - Web：把排序 state 變成 query params，讓 server 端/DB 做排序
 */

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ReactNode } from 'react';

type SortDir = 'asc' | 'desc';

export type DataTableColumn<T> = {
  /** 欄位 id：用於排序 state */
  id: string;
  header: ReactNode;
  /** cell 渲染：你想怎麼顯示都可以（Link/Badge/多行） */
  cell: (row: T) => ReactNode;
  /** sortValue 提供後，表頭就會變成可點擊排序 */
  sortValue?: (row: T) => string | number | null | undefined;
  /** 對齊方式：預設 left */
  align?: 'left' | 'center' | 'right';
  /** 固定寬度（可選）；常用於「數字/操作欄」 */
  width?: number | string;
};

export type DataTableSortState = { columnId: string; direction: SortDir };

function cmpPrimitive(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function isInteractiveEventTarget(target: EventTarget | null, rowEl: HTMLElement | null) {
  // Row click 需要「不要干擾 cell 內的互動元件」：
  // - 使用者點到 Link / button / input 等時，應該尊重該元件本身行為
  // - row click 只在「點到非互動區」時觸發
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(
    [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'label',
      '[role="button"]',
      '[role="link"]',
      '[data-no-row-click="true"]',
    ].join(','),
  );

  // 重要：DataTable 會把 <tr> 本身標成 role=button/link（可及性 + keyboard navigation）。
  // - 若我們直接用 closest('[role="button"]')，點到 row 內任何地方都會找到「row 自己」，
  //   反而導致 row click 永遠不會觸發（變成「看起來可點，但其實點了沒反應」）。
  // - 因此這裡要排除 row 本體：只把「row 內的互動元件」視為 interactive target。
  if (interactive && rowEl && interactive === rowEl) return false;

  return Boolean(interactive);
}

export function DataTable<T>(props: {
  rows: T[];
  columns: Array<DataTableColumn<T>>;
  getRowKey: (row: T) => string;
  /** 初始排序（可選）；若 column 沒有 sortValue 會自動忽略 */
  initialSort?: DataTableSortState;
  /** 排序提示（建議提供）：例如「排序僅影響已載入資料」 */
  sortHint?: ReactNode;
  /** 表格密度：compact 適合報表/高密度列表 */
  density?: 'default' | 'compact';
  /** 整列點擊：可用於「點 row 開啟詳情」 */
  onRowClick?: (row: T) => void;
  /** 若提供 href，DataTable 會在 row click 時自動 router.push(href) */
  getRowHref?: (row: T) => string | null | undefined;
  /** row actions：統一放到最右側欄位（避免每頁手刻一個 actions column） */
  rowActions?: (row: T) => ReactNode;
  rowActionsHeader?: ReactNode;
  rowActionsWidth?: number | string;
  className?: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<DataTableSortState | null>(props.initialSort ?? null);
  const density = props.density ?? 'default';
  const hasRowActions = Boolean(props.rowActions);
  const rowClickable = Boolean(props.onRowClick || props.getRowHref);

  const sortColumn = useMemo(() => {
    if (!sort) return null;
    return props.columns.find((c) => c.id === sort.columnId) ?? null;
  }, [props.columns, sort]);

  const sortedRows = useMemo(() => {
    // 沒有 sort 或欄位不可排序：保持輸入順序（對 cursor pagination 很重要）
    if (!sort || !sortColumn?.sortValue) return props.rows;

    const dir = sort.direction === 'asc' ? 1 : -1;
    const withMeta = props.rows.map((row, idx) => ({
      row,
      idx,
      v: sortColumn.sortValue!(row),
    }));

    withMeta.sort((x, y) => {
      const a = x.v;
      const b = y.v;

      // 把空值排到最後（避免「空欄位」佔據最前面）
      if (a === null || a === undefined) return b === null || b === undefined ? x.idx - y.idx : 1;
      if (b === null || b === undefined) return -1;

      const res = cmpPrimitive(a as any, b as any);
      return res === 0 ? x.idx - y.idx : res * dir;
    });

    return withMeta.map((x) => x.row);
  }, [props.rows, sort, sortColumn]);

  function toggleSort(columnId: string) {
    const col = props.columns.find((c) => c.id === columnId);
    if (!col?.sortValue) return;

    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: 'asc' };
      return { columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  function sortIcon(columnId: string) {
    if (!sort || sort.columnId !== columnId) return <span className="sortIcon">↕</span>;
    return <span className="sortIcon">{sort.direction === 'asc' ? '▲' : '▼'}</span>;
  }

  function cellAlignClass(align: DataTableColumn<T>['align']) {
    if (align === 'right') return 'cellRight';
    if (align === 'center') return 'cellCenter';
    return undefined;
  }

  function onActivateRow(e: React.MouseEvent | React.KeyboardEvent, row: T) {
    if (e.defaultPrevented) return;
    if (isInteractiveEventTarget(e.target, e.currentTarget as unknown as HTMLElement | null)) return;

    // Space 在 table row 上的預設行為可能是 page scroll；用 row click 時要阻止它。
    if ('key' in e && e.key === ' ') e.preventDefault();

    const href = props.getRowHref?.(row);
    if (href) {
      router.push(href);
      return;
    }
    props.onRowClick?.(row);
  }

  return (
    <div
      className={[
        'dataTable',
        density === 'compact' ? 'dataTable--compact' : '',
        rowClickable ? 'dataTable--rowClickable' : '',
        hasRowActions ? 'dataTable--hasActions' : '',
        props.className ?? '',
      ].join(' ')}
    >
      <div className="dataTableScroller">
        <table>
          <thead>
            <tr>
              {props.columns.map((c) => {
                const sortable = Boolean(c.sortValue);
                const isActive = sort?.columnId === c.id;
                const ariaSort = sortable
                  ? isActive
                    ? sort?.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                  : undefined;

                return (
                  <th
                    key={c.id}
                    aria-sort={ariaSort as any}
                    style={c.width ? { width: typeof c.width === 'number' ? `${c.width}px` : c.width } : undefined}
                    className={cellAlignClass(c.align)}
                  >
                    {sortable ? (
                      <button type="button" className="thButton" onClick={() => toggleSort(c.id)}>
                        <span>{c.header}</span>
                        {sortIcon(c.id)}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}

              {hasRowActions ? (
                <th
                  className={['cellRight', 'dataTableActionsHeader'].join(' ')}
                  style={
                    props.rowActionsWidth ? { width: typeof props.rowActionsWidth === 'number' ? `${props.rowActionsWidth}px` : props.rowActionsWidth } : undefined
                  }
                >
                  {props.rowActionsHeader ?? 'actions'}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const href = props.getRowHref?.(row) ?? null;
              const isClickable = Boolean(href || props.onRowClick);

              return (
                <tr
                  key={props.getRowKey(row)}
                  tabIndex={isClickable ? 0 : undefined}
                  role={href ? 'link' : isClickable ? 'button' : undefined}
                  onClick={isClickable ? (e) => onActivateRow(e, row) : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') onActivateRow(e, row);
                        }
                      : undefined
                  }
                >
                  {props.columns.map((c) => (
                    <td key={c.id} className={cellAlignClass(c.align)}>
                      {c.cell(row)}
                    </td>
                  ))}

                  {hasRowActions ? (
                    <td className={['cellRight', 'dataTableActionsCell'].join(' ')}>{props.rowActions?.(row)}</td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {props.sortHint ? (
        <div className="muted" style={{ padding: '10px 12px' }}>
          {props.sortHint}
        </div>
      ) : null}
    </div>
  );
}
