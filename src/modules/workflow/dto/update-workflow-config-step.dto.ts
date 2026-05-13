import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkflowConfigStepDto {
  @ApiPropertyOptional({ example: 'hr-admin' })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  approver_role?: string;

  @ApiPropertyOptional({ example: 'HR Admin Approval' })
  @IsString()
  @MaxLength(128)
  @IsOptional()
  step_label?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
