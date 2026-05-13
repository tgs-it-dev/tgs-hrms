import {
  IsDateString,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOvertimeDto {
  @ApiProperty({
    example: '2026-05-10',
    description: 'Overtime date — must be a Saturday or Sunday (ISO 8601)',
  })
  @IsDateString()
  start_date!: string;

  @ApiPropertyOptional({
    example: '2026-05-11',
    description:
      'Range end date (range mode only). Omit when providing hours. ' +
      'All days in the range must be Saturday or Sunday.',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Overtime hours for start_date (hours mode only). ' +
      'Omit when providing end_date — hours are then auto-calculated (8 h per weekend day).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(24)
  hours?: number;

  @ApiProperty({ example: 'Critical deployment requiring after-hours work' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
