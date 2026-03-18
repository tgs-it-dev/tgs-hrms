import { IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceType } from '../../../common/constants/enums';
import { Transform } from 'class-transformer';

export class CreateAttendanceDto {
  @ApiProperty({ enum: [AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT] })
  @IsEnum(AttendanceType)
  type: AttendanceType;

  @ApiPropertyOptional({ 
    example: 24.860734,
    description: 'Latitude for check-in/check-out location (required for CHECK_IN and CHECK_OUT)'
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? value : Number(value)))
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ 
    example: 67.001136,
    description: 'Longitude for check-in/check-out location (required for CHECK_IN and CHECK_OUT)'
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? value : Number(value)))
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
