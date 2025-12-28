/**
 * BibsController
 *
 * 路由前綴：/api/v1/orgs/:orgId/bibs
 * - GET   列出/搜尋書目（query/isbn/classification）
 * - POST  建立書目
 * - GET   取得單一書目（含可借冊數）
 * - PATCH 更新書目
 *
 * 書目屬於 organization，因此所有操作都以 orgId 作為多租戶邊界。
 */

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { serializeIso2709, serializeMarcXml } from '../common/marc';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BibsService } from './bibs.service';
import {
  createBibliographicSchema,
  getBibMarcQuerySchema,
  importCatalogCsvSchema,
  importMarcBatchSchema,
  listBibsQuerySchema,
  backfillBibGeographicTermsSchema,
  backfillBibGenreTermsSchema,
  backfillBibNameTermsSchema,
  backfillBibSubjectTermsSchema,
  updateMarcExtrasSchema,
  updateBibliographicSchema,
} from './bibs.schemas';

@Controller('api/v1/orgs/:orgId/bibs')
export class BibsController {
  constructor(private readonly bibs: BibsService) {}

  @Get()
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(listBibsQuerySchema)) query: any,
  ) {
    // query/isbn/classification 皆為可選；未提供時回傳最新 200 筆。
    return await this.bibs.list(orgId, query);
  }

  @UseGuards(StaffAuthGuard)
  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createBibliographicSchema)) body: any,
  ) {
    return await this.bibs.create(orgId, body);
  }

  /**
   * US-022：書目/冊 CSV 匯入（preview/apply）
   *
   * POST /api/v1/orgs/:orgId/bibs/import
   *
   * - preview：不寫 DB，只回傳 plan/錯誤
   * - apply：寫 DB + 寫 audit_events
   */
  @UseGuards(StaffAuthGuard)
  @Post('import')
  async importCatalogCsv(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(importCatalogCsvSchema)) body: any,
  ) {
    return await this.bibs.importCatalogCsv(orgId, body);
  }

  /**
   * MARC 批次匯入（preview/apply）
   *
   * POST /api/v1/orgs/:orgId/bibs/import-marc
   *
   * 設計對齊 US-022 的模式：
   * - preview：不寫 DB，只回傳去重/建議動作/錯誤
   * - apply：只有在無錯誤時才寫 DB，並寫一筆 audit_events
   */
  @UseGuards(StaffAuthGuard)
  @Post('import-marc')
  async importMarcBatch(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(importMarcBatchSchema)) body: any,
  ) {
    return await this.bibs.importMarcBatch(orgId, body);
  }

  /**
   * Maintenance：subjects backfill（既有資料 → authority linking）
   *
   * POST /api/v1/orgs/:orgId/bibs/maintenance/backfill-subject-terms
   *
   * - preview：transaction + ROLLBACK（回傳報表，不寫 DB）
   * - apply：COMMIT + 寫 audit_events（可追溯）
   */
  @UseGuards(StaffAuthGuard)
  @Post('maintenance/backfill-subject-terms')
  async backfillSubjectTerms(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(backfillBibSubjectTermsSchema)) body: any,
  ) {
    return await this.bibs.backfillSubjectTerms(orgId, body);
  }

  /**
   * Maintenance：names backfill（既有 creators/contributors → name linking v1）
   *
   * POST /api/v1/orgs/:orgId/bibs/maintenance/backfill-name-terms
   *
   * - preview：transaction + ROLLBACK（回傳報表，不寫 DB）
   * - apply：COMMIT + 寫 audit_events（可追溯）
   */
  @UseGuards(StaffAuthGuard)
  @Post('maintenance/backfill-name-terms')
  async backfillNameTerms(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(backfillBibNameTermsSchema)) body: any,
  ) {
    return await this.bibs.backfillNameTerms(orgId, body);
  }

  /**
   * Maintenance：geographics backfill（既有資料 → authority linking v1.3）
   *
   * POST /api/v1/orgs/:orgId/bibs/maintenance/backfill-geographic-terms
   *
   * - preview：transaction + ROLLBACK（回傳報表，不寫 DB）
   * - apply：COMMIT + 寫 audit_events（可追溯）
   */
  @UseGuards(StaffAuthGuard)
  @Post('maintenance/backfill-geographic-terms')
  async backfillGeographicTerms(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(backfillBibGeographicTermsSchema)) body: any,
  ) {
    return await this.bibs.backfillGeographicTerms(orgId, body);
  }

  /**
   * Maintenance：genres backfill（既有資料 → authority linking v1.3）
   *
   * POST /api/v1/orgs/:orgId/bibs/maintenance/backfill-genre-terms
   *
   * - preview：transaction + ROLLBACK（回傳報表，不寫 DB）
   * - apply：COMMIT + 寫 audit_events（可追溯）
   */
  @UseGuards(StaffAuthGuard)
  @Post('maintenance/backfill-genre-terms')
  async backfillGenreTerms(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(backfillBibGenreTermsSchema)) body: any,
  ) {
    return await this.bibs.backfillGenreTerms(orgId, body);
  }

  /**
   * Bib → MARC 匯出（進階編目基礎）
   *
   * GET /api/v1/orgs/:orgId/bibs/:bibId/marc?format=json|xml|mrc
   *
   * 設計：
   * - 由「表單欄位」產生 MARC core fields
   * - 再把 bibliographic_records.marc_extras append（保留未覆蓋欄位）
   *
   * 權限：
   * - 先以 StaffAuthGuard 保護（避免 OPAC 端暴露過多內部編目細節）
   * - 若未來需要對外提供 MARC，可再新增公開/匿名的匯出策略（例如只輸出可公開欄位）
   */
  @UseGuards(StaffAuthGuard)
  @Get(':bibId/marc')
  async marc(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('bibId', new ParseUUIDPipe()) bibId: string,
    @Query(new ZodValidationPipe(getBibMarcQuerySchema)) query: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const record = await this.bibs.getMarcRecord(orgId, bibId);

    const format = (query.format ?? 'json') as 'json' | 'xml' | 'mrc';
    if (format === 'xml') {
      const xml = serializeMarcXml(record);
      setDownloadHeaders(res, `bib-${bibId}.xml`, 'application/marcxml+xml; charset=utf-8');
      return xml;
    }

    if (format === 'mrc') {
      const mrc = serializeIso2709(record);
      setDownloadHeaders(res, `bib-${bibId}.mrc`, 'application/octet-stream');
      return mrc;
    }

    // format=json：直接回傳 JSON（API client 方便 parse）
    return record;
  }

  /**
   * marc_extras（讀取）
   *
   * GET /api/v1/orgs/:orgId/bibs/:bibId/marc-extras
   *
   * 回傳：
   * - sanitize 後的 MarcField[]
   */
  @UseGuards(StaffAuthGuard)
  @Get(':bibId/marc-extras')
  async getMarcExtras(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('bibId', new ParseUUIDPipe()) bibId: string,
  ) {
    return await this.bibs.getMarcExtras(orgId, bibId);
  }

  /**
   * marc_extras（更新）
   *
   * PUT /api/v1/orgs/:orgId/bibs/:bibId/marc-extras
   *
   * body：
   * - marc_extras: MarcField[]
   */
  @UseGuards(StaffAuthGuard)
  @Put(':bibId/marc-extras')
  async updateMarcExtras(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('bibId', new ParseUUIDPipe()) bibId: string,
    @Body(new ZodValidationPipe(updateMarcExtrasSchema)) body: any,
  ) {
    return await this.bibs.updateMarcExtras(orgId, bibId, body.marc_extras);
  }

  @Get(':bibId')
  async getById(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('bibId', new ParseUUIDPipe()) bibId: string,
  ) {
    return await this.bibs.getById(orgId, bibId);
  }

  @UseGuards(StaffAuthGuard)
  @Patch(':bibId')
  async update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('bibId', new ParseUUIDPipe()) bibId: string,
    @Body(new ZodValidationPipe(updateBibliographicSchema)) body: any,
  ) {
    return await this.bibs.update(orgId, bibId, body);
  }
}

/**
 * Header 設定：同時支援 Fastify / Express
 *
 * 注意：本專案 API 目前使用 NestJS + Fastify，但我們避免綁死在特定框架的 Response 介面。
 */
function setHeaderCompat(res: any, name: string, value: string) {
  if (!res) return;

  if (typeof res.header === 'function') {
    res.header(name, value);
    return;
  }

  if (typeof res.setHeader === 'function') {
    res.setHeader(name, value);
    return;
  }

  if (res.raw && typeof res.raw.setHeader === 'function') {
    res.raw.setHeader(name, value);
  }
}

function setDownloadHeaders(res: any, filename: string, contentType: string) {
  setHeaderCompat(res, 'content-type', contentType);
  setHeaderCompat(res, 'content-disposition', `attachment; filename="${filename}"`);
  setHeaderCompat(res, 'cache-control', 'no-store');
}
