import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsEnum, IsInt, Min, Max, IsDateString } from 'class-validator';
import { PayrollStatus } from '../../../common/constants/enums';

export class GeneratePayrollDto {
  @ApiProperty({ description: 'Month (1-12)', example: 1, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Year', example: 2024, minimum: 2000 })
  @IsInt()
  @Min(2000)
  year: number;

  @ApiPropertyOptional({ description: 'Employee ID (optional, if not provided generates for all employees)', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  employee_id?: string;
}

export class UpdatePayrollStatusDto {
  @ApiProperty({ description: 'Payroll status', enum: PayrollStatus })
  @IsEnum(PayrollStatus)
  status: PayrollStatus;

  @ApiPropertyOptional({ description: 'Remarks', example: 'Salary paid via bank transfer' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class PayrollSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Tenant ID (required for system-admin)', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ description: 'Month (1-12)', example: 1, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Year', example: 2024, minimum: 2000 })
  @IsInt()
  @Min(2000)
  year: number;
}

export class PayrollStatisticsQueryDto {
  @ApiPropertyOptional({ description: 'Tenant ID (required for system-admin)', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Start date', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class PayrollQueryDto {
  @ApiPropertyOptional({ description: 'Month (1-12)', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Year', example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({ description: 'Employee ID' })
  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @ApiPropertyOptional({ description: 'Payroll status (pending, approved, paid, rejected)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Search by employee name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number (default: 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page (default: 25, max: 100)', default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

