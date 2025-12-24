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
    return code ? `${statusLabel} · ${code} · ${message}` : `${statusLabel} · ${message}`;
  }

  // 2) 一般 Error：直接顯示 message
  if (error instanceof Error) return error.message;

  // 3) 非 Error 物件（極少數）：保底轉字串
  return String(error);
}

