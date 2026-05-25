import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class DashboardAttendanceQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 8601 date string. Defaults to today.',
    example: '2025-01-15',
  })
  @IsOptional()
  @IsISO8601()
  date?: string;
}
