/**
 * ZodValidationPipe（runtime request validation）
 *
 * 為什麼需要這個？
 * - TypeScript 的型別只存在於「編譯期」，HTTP request 進來的是不可信 JSON
 * - 若不驗證，錯誤資料可能直接進 DB（或造成 500）
 *
 * NestJS 的 Pipe 是「在 controller 收到參數之前」先做轉換/驗證的機制。
 * 這支 pipe 用 zod schema 驗證 body，失敗就回 400（BadRequest）。
 */

import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodError, ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  // schema 是你在各 module 裡定義的 zod schema（例如 createOrgSchema）。
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    // safeParse：不會 throw；回傳 success/failed。
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    // 以一致的錯誤格式回傳 400，讓前端可以穩定地顯示錯誤。
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: formatZodError(result.error),
      },
    });
  }
}

function formatZodError(error: ZodError) {
  // 把 zod 的 issue 轉成「前端好用」的結構：
  // - path：哪個欄位出錯（例如 "name" 或 "address.city"）
  // - message：人類可讀訊息
  // - code：zod 的錯誤類型
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}
