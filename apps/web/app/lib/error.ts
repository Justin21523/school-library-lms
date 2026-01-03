/**
 * UI 用的錯誤格式化工具
 *
 * 我們在 Web 端把錯誤分成兩類：
 * 1) ApiError：API 有回應（含 HTTP status 與 `{ error: ... }` body）
 * 2) 其他 Error：例如 fetch 連線失敗、程式自身 bug
 *
 * 這個檔案的目標，是讓每個頁面都能用一致的方式顯示錯誤，
 * 而不是每個頁面都重複寫一堆 if/else。
 */

import { ApiError } from './api';

export function formatErrorMessage(error: unknown) {
  // 1) API error：把 status + code + message 組成一行可讀訊息
  if (error instanceof ApiError) {
    const statusLabel = error.status ? `HTTP ${error.status}` : 'NETWORK';
    const code = error.body?.error?.code;
    const message = error.body?.error?.message ?? error.message;
    const requestHint =
      error.request && error.request.url ? ` · ${error.request.method} ${error.request.url}` : '';

    // 特例：連線失敗（多半是 API 沒啟動 / baseUrl 配錯 / CORS）
    // - 在大量頁面同時報錯時，顯示「打到哪個 URL」會大幅降低除錯時間
    if (error.status === 0) {
      // 補充提示：若 URL 指到 docker compose service name（例如 http://api:3001），
      // 在「本機瀏覽器」通常無法解析 `api` → 會誤以為 API 沒啟動。
      //
      // 這個提示主要是為了減少現場除錯成本：一眼就能知道是 baseUrl 指錯環境。
      let dockerHostHint = '';
      const urlText = error.request?.url ?? '';
      if (urlText) {
        try {
          const u = new URL(urlText);
          if (u.hostname === 'api') {
            dockerHostHint =
              '（你目前打到 docker 內網 host `api`；若你是用本機瀏覽器開 Web，請把 NEXT_PUBLIC_API_BASE_URL 改成 http://localhost:3001 並重建 web）';
          }
        } catch {
          // ignore
        }
      }

      return `NETWORK · 無法連線到 API${requestHint}${dockerHostHint}（請確認 API 是否已啟動、port 是否一致，或調整 NEXT_PUBLIC_API_BASE_URL）`;
    }

    // 特例：逾期停權（Policy enforcement）
    // - 這是現場最常被問的錯誤：「為什麼不能借？」
    // - 因此我們把 details 裡的門檻/天數一起顯示，讓館員能直接回答讀者
    if (code === 'BORROWING_BLOCKED_DUE_TO_OVERDUE') {
      const details = error.body?.error?.details as any;
      const overdueBlockDays = typeof details?.overdue_block_days === 'number' ? details.overdue_block_days : null;
      const maxDaysOverdue = typeof details?.max_days_overdue === 'number' ? details.max_days_overdue : null;
      const overdueLoanCount = typeof details?.overdue_loan_count === 'number' ? details.overdue_loan_count : null;

      const parts: string[] = [];
      if (maxDaysOverdue !== null && overdueBlockDays !== null) {
        parts.push(`max_days_overdue=${maxDaysOverdue} >= ${overdueBlockDays}`);
      }
      if (overdueLoanCount !== null) parts.push(`overdue_loan_count=${overdueLoanCount}`);

      const suffix = parts.length > 0 ? `（${parts.join(' · ')}）` : '';
      return code ? `${statusLabel} · ${code} · ${message}${suffix}` : `${statusLabel} · ${message}`;
    }

    return code ? `${statusLabel} · ${code} · ${message}` : `${statusLabel} · ${message}`;
  }

  // 2) 一般 Error：直接顯示 message
  if (error instanceof Error) return error.message;

  // 3) 非 Error 物件（極少數）：保底轉字串
  return String(error);
}
