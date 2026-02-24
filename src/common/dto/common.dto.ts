/**
 * Common DTOs shared across modules
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  IsEnum,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserGender, UserStatus } from '../constants/enums';

// Base Query DTO for pagination
export class BaseQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term', example: 'john' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field', example: 'created_at' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ description: 'Sort order', example: 'ASC' })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';
}

// Base Response DTO
export class BaseResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Response data' })
  data?: any;

  @ApiProperty({ description: 'Error details (if any)' })
  error?: string;
}

// Paginated Response DTO
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'List of items' })
  items: T[];

  @ApiProperty({ description: 'Total count of items' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  total_pages: number;

  @ApiProperty({ description: 'Has next page' })
  has_next: boolean;

  @ApiProperty({ description: 'Has previous page' })
  has_previous: boolean;
}

// File Upload DTO
export class FileUploadDto {
  @ApiProperty({ description: 'File field name', example: 'profile_pic' })
  @IsString()
  field_name: string;

  @ApiProperty({ description: 'File type', example: 'image/jpeg' })
  @IsString()
  file_type: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024000 })
  @IsNumber()
  file_size: number;
}

// File Upload Response DTO
export class FileUploadResponseDto {
  @ApiProperty({
    description: 'File URL',
    example: 'https://example.com/uploads/file.jpg',
  })
  url: string;

  @ApiProperty({ description: 'File name', example: 'profile_pic.jpg' })
  filename: string;

  @ApiProperty({ description: 'File size in bytes', example: 1024000 })
  size: number;

  @ApiProperty({ description: 'File type', example: 'image/jpeg' })
  mime_type: string;
}

// Change Password DTO
export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @MinLength(8)
  current_password: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  @MinLength(8)
  new_password: string;

  @ApiProperty({ description: 'Confirm new password' })
  @IsString()
  @MinLength(8)
  confirm_password: string;
}

// Reset Password DTO
export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  @MinLength(8)
  new_password: string;

  @ApiProperty({ description: 'Confirm new password' })
  @IsString()
  @MinLength(8)
  confirm_password: string;
}

// Forgot Password DTO
export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email: string;
}

// Login DTO
export class LoginDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  @MinLength(8)
  password: string;
}

// Register DTO
export class RegisterDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @MaxLength(50)
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @MaxLength(50)
  last_name: string;

  @ApiProperty({ description: 'Phone number', example: '+1234567890' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'Gender', enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;
}

// Status Update DTO
export class StatusUpdateDto {
  @ApiProperty({ description: 'New status', enum: UserStatus })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// Bulk Action DTO
export class BulkActionDto {
  @ApiProperty({
    description: 'Array of IDs to perform action on',
    type: [String],
  })
  @IsUUID('4', { each: true })
  ids: string[];

  @ApiProperty({ description: 'Action to perform', example: 'delete' })
  @IsString()
  action: string;
}

// Export DTO
export class ExportDto {
  @ApiPropertyOptional({ description: 'Export format', example: 'csv' })
  @IsOptional()
  @IsString()
  format?: string = 'csv';

  @ApiPropertyOptional({ description: 'Include specific fields' })
  @IsOptional()
  @IsString()
  fields?: string;

  @ApiPropertyOptional({ description: 'Date range start' })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Date range end' })
  @IsOptional()
  @IsString()
  date_to?: string;
}
