import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CompanyLogoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signupSessionId: string;
}
