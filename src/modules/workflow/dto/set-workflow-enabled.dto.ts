import { IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkflowRequestType } from '../../../common/constants/enums';

export class SetWorkflowEnabledDto {
  @ApiProperty({ enum: WorkflowRequestType, example: WorkflowRequestType.LEAVE })
  @IsEnum(WorkflowRequestType)
  request_type: WorkflowRequestType;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}
