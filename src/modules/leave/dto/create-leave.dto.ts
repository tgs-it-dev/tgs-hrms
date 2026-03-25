import { IsString, IsDateString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeaveDto {
  @ApiProperty({ description: 'Leave type ID', example: 'leaveType_001' })
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @ApiProperty({ description: 'Start date of leave', example: '2025-10-10' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'End date of leave', example: '2025-10-12' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ description: 'Reason for leave', example: 'Family function' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
