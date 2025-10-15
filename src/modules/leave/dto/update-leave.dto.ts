import { IsIn } from 'class-validator';

export class UpdateLeaveDto {
  @IsIn(['approved', 'rejected'])
  status: string;
}
