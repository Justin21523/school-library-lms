/**
 * LocationsModule
 *
 * 把 locations 相關的 controller/service 組在一起。
 * 之後若要加「更新/停用 location」也會放在這個模組。
 */

import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
