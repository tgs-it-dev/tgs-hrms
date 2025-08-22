import { ApiProperty } from '@nestjs/swagger';
import { 
  IsDateString, 
  IsNotEmpty, 
  IsString, 
  IsOptional, 
  IsBoolean,
  MaxLength,
  IsDate
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateHolidayDto {
  @ApiProperty({ 
    example: 'New Year Day',
    description: 'Name of the holiday'
  })
  @IsString()
  @IsNotEmpty({ message: 'Holiday name is required' })
  @MaxLength(100, { message: 'Holiday name cannot exceed 100 characters' })
  name: string;

  @ApiProperty({ 
    example: '2025-01-01',
    description: 'Date of the holiday in YYYY-MM-DD format'
  })
  @IsDateString({}, { message: 'Date must be a valid date string in YYYY-MM-DD format' })
  @IsNotEmpty({ message: 'Holiday date is required' })
  date: string;

  @ApiProperty({ 
    example: 'Public holiday celebrating the new year',
    description: 'Optional description of the holiday',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiProperty({ 
    example: true,
    description: 'Whether the holiday is active',
    default: true,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}
