import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString, IsUUID, Matches, Min } from 'class-validator';

export class CompanyDetailsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signupSessionId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  domain: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  seats: number;
}
