import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceType } from '../../../common/constants/enums';

export class CreateAttendanceDto {
  @ApiProperty({ enum: [AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT] })
  @IsEnum(AttendanceType)
  type: AttendanceType;
}
