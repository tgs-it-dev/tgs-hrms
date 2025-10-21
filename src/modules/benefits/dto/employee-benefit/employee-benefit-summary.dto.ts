import { ApiProperty } from "@nestjs/swagger";

export class EmployeeBenefitSummaryDto {
  @ApiProperty({ example: 25, description: "Total active benefits assigned" })
  totalActiveBenefits: number;

  @ApiProperty({
    example: "Health Insurance",
    description: "Most common benefit type",
  })
  mostCommonBenefitType: string | null;

  @ApiProperty({ example: 80, description: "Total employees covered" })
  totalEmployeesCovered: number;
}
