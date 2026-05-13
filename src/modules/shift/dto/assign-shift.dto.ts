import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class AssignShiftDto {
  @ApiPropertyOptional({ description: 'Shift ID to assign. Omit or null to unassign.' })
  @IsOptional()
  @IsUUID()
  shift_id?: string | null;
}
