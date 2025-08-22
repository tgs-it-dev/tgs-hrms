import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leave } from 'src/entities/leave.entity';
import { User } from '../../entities/user.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([Leave, User]), CommonModule],
  providers: [LeaveService],
  controllers: [LeaveController],
  exports: [LeaveService],
})
export class LeaveModule {}
