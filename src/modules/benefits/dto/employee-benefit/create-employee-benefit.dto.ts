import { IsNotEmpty, IsOptional, IsUUID, IsIn, IsDate } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class CreateEmployeeBenefitDto {
  @ApiProperty({
    example: "user_456_uuid",
    description: "Employee ID who receives the benefit",
  })
  @IsNotEmpty()
  @IsUUID()
  employeeId: string;

  @ApiProperty({
    example: "benefit_123_uuid",
    description: "Benefit ID assigned to the employee",
  })
  @IsNotEmpty()
  @IsUUID()
  benefitId: string;

  @ApiProperty({
    example: "2025-01-01",
    description: "Benefit start date (ISO format)",
  })
  @Transform(({ value }: { value: string }) => new Date(value))
  @IsDate()
  startDate: Date;

  @ApiProperty({
    example: "2025-12-31",
    description: "Benefit end date (optional, ISO format)",
    required: false,
  })
  @Transform(({ value }: { value?: string }) =>
    value ? new Date(value) : null,
  )
  @IsOptional()
  @IsDate()
  endDate?: string;

  @ApiProperty({
    example: "active",
    enum: ["active", "expired", "cancelled"],
    description: "Status of the benefit assignment",
    required: false,
  })
  @IsOptional()
  @IsIn(["active", "expired", "cancelled"])
  status?: "active" | "expired" | "cancelled";
}
