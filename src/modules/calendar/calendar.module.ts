import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarCacheService } from './calendar-cache.service';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [SharedJwtModule, TenantModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarCacheService],
  exports: [CalendarCacheService],
})
export class CalendarModule {}
