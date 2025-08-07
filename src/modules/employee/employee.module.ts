import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
<<<<<<< HEAD:src/modules/auth/employee/employee.module.ts

import { Employee } from '../../../entities/employee.entity';
import { Department } from '../../../entities/department.entity';
import { Designation } from '../../../entities/designation.entity';

=======
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Designation } from '../../entities/designation.entity';
>>>>>>> f8733365c0be7be458563aba4fbde274042d2307:src/modules/employee/employee.module.ts
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { Role } from 'src/entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, User, Designation,Role]),

  ],
  controllers: [EmployeeController],
  providers: [EmployeeService],
})
export class EmployeeModule {}
