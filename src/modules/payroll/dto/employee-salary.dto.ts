import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsEnum, IsArray, ValidateNested, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SalaryStatus } from '../../../common/constants/enums';

export class AllowanceItemDto {
  @ApiProperty({ description: 'Allowance type', example: 'travel' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Fixed amount', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Percentage of base salary', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentage?: number;

  @ApiPropertyOptional({ description: 'Allowance description', example: 'Travel allowance for outstation visits' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class DeductionItemDto {
  @ApiProperty({ description: 'Deduction type', example: 'loan' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Fixed amount', example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Percentage of base salary', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentage?: number;

  @ApiPropertyOptional({ description: 'Deduction description', example: 'Monthly loan installment' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateEmployeeSalaryDto {
  @ApiProperty({ description: 'Employee ID', example: 'uuid-string' })
  @IsUUID()
  employee_id: string;

  @ApiProperty({ description: 'Base salary amount', example: 50000 })
  @IsNumber()
  @Min(0)
  baseSalary: number;

  @ApiPropertyOptional({ description: 'List of allowances', type: [AllowanceItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceItemDto)
  allowances?: AllowanceItemDto[];

  @ApiPropertyOptional({ description: 'List of deductions', type: [DeductionItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeductionItemDto)
  deductions?: DeductionItemDto[];

  @ApiProperty({ description: 'Effective date', example: '2024-01-01' })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({ description: 'End date (if applicable)', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Salary status', enum: SalaryStatus, default: SalaryStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SalaryStatus)
  status?: SalaryStatus;

  @ApiPropertyOptional({ description: 'Additional notes', example: 'Promotion salary adjustment' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeSalaryDto {
  @ApiPropertyOptional({ description: 'Base salary amount', example: 55000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional({ description: 'List of allowances', type: [AllowanceItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceItemDto)
  allowances?: AllowanceItemDto[];

  @ApiPropertyOptional({ description: 'List of deductions', type: [DeductionItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeductionItemDto)
  deductions?: DeductionItemDto[];

  @ApiPropertyOptional({ description: 'Effective date', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'End date (if applicable)', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Salary status', enum: SalaryStatus })
  @IsOptional()
  @IsEnum(SalaryStatus)
  status?: SalaryStatus;

  @ApiPropertyOptional({ description: 'Additional notes', example: 'Promotion salary adjustment' })
  @IsOptional()
  @IsString()
  notes?: string;
}

