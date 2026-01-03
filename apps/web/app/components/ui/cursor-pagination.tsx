/**
 * CursorPagination（keyset/cursor-based 分頁）
 *
 * 背景：
 * - 本專案 API 的列表端點多採 keyset pagination（next_cursor）
 * - 好處：比 offset 分頁更穩定/效能更好，且不怕資料新增/刪除導致跳頁
 *
 * UX 注意：
 * - 使用者仍需要「我現在看到多少」「還有沒有下一頁」的明確回饋
 * - 這個元件統一顯示 meta + Load more 按鈕（避免每頁都手刻）
 */

import type { ReactNode } from 'react';

export function CursorPagination(props: {
  /** 目前已顯示幾筆（通常是 items.length） */
  showing: number;
  /** API 回傳的 next_cursor；null 代表沒有下一頁 */
  nextCursor: string | null;
  /** 是否正在載入下一頁 */
  loadingMore?: boolean;
  /** 是否正在「整頁刷新」；用來避免刷新時又按 load more */
  loading?: boolean;
  /** 點擊 Load more 時要做的事 */
  onLoadMore: () => void;
  /** 你想顯示在 meta 的補充資訊（例如 total、limit、filters） */
  meta?: ReactNode;
  /** 按鈕文案（預設：載入更多） */
  loadMoreLabel?: string;
  className?: string;
}) {
  const disabled = Boolean(props.loadingMore || props.loading);
  const loadMoreLabel = props.loadMoreLabel ?? '載入更多';

  return (
    <div className={['paginationBar', props.className ?? ''].join(' ')}>
      <div className="paginationMeta">
        {props.meta ? (
          props.meta
        ) : (
          <>
            showing <code>{props.showing}</code> · next_cursor={props.nextCursor ? '有' : '無'}
          </>
        )}
      </div>

      {props.nextCursor ? (
        <button type="button" className="btnSmall" onClick={props.onLoadMore} disabled={disabled}>
          {props.loadingMore ? '載入中…' : loadMoreLabel}
        </button>
      ) : (
        <span className="muted">已到最後</span>
      )}
    </div>
  );
}
