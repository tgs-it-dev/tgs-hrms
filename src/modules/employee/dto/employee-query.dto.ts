import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
}
