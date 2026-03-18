import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { Leave } from '../../entities/leave.entity';
import { User } from '../../entities/user.entity';
import { Department } from '../../entities/department.entity';
import { Designation } from '../../entities/designation.entity';
import { Employee } from '../../entities/employee.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, Leave, User, Department, Designation, Employee]), SharedJwtModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
