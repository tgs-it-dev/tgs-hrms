import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class AssignTaskDto {
  @ApiPropertyOptional({ description: 'Employee ID to assign task to', example: 'uuid' })
  @IsUUID()
  @IsOptional()
  assigned_to?: string;

  @ApiPropertyOptional({ description: 'Team ID to assign task to (if assigning to team)', example: 'uuid' })
  @IsUUID()
  @IsOptional()
  team_id?: string;
}

