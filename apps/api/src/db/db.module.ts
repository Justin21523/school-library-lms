/**
 * DbModule（資料庫模組）
 *
 * 這裡使用 `@Global()` 代表：
 * - DbService 會變成「全域可注入」的 provider
 * - 其他模組不需要每次都 imports DbModule，也能直接注入 DbService
 *
 * 對小型 MVP 來說，這可以降低樣板程式碼（boilerplate）。
 */

import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';

@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
