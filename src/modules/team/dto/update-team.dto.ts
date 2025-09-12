// import { PartialType } from '@nestjs/swagger';
// import { CreateTeamDto } from './create-team.dto';

// export class UpdateTeamDto extends PartialType(CreateTeamDto) {}



import { IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Updated team name',
    example: 'Updated Development Team A',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Updated team description',
    example: 'Updated frontend development team working on user interface',
  })
  description?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'Updated manager user ID (must be an employee with manager role)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  manager_id?: string;
}