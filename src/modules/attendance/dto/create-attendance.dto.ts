import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAttendanceDto {
  @ApiProperty({ enum: ['check-in', 'check-out'] })
  @IsEnum(['check-in', 'check-out'])
  type: 'check-in' | 'check-out';
}
