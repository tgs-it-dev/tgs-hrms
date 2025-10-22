import { ApiProperty } from "@nestjs/swagger";

export class GetAllEmployeesWithBenefitsBenefitDto {
  @ApiProperty({ example: "benefit-uuid-123" })
  id: string; // <-- Add this line
  @ApiProperty({ example: "Health Insurance" })
  name: string;

  @ApiProperty({ example: "active" })
  status: string;
}

export class GetAllEmployeesWithBenefitsResponseDto {
  @ApiProperty({ example: "emp_123" })
  employeeId: string;

  @ApiProperty({ example: "Ali Khan" })
  employeeName: string;

  @ApiProperty({ example: "Finance" })
  department: string;

  @ApiProperty({ example: "Analyst" })
  designation: string;

  @ApiProperty({ type: [GetAllEmployeesWithBenefitsBenefitDto] })
  benefits: GetAllEmployeesWithBenefitsBenefitDto[];
}
