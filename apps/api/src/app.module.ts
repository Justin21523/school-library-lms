/**
 * AppModule（NestJS 的根模組）
 *
 * NestJS 的 Module 用來宣告：
 * - 這個模組「包含哪些 controller」（HTTP 路由入口）
 * - 這個模組「提供哪些 provider/service」（商業邏輯/依賴）
 * - 這個模組「依賴哪些其他模組」
 *
 * 我們把每個功能域拆成獨立模組（orgs/locations/users/policies），
 * 讓專案在擴充時不會「所有東西都塞在同一個檔案」。
 */

import { Module } from '@nestjs/common';

// DbModule 是 @Global()，提供 DbService（連線池/交易工具）給所有模組使用。
import { DbModule } from './db/db.module';

// 健康檢查（用來確認 API 有跑起來）。
import { HealthController } from './health/health.controller';
import { OrgsModule } from './orgs/orgs.module';
import { LocationsModule } from './locations/locations.module';
import { UsersModule } from './users/users.module';
import { PoliciesModule } from './policies/policies.module';
import { BibsModule } from './bibs/bibs.module';
import { ItemsModule } from './items/items.module';
import { CirculationModule } from './circulation/circulation.module';
import { LoansModule } from './loans/loans.module';
import { HoldsModule } from './holds/holds.module';

@Module({
  // imports：把子模組「掛進」AppModule，讓 NestJS 掃描它們的 controller/provider。
  imports: [
    DbModule,
    OrgsModule,
    LocationsModule,
    UsersModule,
    PoliciesModule,
    BibsModule,
    ItemsModule,
    CirculationModule,
    LoansModule,
    HoldsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
