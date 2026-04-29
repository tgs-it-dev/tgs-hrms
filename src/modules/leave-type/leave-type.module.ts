import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LeaveType } from "../../entities/leave-type.entity";
import { LeaveTypeService } from "./leave-type.service";
import { LeaveTypeController } from "./leave-type.controller";
import { SharedJwtModule } from "../../common/modules/jwt.module";
import { TenantModule } from "../tenant/tenant.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveType]),
    SharedJwtModule,
    TenantModule,
  ],
  providers: [LeaveTypeService],
  controllers: [LeaveTypeController],
  exports: [LeaveTypeService],
})
export class LeaveTypeModule {}
