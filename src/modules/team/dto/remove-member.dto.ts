import { IsUUID, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RemoveMemberDto {
  @IsUUID()
  @IsNotEmpty()
  @ApiProperty({
    description: "Employee ID to remove from the team",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  employee_id: string;
}
