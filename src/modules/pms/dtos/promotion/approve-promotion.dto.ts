import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsIn, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class ApprovePromotionDto {
  @ApiProperty({
    description: "Status of the promotion request",
    enum: ["approved", "rejected"],
    required: true,
  })
  @IsOptional()
  @IsIn(["approved", "rejected"])
  status: "approved" | "rejected";

  @ApiProperty({
    description: "Effective date of the promotion",
    example: "2025-11-01",
  })
  @Transform(({ value }: { value: string }) => new Date(value))
  @IsDate()
  @IsOptional()
  effectiveDate?: Date;

  @ApiProperty({
    description: "Optional remarks when approving the promotion",
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}
