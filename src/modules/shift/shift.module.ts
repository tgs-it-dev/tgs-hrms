import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftService } from './shift.service';
import { ShiftController } from './shift.controller';
import { Shift } from '../../entities/shift.entity';
import { Employee } from '../../entities/employee.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [TypeOrmModule.forFeature([Shift, Employee, Tenant]), SharedJwtModule],
  providers: [ShiftService, TenantDatabaseService],
  controllers: [ShiftController],
  exports: [ShiftService],
})
export class ShiftModule {}
