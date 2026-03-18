import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leave } from '../../entities/leave.entity';
import { LeaveType } from '../../entities/leave-type.entity';
import { User } from '../../entities/user.entity';
import { Employee } from '../../entities/employee.entity';
import { LeaveReportsService } from './leave-reports.service';
import { LeaveReportsController } from './leave-reports.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Leave, LeaveType, User, Employee]), SharedJwtModule],
  providers: [LeaveReportsService],
  controllers: [LeaveReportsController],
  exports: [LeaveReportsService],
})
export class LeaveReportsModule {}
