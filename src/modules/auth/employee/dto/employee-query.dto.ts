import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class EmployeeQueryDto {
  @ApiPropertyOptional({ 
    description: 'Filter employees by department ID',
    example: '3a275957-c811-4ebb-b9f1-481bd96e47d1'
  })
  @IsOptional()
  @IsUUID('4', { message: 'department_id must be a valid UUID' })
  department_id?: string;

  @ApiPropertyOptional({ 
    description: 'Filter employees by designation ID',
    example: '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c'
  })
  @IsOptional()
  @IsUUID('4', { message: 'designation_id must be a valid UUID' })
  designation_id?: string;
} 