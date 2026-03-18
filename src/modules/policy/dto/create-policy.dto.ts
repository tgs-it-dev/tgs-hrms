import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

const allowedCategories = ['attendance', 'leave', 'general', 'compensation', 'conduct'] as const;
export type PolicyCategory = (typeof allowedCategories)[number];

export class CreatePolicyDto {
  @ApiProperty({ example: 'Attendance Rules', description: 'Short title for the policy' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  @Matches(/^[a-zA-Z0-9 &'()\-]+$/, {
    message: 'Title can only contain letters, numbers, spaces, and -&() characters.',
  })
  title: string;

  @ApiProperty({ example: 'attendance', enum: allowedCategories })
  @IsString()
  @IsIn([...allowedCategories])
  category: PolicyCategory;

  @ApiProperty({ example: 'Employees must check in by 9:00 AM and check out after 5:00 PM.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  body: string;

  @ApiProperty({ example: '2025-01-01', required: false })
  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
