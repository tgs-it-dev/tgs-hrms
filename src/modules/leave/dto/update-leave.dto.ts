import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveStatus } from '../../../common/constants/enums';

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
