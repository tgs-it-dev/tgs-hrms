import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDateString, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title', example: 'Complete project documentation' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Task description', example: 'Write comprehensive documentation for the project' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Employee ID to assign task to', example: 'uuid' })
  @IsUUID()
  @IsOptional()
  assigned_to?: string;

  @ApiPropertyOptional({ description: 'Team ID to assign task to', example: 'uuid' })
  @IsUUID()
  @IsOptional()
  team_id?: string;

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

