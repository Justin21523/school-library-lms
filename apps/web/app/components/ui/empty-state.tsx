/**
 * EmptyState（統一空狀態）
 *
 * 典型場景：
 * - 查詢沒有命中（0 筆）
 * - 首次進入頁面但尚未建立任何資料（例如沒有 org / 沒有 locations）
 *
 * 重點：
 * - 空狀態不是「錯誤」：不要用紅字，避免造成心理壓力
 * - 但要提供下一步：例如「建立」「清除篩選」「回到上一頁」
 */

import type { ReactNode } from 'react';

export function EmptyState(props: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={['emptyState', props.className ?? ''].join(' ')}>
      <div className="emptyStateTitle">{props.title}</div>
      {props.description ? <div className="emptyStateDescription">{props.description}</div> : null}
      {props.actions ? <div className="emptyStateActions">{props.actions}</div> : null}
    </div>
  );
}

