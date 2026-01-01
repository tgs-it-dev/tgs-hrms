import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveStatus } from '../../../common/constants/enums';
import { Transform } from 'class-transformer';

export class UpdateLeaveDto {
  @ApiProperty({ 
    description: 'Leave status', 
    enum: LeaveStatus,
    example: LeaveStatus.APPROVED 
  })
  @IsEnum(LeaveStatus)
  @IsOptional()
  status?: LeaveStatus;

  @ApiProperty({ description: 'Remarks for approval/rejection', example: 'Approved for 3 days' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ApproveLeaveDto {
  @ApiProperty({ description: 'Remarks for approval', example: 'Approved for 3 days' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class RejectLeaveDto {
  @ApiProperty({ description: 'Remarks for rejection', example: 'Insufficient coverage' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ManagerRemarksDto {
  @ApiProperty({ description: 'Manager remarks on a team member\'s leave', example: 'Project delivery is near, please plan accordingly' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class EditLeaveDto {
  @ApiProperty({ description: 'Leave type ID', example: 'leaveType_001', required: false })
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return value;
  })
  @IsUUID()
  @IsOptional()
  leaveTypeId?: string;

  @ApiProperty({ description: 'Start date of leave', example: '2025-10-10', required: false })
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return value;
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: 'End date of leave', example: '2025-10-12', required: false })
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return value;
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ description: 'Reason for leave', example: 'Family function', required: false })
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return value;
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
