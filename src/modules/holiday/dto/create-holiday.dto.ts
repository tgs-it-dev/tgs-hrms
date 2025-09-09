import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ 
    example: 'New Year Day',
    description: 'Name of the holiday'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    example: '2025-01-01',
    description: 'Date of the holiday'
  })
  @IsDateString()
  date: string;

  @ApiProperty({ 
    example: 'Public holiday celebrating the new year',
    description: 'Description of the holiday',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ 
    example: true,
    description: 'Whether the holiday is active',
    required: false,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
