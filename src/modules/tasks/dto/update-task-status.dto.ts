import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskStatus } from '../../../common/constants/enums';

export class UpdateTaskStatusDto {
  @ApiProperty({ description: 'New task status', enum: TaskStatus, example: TaskStatus.IN_PROGRESS })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ApiPropertyOptional({ description: 'Remarks or comments about the status change', example: 'Started working on the task' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

