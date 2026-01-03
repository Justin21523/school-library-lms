/**
 * Alert（統一訊息盒：info/success/warning/danger）
 *
 * 為什麼要做：
 * - 目前各頁的錯誤/成功訊息呈現不一致（有的用 <p className="error">、有的用 <div> + inline style）
 * - 後續我們要做更多「治理/批次作業」流程（authority merge/backfill 等），訊息量會變大
 *   → 需要一致且可讀的視覺層級（title/body/actions）
 *
 * 設計原則：
 * - 只做最小但可延伸的 API：variant + title + children
 * - 視覺 token/顏色全部走 globals.css（避免每頁 hardcode RGBA）
 */

import type { ReactNode } from 'react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export function Alert(props: {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** role 預設 alert（錯誤/警告更符合可及性）；若你要「純提示」可改成 status。 */
  role?: 'alert' | 'status';
}) {
  const variant = props.variant ?? 'info';
  const role = props.role ?? 'alert';

  return (
    <div className={['alert', `alert--${variant}`, props.className ?? ''].join(' ')} role={role}>
      {props.title ? <div className="alertTitle">{props.title}</div> : null}
      {props.children ? <div className="alertBody">{props.children}</div> : null}
    </div>
  );
}

