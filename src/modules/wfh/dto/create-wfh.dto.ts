import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWfhDto {
  @ApiProperty({
    example: '2026-05-11',
    description: 'WFH start date (ISO 8601)',
  })
  @IsDateString()
  start_date!: string;

  @ApiProperty({
    example: '2026-05-13',
    description: 'WFH end date (ISO 8601, must be >= start_date)',
  })
  @IsDateString()
  end_date!: string;

  @ApiProperty({ example: 'Working on a critical deliverable' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
