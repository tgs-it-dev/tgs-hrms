import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteStatusService } from './invite-status.service';
import { InviteStatusCronService } from './invite-status-cron.service';
import { InviteStatusController } from './invite-status.controller';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, User]), SharedJwtModule],
  providers: [InviteStatusService, InviteStatusCronService],
  controllers: [InviteStatusController],
  exports: [InviteStatusService],
})
export class InviteStatusModule {}
