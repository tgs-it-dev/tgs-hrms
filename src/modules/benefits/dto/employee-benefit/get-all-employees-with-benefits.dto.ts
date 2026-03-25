import { ApiProperty } from "@nestjs/swagger";

export class GetAllEmployeesWithBenefitsBenefitDto {
  @ApiProperty({ example: "benefit-uuid-123" })
  id: string;

  @ApiProperty({ example: "Health Insurance" })
  name: string;

  @ApiProperty({ example: "Medical coverage for employee", nullable: true })
  description: string;

  @ApiProperty({ example: "Insurance" })
  type: string;

  @ApiProperty({ example: "Full time employees only", nullable: true })
  eligibilityCriteria: string;

  @ApiProperty({ example: "active" })
  status: string;

  @ApiProperty({ example: "tenant-uuid-123" })
  tenant_id: string;

  @ApiProperty({ example: "user-uuid-123" })
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ example: "assignment-uuid-123" })
  benefitAssignmentId: string;

  @ApiProperty({ example: "active" })
  statusOfAssignment: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty({ nullable: true })
  endDate: Date;

  @ApiProperty({ example: "user-uuid-admin" })
  assignedBy: string;

  @ApiProperty()
  benefitCreatedAt: Date;
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

export class PaginatedGetAllEmployeesWithBenefitsResponseDto {
  @ApiProperty({ type: [GetAllEmployeesWithBenefitsResponseDto] })
  items: GetAllEmployeesWithBenefitsResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 25 })
  limit: number;

  @ApiProperty({ example: 4 })
  totalPages: number;
}
