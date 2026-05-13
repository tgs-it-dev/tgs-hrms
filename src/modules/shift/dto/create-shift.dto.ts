import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateShiftDto {
  @ApiProperty({ example: 'Morning Shift' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '09:00', description: '24-hour HH:mm format' })
  @Matches(TIME_REGEX, { message: 'start_time must be in HH:mm format (24-hour)' })
  start_time: string;

  @ApiProperty({ example: '18:00', description: '24-hour HH:mm format. If earlier than start_time the shift crosses midnight.' })
  @Matches(TIME_REGEX, { message: 'end_time must be in HH:mm format (24-hour)' })
  end_time: string;
}
