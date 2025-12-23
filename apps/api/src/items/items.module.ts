/**
 * ItemsModule
 *
 * 封裝 item_copies（冊）的 Controller/Service。
 */

import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
