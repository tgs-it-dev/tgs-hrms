/**
 * Department Module DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsEnum, MaxLength } from 'class-validator';
import { BaseQueryDto } from '../../../common/dto/common.dto';

// Create Department DTO
export class CreateDepartmentDto {
  @ApiProperty({ description: 'Department name', example: 'Engineering' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Department description', example: 'Software development department' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Parent department ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({ description: 'Department manager ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  manager_id?: string;
}

// Update Department DTO
export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: 'Department name', example: 'Engineering' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Department description', example: 'Software development department' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Parent department ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({ description: 'Department manager ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  manager_id?: string;
}

// Department Query DTO
export class DepartmentQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({ description: 'Filter by parent department ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({ description: 'Filter by manager ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  manager_id?: string;
}

// Department Response DTO
export class DepartmentResponseDto {
  @ApiProperty({ description: 'Department ID', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: 'Department name', example: 'Engineering' })
  name: string;

  @ApiProperty({ description: 'Department description', example: 'Software development department' })
  description: string;

  @ApiProperty({ description: 'Parent department information' })
  parent?: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'Department manager information' })
  manager?: {
    id: string;
    name: string;
    email: string;
  };

  @ApiProperty({ description: 'Employee count' })
  employee_count: number;

  @ApiProperty({ description: 'Creation date' })
  created_at: Date;

  @ApiProperty({ description: 'Last update date' })
  updated_at: Date;
}

// Department List Response DTO
export class DepartmentListResponseDto {
  @ApiProperty({ description: 'List of departments', type: [DepartmentResponseDto] })
  departments: DepartmentResponseDto[];

  @ApiProperty({ description: 'Total count of departments' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  total_pages: number;
}

// Department Stats DTO
export class DepartmentStatsDto {
  @ApiProperty({ description: 'Total departments' })
  total_departments: number;

  @ApiProperty({ description: 'Departments with employees' })
  departments_with_employees: number;

  @ApiProperty({ description: 'Empty departments' })
  empty_departments: number;

  @ApiProperty({ description: 'Departments by employee count' })
  by_employee_count: Record<string, number>;
}

// Department Hierarchy DTO
export class DepartmentHierarchyDto {
  @ApiProperty({ description: 'Department ID', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: 'Department name', example: 'Engineering' })
  name: string;

  @ApiProperty({ description: 'Department level in hierarchy' })
  level: number;

  @ApiProperty({ description: 'Child departments', type: [DepartmentHierarchyDto] })
  children: DepartmentHierarchyDto[];

  @ApiProperty({ description: 'Employee count' })
  employee_count: number;
}
