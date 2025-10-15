import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'Password123', description: 'User password (minimum 6 characters)' })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({ example: 'John', description: 'User first name' })
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  first_name: string;

  @ApiProperty({ example: 'Doe', description: 'User last name' })
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  last_name: string;

  @ApiProperty({ example: '+1234567890', description: 'User phone number' })
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  phone: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Role ID' })
  @IsUUID('4', { message: 'Please provide a valid UUID for roleId' })
  @IsNotEmpty({ message: 'Role ID is required' })
  role_id: string;

  @ApiProperty({ example: 'f7056477-f4f3-4dc9-987e-73d52e6d3541', description: 'Tenant ID' })
  @IsUUID('4', { message: 'Please provide a valid UUID for tenantId' })
  @IsNotEmpty({ message: 'Tenant ID is required' })
  tenant_id: string;
}
