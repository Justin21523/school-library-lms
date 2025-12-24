/**
 * MeModule
 *
 * 這個模組專門承載「登入後的讀者自助」API：
 * - /me（我的資料）
 * - /me/loans（我的借閱）
 * - /me/holds（我的預約）
 *
 * 為什麼獨立成 module？
 * - OPAC 的匿名版本（/holds?user_external_id=...）屬於「可用但不安全」
 * - MeModule 則是「安全版本」：需要 PatronAuthGuard，並且 user_id 由 token 推導
 */

import { Module } from '@nestjs/common';
import { HoldsModule } from '../holds/holds.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [HoldsModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}

