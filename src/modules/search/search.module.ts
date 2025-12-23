import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Employee } from '../../entities/employee.entity';
import { Leave } from '../../entities/leave.entity';
import { Asset } from '../../entities/asset.entity';
import { AssetRequest } from '../../entities/asset-request.entity';
import { Team } from '../../entities/team.entity';
import { Attendance } from '../../entities/attendance.entity';
import { EmployeeBenefit } from '../../entities/employee-benefit.entity';
import { PayrollRecord } from '../../entities/payroll-record.entity';
import { User } from '../../entities/user.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Leave,
      Asset,
      AssetRequest,
      Team,
      Attendance,
      EmployeeBenefit,
      PayrollRecord,
      User,
    ]),
    SharedJwtModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
