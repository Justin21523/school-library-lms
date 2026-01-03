/**
 * JobsController（HTTP layer）
 *
 * 路由前綴：/api/v1/orgs/:orgId/jobs
 *
 * 目標：
 * - 把可能很久的操作（maintenance/import/report）改成「enqueue job」：
 *   - HTTP request 快速回 202 + job_id
 *   - 前端用 job_id 查狀態（running/succeeded/failed）
 *
 * 這一版先落地最小可用：
 * - enqueue holds.expire_ready（到書未取到期處理）
 * - get job status
 */

import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { enqueueExpireReadyHoldsJobSchema } from './jobs.schemas';
import { JobsService } from './jobs.service';

@UseGuards(StaffAuthGuard)
@Controller('api/v1/orgs/:orgId/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  private requireStaffUserId(req: any) {
    const userId = req?.staff_user?.id;
    if (typeof userId === 'string' && userId.trim()) return userId.trim();
    throw new UnauthorizedException({
      error: { code: 'UNAUTHORIZED', message: 'Missing authenticated staff user' },
    });
  }

  /**
   * enqueue: holds.expire_ready（apply）
   *
   * POST /api/v1/orgs/:orgId/jobs/holds-expire-ready
   */
  @Post('holds-expire-ready')
  @HttpCode(202)
  async enqueueExpireReadyHolds(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Req() req: any,
    @Body(new ZodValidationPipe(enqueueExpireReadyHoldsJobSchema)) body: any,
  ) {
    const actorUserId = this.requireStaffUserId(req);
    return await this.jobs.enqueueExpireReadyHolds(orgId, actorUserId, body);
  }

  /**
   * get status
   *
   * GET /api/v1/orgs/:orgId/jobs/:jobId
   */
  @Get(':jobId')
  async getById(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ) {
    return await this.jobs.getById(orgId, jobId);
  }
}

