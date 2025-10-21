import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateEmployeeKpiDto } from "./create-employee-kpi.dto";

export class UpdateEmployeeKpiDto extends PartialType(
  OmitType(CreateEmployeeKpiDto, ["employeeId", "kpiId"] as const),
) {}
