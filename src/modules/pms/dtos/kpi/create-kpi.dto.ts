import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
  Max,
  Min,
} from "class-validator";

export class CreateKpiDto {
  @ApiProperty({
    example: "Customer Satisfaction Score",
    description: "Title of the KPI",
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: "Average CSAT rating from client feedback",
    description: "Description of the KPI",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 20,
    description:
      "Percentage weight of this KPI in the performance evaluation (1-100)",
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  weight: number;

  @ApiProperty({
    example: "Support Department",
    description: "Department or category this KPI belongs to",
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    example: "active",
    enum: ["active", "inactive"],
    description: "KPI status",
    required: false,
  })
  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
