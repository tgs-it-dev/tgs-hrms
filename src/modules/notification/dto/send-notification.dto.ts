import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsArray, IsUUID, IsOptional } from 'class-validator';
import { NotificationType } from '../../../common/constants/enums';

export class SendNotificationDto {
  @ApiProperty({
    description: 'User IDs to send notification to',
    example: ['user-uuid-1', 'user-uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  @IsNotEmpty()
  user_ids: string[];

  @ApiProperty({
    description: 'Notification message',
    example: 'Your attendance has been approved',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
    example: NotificationType.ALERT,
  })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiProperty({
    description: 'Related entity type for click redirect (e.g. leave, attendance)',
    example: 'leave',
    required: false,
  })
  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @ApiProperty({
    description: 'Related entity ID for deep link',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID(4)
  related_entity_id?: string;
}
