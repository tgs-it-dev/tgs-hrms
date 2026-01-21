import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { Geofence } from '../../entities/geofence.entity';
import { Team } from '../../entities/team.entity';
import { GeofenceController } from './geofence.controller';
import { GeofenceService } from './geofence.service';

@Module({
  imports: [TypeOrmModule.forFeature([Geofence, Team]), SharedJwtModule],
  controllers: [GeofenceController],
  providers: [GeofenceService],
  exports: [GeofenceService],
})
export class GeofenceModule {}

