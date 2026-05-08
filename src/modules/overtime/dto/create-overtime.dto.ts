import {
  IsDateString,
  IsString,
  IsNumber,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOvertimeDto {
  @ApiProperty({
    example: '2026-05-10',
    description:
      'Overtime start date — must be a Saturday or Sunday (ISO 8601)',
  })
  @IsDateString()
  start_date!: string;

  @ApiProperty({
    example: '2026-05-11',
    description:
      'Overtime end date — must be a Saturday or Sunday, >= start_date (ISO 8601)',
  })
  @IsDateString()
  end_date!: string;

  @ApiProperty({
    example: 4,
    description: 'Total overtime hours across the entire period (0.5 – 24)',
  })
  @IsNumber()
  @Min(0.5)
  @Max(24)
  hours!: number;

  @ApiProperty({ example: 'Critical deployment requiring after-hours work' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
