/**
 * AuthorityController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/authority-terms
 *
 * v0 先提供：
 * - GET   /authority-terms            ：管理頁列表/搜尋（cursor pagination）
 * - GET   /authority-terms/suggest    ：autocomplete（回 array）
 * - POST  /authority-terms            ：建立款目
 * - PATCH /authority-terms/:termId    ：更新款目（含停用）
 *
 * v1（thesaurus）追加：
 * - GET    /authority-terms/:termId                 ：款目詳情 + BT/NT/RT
 * - POST   /authority-terms/:termId/relations       ：新增 BT/NT/RT
 * - DELETE /authority-terms/:termId/relations/:id   ：刪除關係
 * - GET    /authority-terms/:termId/expand          ：展開（同義/上下位/相關；供檢索擴充）
 *
 * 權限：
 * - 先以 StaffAuthGuard 保護（authority 是後台主檔）
 */

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { setCsvDownloadHeaders } from '../common/http';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createAuthorityTermSchema,
  createThesaurusRelationSchema,
  exportThesaurusRelationsQuerySchema,
  expandThesaurusQuerySchema,
  importThesaurusRelationsSchema,
  listAuthorityTermsQuerySchema,
  listThesaurusChildrenQuerySchema,
  listThesaurusRootsQuerySchema,
  mergeAuthorityTermSchema,
  authorityTermUsageQuerySchema,
  suggestAuthorityTermsQuerySchema,
  thesaurusAncestorsQuerySchema,
  thesaurusGraphQuerySchema,
  thesaurusQualityQuerySchema,
  updateAuthorityTermSchema,
} from './authority.schemas';
import { AuthorityService } from './authority.service';

@Controller('api/v1/orgs/:orgId/authority-terms')
@UseGuards(StaffAuthGuard)
export class AuthorityController {
  constructor(private readonly authority: AuthorityService) {}

  @Get()
  async list(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(listAuthorityTermsQuerySchema)) query: any,
  ) {
    return await this.authority.list(orgId, query);
  }

  @Get('suggest')
  async suggest(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(suggestAuthorityTermsQuerySchema)) query: any,
  ) {
    return await this.authority.suggest(orgId, query);
  }

  @Post()
  async create(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(createAuthorityTermSchema)) body: any,
  ) {
    return await this.authority.create(orgId, body);
  }

  @Patch(':termId')
  async update(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Body(new ZodValidationPipe(updateAuthorityTermSchema)) body: any,
  ) {
    return await this.authority.update(orgId, termId, body);
  }

  // ----------------------------
  // Thesaurus v1.1：hierarchy browsing（roots/children/ancestors/graph）
  // ----------------------------

  @Get('thesaurus/roots')
  async listThesaurusRoots(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(listThesaurusRootsQuerySchema)) query: any,
  ) {
    return await this.authority.listThesaurusRoots(orgId, query);
  }

  @Get('thesaurus/quality')
  async thesaurusQuality(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(thesaurusQualityQuerySchema)) query: any,
  ) {
    return await this.authority.thesaurusQuality(orgId, query);
  }

  @Get('thesaurus/relations/export')
  async exportThesaurusRelations(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Query(new ZodValidationPipe(exportThesaurusRelationsQuerySchema)) query: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Res({ passthrough: true }) res: any,
  ) {
    const csv = await this.authority.exportThesaurusRelations(orgId, query);
    // Excel 友善：加 BOM + download headers
    setCsvDownloadHeaders(res, `thesaurus-relations-${query.kind}-${query.vocabulary_code}.csv`);
    return csv;
  }

  @Post('thesaurus/relations/import')
  async importThesaurusRelations(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body(new ZodValidationPipe(importThesaurusRelationsSchema)) body: any,
  ) {
    return await this.authority.importThesaurusRelations(orgId, body);
  }

  @Get(':termId')
  async getById(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
  ) {
    return await this.authority.getById(orgId, termId);
  }

  /**
   * usage：term 被哪些 bib 使用（治理用）
   *
   * GET /api/v1/orgs/:orgId/authority-terms/:termId/usage?limit=&cursor=
   */
  @Get(':termId/usage')
  async usage(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Query(new ZodValidationPipe(authorityTermUsageQuerySchema)) query: any,
  ) {
    return await this.authority.getUsage(orgId, termId, query);
  }

  /**
   * merge/redirect：把 source term 併入 target term（治理）
   *
   * POST /api/v1/orgs/:orgId/authority-terms/:termId/merge
   */
  @Post(':termId/merge')
  async merge(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Body(new ZodValidationPipe(mergeAuthorityTermSchema)) body: any,
  ) {
    return await this.authority.merge(orgId, termId, body);
  }

  @Post(':termId/relations')
  async addRelation(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Body(new ZodValidationPipe(createThesaurusRelationSchema)) body: any,
  ) {
    return await this.authority.addRelation(orgId, termId, body);
  }

  @Delete(':termId/relations/:relationId')
  async deleteRelation(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Param('relationId', new ParseUUIDPipe()) relationId: string,
  ) {
    return await this.authority.deleteRelation(orgId, termId, relationId);
  }

  @Get(':termId/expand')
  async expand(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Query(new ZodValidationPipe(expandThesaurusQuerySchema)) query: any,
  ) {
    return await this.authority.expand(orgId, termId, query);
  }

  @Get(':termId/thesaurus/children')
  async listThesaurusChildren(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Query(new ZodValidationPipe(listThesaurusChildrenQuerySchema)) query: any,
  ) {
    return await this.authority.listThesaurusChildren(orgId, termId, query);
  }

  @Get(':termId/thesaurus/ancestors')
  async thesaurusAncestors(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Query(new ZodValidationPipe(thesaurusAncestorsQuerySchema)) query: any,
  ) {
    return await this.authority.getThesaurusAncestors(orgId, termId, query);
  }

  @Get(':termId/thesaurus/graph')
  async thesaurusGraph(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('termId', new ParseUUIDPipe()) termId: string,
    @Query(new ZodValidationPipe(thesaurusGraphQuerySchema)) query: any,
  ) {
    return await this.authority.getThesaurusGraph(orgId, termId, query);
  }
}
