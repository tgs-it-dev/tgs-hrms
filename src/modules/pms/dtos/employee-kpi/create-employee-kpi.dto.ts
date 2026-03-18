import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateEmployeeKpiDto {
  @ApiProperty({ example: "uuid-of-employee", description: "Employee ID" })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: "uuid-of-kpi", description: "KPI ID" })
  @IsUUID()
  kpiId: string;

  @ApiProperty({
    example: 80,
    description: "Target percentage value (e.g., 80%)",
  })
  @IsNumber()
  targetValue: number;

  @ApiProperty({
    example: 70,
    description: "Achieved percentage value (e.g., 70%)",
  })
  @IsNumber()
  @IsOptional()
  achievedValue?: number = 0;

  @ApiProperty({
    example: "Q4-2025",
    description: "Review cycle (e.g., Q1-2025)",
  })
  @IsString()
  reviewCycle: string;

  @ApiProperty({
    example: "uuid-of-manager",
    description: "Manager who reviewed this KPI",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  reviewedBy?: string;

  @ApiProperty({
    example: "Good progress overall",
    description: "Remarks or notes",
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}
