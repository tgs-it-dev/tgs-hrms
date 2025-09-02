import { IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamDto {
  @IsString()
  @ApiProperty({
    description: 'Team name',
    example: 'Development Team A',
  })
  name: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Team description',
    example: 'Frontend development team working on user interface',
  })
  description?: string;

  @IsUUID()
  @ApiProperty({
    description: 'Manager user ID (must be an employee with manager role)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  manager_id: string;
}



