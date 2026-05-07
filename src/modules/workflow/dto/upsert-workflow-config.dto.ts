import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowRequestType } from '../../../common/constants/enums';

export class WorkflowConfigStepDto {
  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  step_order: number;

  @ApiProperty({ example: 'manager' })
  @IsString()
  @MaxLength(64)
  approver_role: string;

  @ApiProperty({ example: 'Manager Approval' })
  @IsString()
  @MaxLength(128)
  step_label: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpsertWorkflowConfigDto {
  @ApiProperty({ enum: WorkflowRequestType })
  @IsEnum(WorkflowRequestType)
  request_type: WorkflowRequestType;

  @ApiProperty({ type: [WorkflowConfigStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowConfigStepDto)
  steps: WorkflowConfigStepDto[];
}
