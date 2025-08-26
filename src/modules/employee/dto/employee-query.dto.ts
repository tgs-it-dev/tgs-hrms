import { IsOptional, IsUUID, IsString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class EmployeeQueryDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'Department ID to filter employees',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  department_id?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'Designation ID to filter employees',
    example: '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c',
  })
  designation_id?: string;

  @IsNumberString()
  @ApiProperty({
    description: 'Page number for pagination (required)',
    example: '1',
    minimum: 1,
  })
  page: string;
}
