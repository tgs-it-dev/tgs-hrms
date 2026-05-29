import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { InviteStatus } from '../../../common/constants/enums';

export class SetInviteStatusDto {
  @ApiProperty({
    enum: InviteStatus,
    example: InviteStatus.INVITE_SENT,
    description: 'The invite status to assign to the employee',
  })
  @IsEnum(InviteStatus, {
    message: `status must be one of: ${Object.values(InviteStatus).join(', ')}`,
  })
  status: InviteStatus;
}
