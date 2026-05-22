import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteStatusService } from './invite-status.service';
import { InviteStatusCronService } from './invite-status-cron.service';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, User, Tenant])],
  providers: [InviteStatusService, InviteStatusCronService, TenantDatabaseService],
  exports: [InviteStatusService],
})
export class InviteStatusModule {}
