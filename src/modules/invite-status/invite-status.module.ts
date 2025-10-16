import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteStatusService } from './invite-status.service';
import { InviteStatusCronService } from './invite-status-cron.service';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, User])],
  providers: [InviteStatusService, InviteStatusCronService],
  exports: [InviteStatusService],
})
export class InviteStatusModule {}
