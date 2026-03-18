import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, IsNumber, IsOptional } from "class-validator";

export class CreatePerformanceReviewDto {
  @ApiProperty({ example: "employee_123" })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: "Q4-2025" })
  @IsString()
  cycle: string;

  @ApiProperty({ example: 4.3 })
  @IsNumber()
  overallScore: number;

  @ApiProperty({
    example: "Strong performance, ready for promotion",
    required: false,
  })
  @IsOptional()
  @IsString()
  recommendation?: string;
}
