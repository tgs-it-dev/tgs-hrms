import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Min } from 'class-validator';

export class TimesheetSummaryQueryDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601, inclusive). Defaults to 30 days ago.',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601, inclusive). Defaults to today.',
    example: '2025-01-31',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
