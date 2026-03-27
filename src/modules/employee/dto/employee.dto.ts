/**
 * Employee Module DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { EmployeeStatus, UserGender } from '../../../common/constants/enums';
import { BaseQueryDto } from '../../../common/dto/common.dto';

// Create Employee DTO
export class CreateEmployeeDto {
  @ApiProperty({ description: 'Employee first name', example: 'John' })
  @IsString()
  first_name: string;

  @ApiProperty({ description: 'Employee last name', example: 'Doe' })
  @IsString()
  last_name: string;

  @ApiProperty({ description: 'Employee email address', example: 'john.doe@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Employee phone number', example: '+1234567890' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Employee designation ID', example: 'uuid-string' })
  @IsUUID()
  designation_id: string;

  @ApiPropertyOptional({ description: 'Employee team ID', example: 'uuid-string' })
  @IsOptional()
  team_id?: string | null;

  @ApiPropertyOptional({ description: 'Employee role ID', example: 'uuid-string' })
  @IsOptional()
  role_id?: string | null;

  @ApiPropertyOptional({ description: 'Employee gender', enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ description: 'Employee password', example: 'SecurePassword123!' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Employee role name', example: 'employee' })
  @IsOptional()
  @IsString()
  role_name?: string;

  @ApiPropertyOptional({
    description: 'CNIC number in format: XXXXX-XXXXXXX-X',
    example: '12345-1234567-1',
  })
  @IsOptional()
  @IsString()
  cnic_number?: string;
}

// Update Employee DTO
export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'Employee first name', example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Employee last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Employee email address', example: 'john.doe@company.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Employee phone number', example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Employee designation ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  designation_id?: string;

  @ApiPropertyOptional({ description: 'Employee team ID', example: 'uuid-string' })
  @IsOptional()
  team_id?: string | null;

  @ApiPropertyOptional({ description: 'Employee role ID', example: 'uuid-string' })
  @IsOptional()
  role_id?: string | null;

  @ApiPropertyOptional({ description: 'Employee gender', enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ description: 'Employee password', example: 'SecurePassword123!' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Employee role name', example: 'employee' })
  @IsOptional()
  @IsString()
  role_name?: string;

  @ApiPropertyOptional({
    description: 'CNIC number in format: XXXXX-XXXXXXX-X',
    example: '12345-1234567-1',
  })
  @IsOptional()
  @IsString()
  cnic_number?: string;
}

// Employee Query DTO
export class EmployeeQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'Filter by designation ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  designation_id?: string;

  @ApiPropertyOptional({ description: 'Filter by team ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  team_id?: string;

  @ApiPropertyOptional({ description: 'Filter by department ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  department_id?: string;
}

// Employee Profile DTO
export class EmployeeProfileDto {
  @ApiProperty({ description: 'Employee ID', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: 'Employee first name', example: 'John' })
  first_name: string;

  @ApiProperty({ description: 'Employee last name', example: 'Doe' })
  last_name: string;

  @ApiProperty({ description: 'Employee email', example: 'john.doe@company.com' })
  email: string;

  @ApiProperty({ description: 'Employee phone', example: '+1234567890' })
  phone: string;

  @ApiPropertyOptional({ description: 'Employee gender', enum: UserGender })
  gender?: UserGender;

  @ApiPropertyOptional({
    description: 'CNIC number in format: XXXXX-XXXXXXX-X',
    example: '12345-1234567-1',
  })
  cnic_number?: string;

  @ApiPropertyOptional({ description: 'Profile picture URL' })
  profile_picture?: string;

  @ApiPropertyOptional({ description: 'CNIC picture URL' })
  cnic_picture?: string;

  @ApiPropertyOptional({ description: 'CNIC back picture URL' })
  cnic_back_picture?: string;

  @ApiProperty({ description: 'Designation information' })
  designation?: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'Team information' })
  team?: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'User information' })
  user?: {
    id: string;
    email: string;
    status: string;
  };

  @ApiProperty({ description: 'Creation date' })
  created_at: Date;

  @ApiProperty({ description: 'Last update date' })
  updated_at: Date;
}

// Employee Response DTO
export class EmployeeResponseDto {
  @ApiProperty({ description: 'Employee ID', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: 'Employee full name', example: 'John Doe' })
  full_name: string;

  @ApiProperty({ description: 'Employee email', example: 'john.doe@company.com' })
  email: string;

  @ApiProperty({ description: 'Employee phone', example: '+1234567890' })
  phone: string;

  @ApiProperty({ description: 'Employee status', enum: EmployeeStatus })
  status: EmployeeStatus;

  @ApiProperty({ description: 'Designation name', example: 'Software Engineer' })
  designation: string;

  @ApiProperty({ description: 'Team name', example: 'Development Team' })
  team: string;

  @ApiPropertyOptional({
    description: 'CNIC number in format: XXXXX-XXXXXXX-X',
    example: '12345-1234567-1',
  })
  cnic_number?: string;

  @ApiPropertyOptional({ description: 'Profile picture URL' })
  profile_picture?: string;

  @ApiPropertyOptional({ description: 'CNIC picture URL' })
  cnic_picture?: string;

  @ApiPropertyOptional({ description: 'CNIC back picture URL' })
  cnic_back_picture?: string;

  @ApiProperty({ description: 'Creation date' })
  created_at: Date;
}

// Employee List Response DTO
export class EmployeeListResponseDto {
  @ApiProperty({ description: 'List of employees', type: [EmployeeResponseDto] })
  employees: EmployeeResponseDto[];

  @ApiProperty({ description: 'Total count of employees' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  total_pages: number;
}

// Employee Stats DTO
export class EmployeeStatsDto {
  @ApiProperty({ description: 'Total employees' })
  total_employees: number;

  @ApiProperty({ description: 'Active employees' })
  active_employees: number;

  @ApiProperty({ description: 'Inactive employees' })
  inactive_employees: number;

  @ApiProperty({ description: 'Employees by designation' })
  by_designation: Record<string, number>;

  @ApiProperty({ description: 'Employees by team' })
  by_team: Record<string, number>;

  @ApiProperty({ description: 'Recent hires (last 30 days)' })
  recent_hires: number;
}
