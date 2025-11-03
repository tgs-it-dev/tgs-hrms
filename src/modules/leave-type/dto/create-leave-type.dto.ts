import { IsString, IsOptional, IsNumber, IsBoolean, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeaveTypeDto {
  @ApiProperty({ description: 'Name of the leave type', example: 'Annual Leave' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Description of the leave type', example: 'Paid time off for annual vacations', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Maximum days per year for this leave type', example: 24 })
  @IsNumber()
  @IsNotEmpty()
  maxDaysPerYear: number;

  @ApiProperty({ description: 'Whether leave can be carried forward to next year', example: true })
  @IsBoolean()
  @IsNotEmpty()
  carryForward: boolean;

  @ApiProperty({ description: 'Whether this leave type is paid', example: true, required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;
}
