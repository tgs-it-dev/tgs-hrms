import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../entities/user.entity';

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

  @ApiProperty({ enum: UserRole, example: 'user', description: 'User role' })
  @IsEnum(UserRole, { message: 'Role must be one of: admin, user, staff' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;

  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({ example: 'f7056477-f4f3-4dc9-987e-73d52e6d3541', description: 'Tenant/Company ID' })
  @IsUUID('4', { message: 'Please provide a valid UUID for tenantId' })
  @IsNotEmpty({ message: 'Tenant ID is required' })
  tenantId: string;
}
