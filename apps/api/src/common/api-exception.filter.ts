/**
 * ApiExceptionFilter（全域例外處理）
 *
 * 目的：
 * - 讓 API 在「非預期錯誤」時，也能回傳一致的錯誤格式：`{ error: { code, message, details? } }`
 * - 讓 Web 端的 `requestJson()` 不用猜（避免拿到 HTML 500/純文字而顯示成「頁面壞掉」）
 *
 * 為什麼這在我們的情境特別重要？
 * - monorepo 開發最常見的痛點是「DB 沒套 schema / schema 過舊」→ 會噴 pg 錯誤（undefined_table/undefined_column）
 * - 如果沒有統一包裝，前端只會看到 HTTP 500，很難知道「該先跑 demo-db seed」來補齊 schema
 *
 * 注意：
 * - HttpException（例如 ZodValidationPipe/ConflictException）本來就會帶 `{ error: ... }`
 *   → 我們要「保留」既有 body，不要把已經很好的錯誤格式變差
 * - production 不回傳 stack trace（避免洩漏內部細節）
 */

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    // 1) 既有 HttpException：盡量保持原狀（尤其是我們已經用 `{ error: ... }` 的地方）
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // Nest 的 getResponse 可能是 string 或 object；我們只在「不是我們的格式」時才包一層。
      if (isApiErrorBody(response)) {
        reply.status(status).send(response);
        return;
      }

      const message =
        typeof response === 'string'
          ? response
          : typeof (response as any)?.message === 'string'
            ? (response as any).message
            : exception.message || `HTTP ${status}`;

      reply.status(status).send({
        error: {
          code: httpStatusToCode(status),
          message,
          details: typeof response === 'object' ? response : undefined,
        },
      } satisfies ApiErrorBody);
      return;
    }

    // 2) pg 錯誤：特別把「schema 缺漏/版本過舊」轉成可操作的提示
    if (isPgError(exception)) {
      const mapped = mapPgError(exception);
      reply.status(mapped.status).send({
        error: { code: mapped.code, message: mapped.message, details: mapped.details },
      } satisfies ApiErrorBody);
      return;
    }

    // 3) 其他未知錯誤：回 500（但仍維持一致格式）
    const message = exception instanceof Error ? exception.message : String(exception);
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: message || 'Internal server error',
      },
    } satisfies ApiErrorBody);
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const error = record['error'];
  if (!error || typeof error !== 'object') return false;
  const errorRecord = error as Record<string, unknown>;
  return typeof errorRecord['code'] === 'string' && typeof errorRecord['message'] === 'string';
}

function httpStatusToCode(status: number) {
  // 對應前端顯示時用的 code（不追求完整，只求穩定）
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    default:
      return `HTTP_${status}`;
  }
}

type PgError = { code: string; message?: string };

function isPgError(value: unknown): value is PgError {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record['code'] === 'string' && record['code'].length >= 4;
}

function mapPgError(error: PgError): { status: number; code: string; message: string; details?: unknown } {
  // SQLSTATE 參考：
  // - 42P01 undefined_table
  // - 42703 undefined_column
  // - 42883 undefined_function（常見於 schema 版本不一致：新增了 DB function 但 DB 還沒套用）
  const isSchemaMissing = error.code === '42P01' || error.code === '42703' || error.code === '42883';

  if (isSchemaMissing) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'DB_SCHEMA_MISSING',
      message:
        '資料庫 schema 缺漏或版本過舊，請先套用 db/schema.sql（建議：`npm run demo:db:seed`；若要清空重建：`npm run demo:db:reset`）。',
      details: { pg_code: error.code },
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'DB_ERROR',
    message: error.message || 'Database error',
    details: { pg_code: error.code },
  };
}
