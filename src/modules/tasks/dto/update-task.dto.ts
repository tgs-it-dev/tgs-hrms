import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Task title', example: 'Updated task title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Task description', example: 'Updated task description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Task deadline', example: '2024-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({ description: 'Task priority (1=Low, 2=Medium, 3=High)', example: 2, enum: [1, 2, 3] })
  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  priority?: number;
}

