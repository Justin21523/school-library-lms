/**
 * ReportsController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/reports
 *
 * 目前提供：
 * - GET /reports/overdue：逾期清單（JSON/CSV）
 *
 * CSV 輸出策略：
 * - 同一個 endpoint 透過 `?format=csv` 切換回傳格式
 * - 這樣未來新增其他報表也能沿用相同規則（JSON + CSV）
 *
 * 注意：
 * - NestJS 預設使用 Express，但本專案目前未引入 `@types/express`
 * - 因此這裡不使用 `Response` 型別（避免 TypeScript 編譯錯誤）
 */

import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReportsService } from './reports.service';
import {
  circulationSummaryReportQuerySchema,
  overdueReportQuerySchema,
  topCirculationReportQuerySchema,
} from './reports.schemas';

@Controller('api/v1/orgs/:orgId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overdue')
  async overdue(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(overdueReportQuerySchema)) query: any,
    // passthrough：讓我們能設定 header，但仍由 Nest 回傳 body
    @Res({ passthrough: true }) res: any,
  ) {
    const rows = await this.reports.listOverdue(orgId, query);

    // format 預設 json；只有 format=csv 才輸出 CSV。
    const format = (query.format ?? 'json') as 'json' | 'csv';
    if (format === 'csv') {
      // 1) 產生 CSV（含 UTF-8 BOM）
      const csv = this.reports.buildOverdueCsv(rows);

      // 2) 設定回應 header，讓瀏覽器把它當作檔案下載
      // - content-type：指定 charset=utf-8（搭配 BOM，讓 Excel 更穩）
      // - content-disposition：attachment 會觸發下載；filename 提供預設檔名
      const safeDate = new Date().toISOString().slice(0, 10);
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="overdue-${safeDate}.csv"`);
      res.setHeader('cache-control', 'no-store');

      return csv;
    }

    return rows;
  }

  /**
   * US-050：熱門書（Top Circulation）
   *
   * - 同一端點支援 JSON + CSV（?format=csv）
   * - 回傳的是「書目層級」的熱門排行（以 loans 數量統計）
   */
  @Get('top-circulation')
  async topCirculation(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(topCirculationReportQuerySchema)) query: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const rows = await this.reports.listTopCirculation(orgId, query);

    const format = (query.format ?? 'json') as 'json' | 'csv';
    if (format === 'csv') {
      const csv = this.reports.buildTopCirculationCsv(rows);

      const safeFrom = safeIsoDateForFilename(query.from);
      const safeTo = safeIsoDateForFilename(query.to);

      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader(
        'content-disposition',
        `attachment; filename="top-circulation-${safeFrom}-${safeTo}.csv"`,
      );
      res.setHeader('cache-control', 'no-store');
      return csv;
    }

    return rows;
  }

  /**
   * US-050：借閱量彙總（Circulation Summary）
   *
   * - from/to：期間
   * - group_by：彙總顆粒度（day/week/month）
   * - format=csv：輸出 CSV（含 BOM，Excel 友善）
   */
  @Get('circulation-summary')
  async circulationSummary(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(circulationSummaryReportQuerySchema)) query: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const rows = await this.reports.listCirculationSummary(orgId, query);

    const format = (query.format ?? 'json') as 'json' | 'csv';
    if (format === 'csv') {
      const csv = this.reports.buildCirculationSummaryCsv(rows);

      const safeFrom = safeIsoDateForFilename(query.from);
      const safeTo = safeIsoDateForFilename(query.to);

      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader(
        'content-disposition',
        `attachment; filename="circulation-summary-${query.group_by}-${safeFrom}-${safeTo}.csv"`,
      );
      res.setHeader('cache-control', 'no-store');
      return csv;
    }

    return rows;
  }
}

/**
 * 產生檔名用的安全日期字串（YYYY-MM-DD）
 *
 * - 使用者可能傳入任意格式的 from/to（只要 Postgres 能 parse）
 * - 檔名最好不要直接用原字串（可能含冒號/空白，對檔案系統不友善）
 */
function safeIsoDateForFilename(value: unknown) {
  const fallback = new Date().toISOString().slice(0, 10);
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}
