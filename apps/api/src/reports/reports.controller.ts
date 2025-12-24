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
import { overdueReportQuerySchema } from './reports.schemas';

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
}
