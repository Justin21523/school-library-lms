/**
 * AuditModule
 *
 * audit（稽核）是跨功能域的「橫切」能力：
 * - circulation/holds/items/... 都會寫 audit_events
 * - audit module 則提供「查詢」與未來可能的「匯出/保留期限」等能力
 */

import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}

