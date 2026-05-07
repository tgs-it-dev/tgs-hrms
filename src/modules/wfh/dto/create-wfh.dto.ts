import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWfhDto {
  @ApiProperty({ example: '2026-05-10', description: 'Date of WFH (ISO 8601 date)' })
  @IsDateString()
  wfh_date: string;

  @ApiProperty({ example: 'Working on a critical deliverable' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
