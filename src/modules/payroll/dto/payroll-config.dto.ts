import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SalaryCycle } from '../../../common/constants/enums';

export class BasePayComponentsDto {
  @ApiProperty({ description: 'Basic salary amount', example: 50000 })
  @IsNumber()
  @Min(0)
  basic: number;

  @ApiPropertyOptional({ description: 'House rent allowance', example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  houseRent?: number;

  @ApiPropertyOptional({ description: 'Medical allowance', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  medical?: number;

  @ApiPropertyOptional({ description: 'Transport allowance', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transport?: number;
}

export class AllowanceDto {
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
  @Max(100)
  percentage?: number;
}

export class DeductionsDto {
  @ApiPropertyOptional({ description: 'Tax percentage', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  @ApiPropertyOptional({ description: 'Insurance percentage', example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  insurancePercentage?: number;

  @ApiPropertyOptional({ description: 'Provident fund percentage', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  providentFundPercentage?: number;
}

export class OvertimePolicyDto {
  @ApiProperty({ description: 'Whether overtime is enabled', example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Overtime rate multiplier', example: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rateMultiplier?: number;

  @ApiPropertyOptional({ description: 'Maximum overtime hours per month', example: 40 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxHoursPerMonth?: number;
}

export class LeaveDeductionPolicyDto {
  @ApiProperty({ description: 'Whether unpaid leave deduction is enabled', example: true })
  @IsBoolean()
  unpaidLeaveDeduction: boolean;

  @ApiPropertyOptional({ description: 'Half day deduction percentage', example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  halfDayDeduction?: number;
}

export class CreatePayrollConfigDto {
  @ApiProperty({ description: 'Salary cycle', enum: SalaryCycle, example: SalaryCycle.MONTHLY })
  @IsEnum(SalaryCycle)
  salaryCycle: SalaryCycle;

  @ApiPropertyOptional({ description: 'Base pay components', type: BasePayComponentsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BasePayComponentsDto)
  basePayComponents?: BasePayComponentsDto;

  @ApiPropertyOptional({ description: 'List of allowances', type: [AllowanceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceDto)
  allowances?: AllowanceDto[];

  @ApiPropertyOptional({ description: 'Deduction settings', type: DeductionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeductionsDto)
  deductions?: DeductionsDto;

  @ApiPropertyOptional({ description: 'Overtime policy', type: OvertimePolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OvertimePolicyDto)
  overtimePolicy?: OvertimePolicyDto;

  @ApiPropertyOptional({ description: 'Leave deduction policy', type: LeaveDeductionPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LeaveDeductionPolicyDto)
  leaveDeductionPolicy?: LeaveDeductionPolicyDto;
}

export class UpdatePayrollConfigDto {
  @ApiPropertyOptional({ description: 'Salary cycle', enum: SalaryCycle })
  @IsOptional()
  @IsEnum(SalaryCycle)
  salaryCycle?: SalaryCycle;

  @ApiPropertyOptional({ description: 'Base pay components', type: BasePayComponentsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BasePayComponentsDto)
  basePayComponents?: BasePayComponentsDto;

  @ApiPropertyOptional({ description: 'List of allowances', type: [AllowanceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllowanceDto)
  allowances?: AllowanceDto[];

  @ApiPropertyOptional({ description: 'Deduction settings', type: DeductionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeductionsDto)
  deductions?: DeductionsDto;

  @ApiPropertyOptional({ description: 'Overtime policy', type: OvertimePolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OvertimePolicyDto)
  overtimePolicy?: OvertimePolicyDto;

  @ApiPropertyOptional({ description: 'Leave deduction policy', type: LeaveDeductionPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LeaveDeductionPolicyDto)
  leaveDeductionPolicy?: LeaveDeductionPolicyDto;
}

