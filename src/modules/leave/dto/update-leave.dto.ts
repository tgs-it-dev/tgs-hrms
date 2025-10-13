import { IsEnum } from 'class-validator';
import { LeaveStatus } from '../../../common/constants/enums';

export class UpdateLeaveDto {
  @IsEnum(LeaveStatus)
  status: LeaveStatus;
}
