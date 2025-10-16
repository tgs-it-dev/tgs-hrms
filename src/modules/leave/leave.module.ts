import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leave } from 'src/entities/leave.entity';
import { User } from '../../entities/user.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { Employee } from 'src/entities/employee.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Leave, User, Employee]), SharedJwtModule],
  providers: [LeaveService],
  controllers: [LeaveController],
  exports: [LeaveService],
})
export class LeaveModule {}
