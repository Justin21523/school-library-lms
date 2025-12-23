/**
 * OrgsModule
 *
 * 一個模組（Module）通常包含：
 * - controller：負責 HTTP 路由
 * - provider/service：負責商業邏輯
 *
 * NestJS 透過 Module 把功能切成可管理的單位。
 */

import { Module } from '@nestjs/common';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';

@Module({
  controllers: [OrgsController],
  providers: [OrgsService],
})
export class OrgsModule {}
