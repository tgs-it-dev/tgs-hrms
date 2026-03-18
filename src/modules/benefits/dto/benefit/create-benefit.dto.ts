import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
} from "class-validator";

export class CreateBenefitDto {
  @ApiProperty({ example: "Health Insurance", description: "Benefit name" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: "Comprehensive health insurance plan for all full-time employees",
    description: "Benefit description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: "insurance", description: "Type of benefit" })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    example: "Full-time employees only",
    description: "Eligibility criteria for the benefit",
  })
  @IsOptional()
  @IsString()
  eligibilityCriteria?: string;

  @ApiProperty({
    example: "active",
    description: "Status of the benefit",
    enum: ["active", "inactive"],
    default: "active",
  })
  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
