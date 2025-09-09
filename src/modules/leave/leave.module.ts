import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leave } from 'src/entities/leave.entity';
import { User } from '../../entities/user.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { Employee } from 'src/entities/employee.entity';
import { HolidayModule } from '../holiday/holiday.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Leave, User, Employee]),
    HolidayModule,
  ],
  providers: [LeaveService],
  controllers: [LeaveController],
  exports: [LeaveService],
})
export class LeaveModule {}
