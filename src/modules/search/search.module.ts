import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Employee } from '../../entities/employee.entity';
import { Leave } from '../../entities/leave.entity';
import { Team } from '../../entities/team.entity';
import { Attendance } from '../../entities/attendance.entity';
import { User } from '../../entities/user.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { RolesPermissionsService } from '../../common/services/roles-permissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Leave,
      Team,
      Attendance,
      User,
    ]),
    SharedJwtModule,
  ],
  controllers: [SearchController],
  providers: [SearchService, RolesPermissionsService],
  exports: [SearchService],
})
export class SearchModule {}
