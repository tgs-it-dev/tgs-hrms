import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOvertimeDto {
  @ApiPropertyOptional({
    example: '2026-05-10',
    description: 'New start date — must be Saturday or Sunday (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({
    example: '2026-05-11',
    description:
      'New end date for range mode. Omit when updating hours only. All days must be Saturday or Sunday.',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Updated hours for single-day mode. Omit when updating a date range.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(24)
  hours?: number;

  @ApiPropertyOptional({ example: 'Updated reason for overtime' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason?: string;
}
