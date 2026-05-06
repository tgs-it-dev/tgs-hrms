import { Module } from "@nestjs/common";
import { SystemController } from "./system.controller";
import { SystemService } from "./system.service";
import { SystemTenantService } from "./system-tenant/system-tenant.service";
import { SystemTenantController } from "./system-tenant/system-tenant.controller";
import { SystemEmployeeController } from "./system-employee/system-employee.controller";
import { SystemLeaveController } from "./system-leave/system-leave.controller";
import { SystemLeaveService } from "./system-leave/system-leave.service";
import { SystemEmployeeService } from "./system-employee/system-employee.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Tenant } from "src/entities/tenant.entity";
import { Employee } from "src/entities/employee.entity";
import { Department } from "src/entities/department.entity";
import { Designation } from "src/entities/designation.entity";
import { SystemLog } from "src/entities/system-log.entity";
import { SharedJwtModule } from "src/common/modules/jwt.module";
import { Leave } from "src/entities/leave.entity";
import { User } from "src/entities/user.entity";
import { Role } from "src/entities/role.entity";
import { EmailModule } from "src/common/utils/email/email.module";
import { CompanyDetails } from "src/entities/company-details.entity";
import { SignupSession } from "src/entities/signup-session.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      Employee,
      Department,
      Designation,
      SystemLog,
      Leave,
      User,
      Role,
      CompanyDetails,
      SignupSession,
    ]),
    SharedJwtModule,
    EmailModule,
  ],
  providers: [
    SystemService,
    SystemTenantService,
    SystemLeaveService,
    SystemEmployeeService,
  ],
  controllers: [
    SystemController,
    SystemTenantController,
    SystemEmployeeController,
    SystemLeaveController,
  ],
  exports: [
    SystemService,
    SystemTenantService,
    SystemLeaveService,
    SystemEmployeeService,
  ],
})
export class SystemModule {}
