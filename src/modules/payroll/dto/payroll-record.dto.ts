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

