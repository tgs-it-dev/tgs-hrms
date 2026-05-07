import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StepAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class ActOnStepDto {
  @ApiProperty({ enum: StepAction, example: StepAction.APPROVED })
  @IsEnum(StepAction, {
    message: `action must be one of: ${Object.values(StepAction).join(', ')}`,
  })
  action!: StepAction;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  remarks?: string;
}
