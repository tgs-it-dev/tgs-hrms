/**
 * User Module DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsUUID, IsEnum, MinLength, MaxLength } from 'class-validator';
import { UserGender, UserStatus } from '../../../common/constants/enums';
import { BaseQueryDto, ChangePasswordDto } from '../../../common/dto/common.dto';

// Create User DTO
export class CreateUserDto {
  @ApiProperty({ description: 'User email address', example: 'john.doe@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User phone number', example: '+1234567890' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'User password', example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'User first name', example: 'John' })
  @IsString()
  @MaxLength(50)
  first_name: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  @IsString()
  @MaxLength(50)
  last_name: string;

  @ApiProperty({ description: 'User role ID', example: 'uuid-role-id' })
  @IsUUID()
  role_id: string;

  @ApiPropertyOptional({ description: 'User gender', enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ description: 'User status', enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({ description: 'Tenant ID', example: 'uuid-tenant-id' })
  @IsUUID()
  tenant_id: string;
}

// Update User DTO
export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User email address', example: 'john.doe@company.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'User phone number', example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'User first name', example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  first_name?: string;

  @ApiPropertyOptional({ description: 'User last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  last_name?: string;

  @ApiPropertyOptional({ description: 'User role ID', example: 'uuid-role-id' })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({ description: 'User gender', enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ description: 'User status', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

// Update Profile DTO
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'User first name', example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  first_name?: string;

  @ApiPropertyOptional({ description: 'User last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  last_name?: string;

  @ApiPropertyOptional({ description: 'User email address', example: 'john.doe@company.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'User phone number', example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'User gender', enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ description: 'Profile picture URL', example: 'https://example.com/profile.jpg' })
  @IsOptional()
  @IsString()
  profile_pic?: string;
}

// User Query DTO
export class UserQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Filter by role ID', example: 'uuid-role-id' })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({ description: 'Filter by gender', enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;
}

// User Response DTO
export class UserResponseDto {
  @ApiProperty({ description: 'User ID', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'john.doe@company.com' })
  email: string;

  @ApiProperty({ description: 'User phone', example: '+1234567890' })
  phone: string;

  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  full_name: string;

  @ApiProperty({ description: 'User first name', example: 'John' })
  first_name: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  last_name: string;

  @ApiProperty({ description: 'User status', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: 'User gender', enum: UserGender })
  gender: UserGender;

  @ApiProperty({ description: 'Profile picture URL', example: 'https://example.com/profile.jpg' })
  profile_pic: string;

  @ApiProperty({ description: 'Role information' })
  role: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'Creation date' })
  created_at: Date;

  @ApiProperty({ description: 'Last update date' })
  updated_at: Date;
}

// User Profile DTO
export class UserProfileDto {
  @ApiProperty({ description: 'User ID', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'john.doe@company.com' })
  email: string;

  @ApiProperty({ description: 'User phone', example: '+1234567890' })
  phone: string;

  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  full_name: string;

  @ApiProperty({ description: 'User first name', example: 'John' })
  first_name: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  last_name: string;

  @ApiProperty({ description: 'User status', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: 'User gender', enum: UserGender })
  gender: UserGender;

  @ApiProperty({ description: 'Profile picture URL', example: 'https://example.com/profile.jpg' })
  profile_pic: string;

  @ApiProperty({ description: 'Role information' })
  role: {
    id: string;
    name: string;
    permissions: string[];
  };

  @ApiProperty({ description: 'Tenant information' })
  tenant: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'Creation date' })
  created_at: Date;

  @ApiProperty({ description: 'Last update date' })
  updated_at: Date;

  @ApiProperty({ description: 'First login time' })
  first_login_time: Date;
}

// User List Response DTO
export class UserListResponseDto {
  @ApiProperty({ description: 'List of users', type: [UserResponseDto] })
  users: UserResponseDto[];

  @ApiProperty({ description: 'Total count of users' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  total_pages: number;
}

// User Stats DTO
export class UserStatsDto {
  @ApiProperty({ description: 'Total users' })
  total_users: number;

  @ApiProperty({ description: 'Active users' })
  active_users: number;

  @ApiProperty({ description: 'Inactive users' })
  inactive_users: number;

  @ApiProperty({ description: 'Users by role' })
  by_role: Record<string, number>;

  @ApiProperty({ description: 'Users by gender' })
  by_gender: Record<string, number>;

  @ApiProperty({ description: 'New users (last 30 days)' })
  new_users: number;
}

// Re-export common DTOs
export { ChangePasswordDto } from '../../../common/dto/common.dto';