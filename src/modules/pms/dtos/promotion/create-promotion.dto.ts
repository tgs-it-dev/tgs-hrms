import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsUUID,
  IsString,
  IsOptional,
  MaxLength,
  IsDate,
} from "class-validator";

export class CreatePromotionDto {
  @ApiProperty({
    description: "Employee ID for whom the promotion is requested",
    example: "emp_123",
  })
  @IsUUID()
  employeeId: string;

  @ApiProperty({
    description: "Previous designation before promotion",
    example: "Software Engineer",
  })
  @IsString()
  @MaxLength(255)
  previousDesignation: string;

  @ApiProperty({
    description: "New designation after promotion",
    example: "Senior Software Engineer",
  })
  @IsString()
  @MaxLength(255)
  newDesignation: string;

  @ApiProperty({
    description: "Effective date of the promotion",
    example: "2025-11-01",
  })
  @Transform(({ value }: { value: string }) => new Date(value))
  @IsDate()
  @IsOptional()
  effectiveDate?: Date;

  @ApiProperty({
    description: "Optional remarks or justification for the promotion",
    required: false,
    example: "Outstanding performance in Q3",
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}
