/**
 * BibsModule
 *
 * 封裝書目（bibliographic_records）相關的 Controller/Service。
 * 讓書目功能能獨立擴充、避免 AppModule 過度膨脹。
 */

import { Module } from '@nestjs/common';
import { BibsController } from './bibs.controller';
import { BibsService } from './bibs.service';

@Module({
  controllers: [BibsController],
  providers: [BibsService],
})
export class BibsModule {}
