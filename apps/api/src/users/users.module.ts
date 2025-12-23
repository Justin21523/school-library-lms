/**
 * UsersModule
 *
 * users 是很多流程的基礎（借還、預約、報表），所以我們先把最小 CRUD 做起來。
 * 下一輪的 CSV 匯入（US-010）也會放在這個模組。
 */

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
