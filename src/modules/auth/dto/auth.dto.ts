/**
 * Auth Module DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';

// Login Response DTO
export class LoginResponseDto {
  @ApiProperty({ description: 'Access token' })
  access_token: string;

  @ApiProperty({ description: 'Refresh token' })
  refresh_token: string;

  @ApiProperty({ description: 'Token type', example: 'Bearer' })
  token_type: string;

  @ApiProperty({ description: 'Token expiry time in seconds' })
  expires_in: number;

  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    status: string;
  };

  @ApiPropertyOptional({ description: 'Signup session ID', nullable: true })
  session_id?: string | null;
}

// Register Response DTO
export class RegisterResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    status: string;
  };
}

// Token Refresh Response DTO
export class RefreshTokenResponseDto {
  @ApiProperty({ description: 'New access token' })
  access_token: string;

  @ApiProperty({ description: 'New refresh token' })
  refresh_token: string;

  @ApiProperty({ description: 'Token type', example: 'Bearer' })
  token_type: string;

  @ApiProperty({ description: 'Token expiry time in seconds' })
  expires_in: number;
}

// Logout Response DTO
export class LogoutResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

// Verify Email DTO
export class VerifyEmailDto {
  @ApiProperty({ description: 'Verification token' })
  @IsString()
  token: string;
}

// Verify Email Response DTO
export class VerifyEmailResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

// Resend Verification DTO
export class ResendVerificationDto {
  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email: string;
}

// Resend Verification Response DTO
export class ResendVerificationResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

// Auth Status DTO
export class AuthStatusDto {
  @ApiProperty({ description: 'Authentication status' })
  is_authenticated: boolean;

  @ApiProperty({ description: 'User information' })
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    status: string;
  };

  @ApiProperty({ description: 'Token expiry time' })
  expires_at?: Date;
}

// Session Info DTO
export class SessionInfoDto {
  @ApiProperty({ description: 'Session ID' })
  session_id: string;

  @ApiProperty({ description: 'User ID' })
  user_id: string;

  @ApiProperty({ description: 'IP address' })
  ip_address: string;

  @ApiProperty({ description: 'User agent' })
  user_agent: string;

  @ApiProperty({ description: 'Session created at' })
  created_at: Date;

  @ApiProperty({ description: 'Last activity' })
  last_activity: Date;

  @ApiProperty({ description: 'Is active' })
  is_active: boolean;
}

// Re-export common DTOs
export { 
  LoginDto, 
  RegisterDto, 
  ForgotPasswordDto, 
  ResetPasswordDto, 
  ChangePasswordDto 
} from '../../../common/dto/common.dto';
