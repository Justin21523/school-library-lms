/**
 * AuthorityModule
 *
 * v0：Authority / Vocabulary（權威控制檔）先做成獨立模組，原因：
 * - 它會同時被後台（編目）與未來的匯入器（MARC/CSV）用到
 * - 之後要擴充 thesaurus 關係（BT/NT/RT/USE/UF）或 authority linking，也比較好演進
 */

import { Module } from '@nestjs/common';
import { AuthorityController } from './authority.controller';
import { AuthorityService } from './authority.service';

@Module({
  controllers: [AuthorityController],
  providers: [AuthorityService],
})
export class AuthorityModule {}

