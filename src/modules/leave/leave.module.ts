import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leave } from 'src/entities/leave.entity';
import { LeaveType } from 'src/entities/leave-type.entity';
import { User } from '../../entities/user.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { Employee } from 'src/entities/employee.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { LeaveFileUploadService } from './services/leave-file-upload.service';

@Module({
  imports: [TypeOrmModule.forFeature([Leave, LeaveType, User, Employee]), SharedJwtModule],
  providers: [LeaveService, LeaveFileUploadService],
  controllers: [LeaveController],
  exports: [LeaveService],
})
export class LeaveModule {}
