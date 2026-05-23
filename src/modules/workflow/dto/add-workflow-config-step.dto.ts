import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowRequestType } from '../../../common/constants/enums';

export class AddWorkflowConfigStepDto {
  @ApiProperty({ enum: WorkflowRequestType })
  @IsEnum(WorkflowRequestType)
  request_type: WorkflowRequestType;

  @ApiProperty({ example: 'hr-admin' })
  @IsString()
  @MaxLength(64)
  approver_role: string;

  @ApiProperty({ example: 'HR Admin Approval' })
  @IsString()
  @MaxLength(128)
  step_label: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
