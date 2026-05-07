import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { Geofence } from '../../entities/geofence.entity';
import { Team } from '../../entities/team.entity';
import { Employee } from '../../entities/employee.entity';
import { GeofenceController } from './geofence.controller';
import { GeofenceService } from './geofence.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Geofence, Team, Employee]),
    SharedJwtModule,
    TenantModule,
  ],
  controllers: [GeofenceController],
  providers: [GeofenceService],
  exports: [GeofenceService],
})
export class GeofenceModule {}

