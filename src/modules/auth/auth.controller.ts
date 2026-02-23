import { Body, Controller, Post, UseGuards, Get, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordBodyDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  AUTH_MESSAGES,
  AUTH_THROTTLE_LOGIN_LIMIT,
  AUTH_THROTTLE_LOGIN_TTL_MS,
  AUTH_THROTTLE_REGISTER_LIMIT,
  AUTH_THROTTLE_REGISTER_TTL_MS,
  AUTH_THROTTLE_RESET_LIMIT,
  AUTH_THROTTLE_RESET_TTL_MS,
  UserRole,
} from 'src/common/constants';
import { AuthenticatedRequest, ValidatedUser, LoginResponse, RegisterResponse, TokenPair } from './interfaces';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: AUTH_THROTTLE_REGISTER_LIMIT, ttl: AUTH_THROTTLE_REGISTER_TTL_MS } })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({
    status: 400,
    description: 'Missing Fields Error or User already exists',
    schema: {
      example: {
        message: 'Missing Fields Error',
        errors: [
          { field: 'email', message: 'Email is required' },
          { field: 'password', message: 'Password is required' },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'User already exists',
    schema: {
      example: {
        field: 'email',
        message: 'User with this email already exists',
      },
    },
  })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: AUTH_THROTTLE_LOGIN_LIMIT, ttl: AUTH_THROTTLE_LOGIN_TTL_MS } })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'user-id',
          email: 'user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role: UserRole.ADMIN,
          tenant_id: 'tenant-id',
        },
        permissions: ['manage_users', 'view_reports'],
        employee: null,
        company: {
          id: 'company-id',
          company_name: 'Company Name',
          domain: 'company.com',
          is_paid: false,
        },
        requiresPayment: true,
        session_id: 'signup-session-id',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing Fields Error',
    schema: {
      example: {
        message: 'Missing Fields Error',
        errors: [
          { field: 'email', message: 'Email is required' },
          { field: 'password', message: 'Password is required' },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Email not found',
    schema: {
      example: {
        field: 'email',
        message: 'Email not found',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid password',
    schema: {
      example: {
        field: 'password',
        message: 'Incorrect password',
      },
    },
  })
  async login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.authService.validateUserForLogin(body.email, body.password);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: AUTH_THROTTLE_REGISTER_LIMIT, ttl: AUTH_THROTTLE_REGISTER_TTL_MS } })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends a password reset link to the provided email address. The link will expire in 1 hour.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent',
    schema: {
      example: {
        message: 'If an account with this email exists, a password reset link has been sent.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email format',
    schema: {
      example: {
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Email must be a valid email' }],
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-token')
  @ApiOperation({
    summary: 'Verify reset token',
    description: 'Verifies if a reset token is valid and not expired. Send token in x-reset-token header.',
  })
  @ApiHeader({
    name: 'x-reset-token',
    description: 'Password reset token from email',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: {
      example: {
        valid: true,
        message: 'Token is valid',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Token is invalid or expired',
    schema: {
      example: {
        valid: false,
        message: 'Invalid or expired reset token',
      },
    },
  })
  async verifyResetToken(@Headers('x-reset-token') token: string): Promise<{ valid: boolean; message: string }> {
    return this.authService.verifyResetToken(token);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: AUTH_THROTTLE_RESET_LIMIT, ttl: AUTH_THROTTLE_RESET_TTL_MS } })
  @ApiOperation({
    summary: 'Reset password using token',
    description: 'Resets the user password. Send reset token in x-reset-token header; new password in body.',
  })
  @ApiHeader({
    name: 'x-reset-token',
    description: 'Password reset token from email',
    required: true,
  })
  @ApiBody({ type: ResetPasswordBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    schema: {
      example: {
        message: 'Password reset successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
    schema: {
      example: {
        message: 'Invalid or expired reset token',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Password validation failed',
    schema: {
      example: {
        message: 'Validation failed',
        errors: [
          { field: 'password', message: 'Password must be at least 6 characters long' },
          { field: 'confirmPassword', message: 'Passwords do not match' },
        ],
      },
    },
  })
  async resetPassword(
    @Headers('x-reset-token') token: string,
    @Body() dto: ResetPasswordBodyDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword({
      token,
      password: dto.password,
      confirmPassword: dto.confirmPassword,
    });
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Generate a new access token using a valid refresh token. Send refresh token in x-refresh-token header.',
  })
  @ApiHeader({
    name: 'x-refresh-token',
    description: 'Refresh token to generate a new access token',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'New access token generated successfully',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    schema: {
      example: {
        message: 'Invalid refresh token',
      },
    },
  })
  async refresh(@Headers('x-refresh-token') refreshToken: string): Promise<TokenPair> {
    return this.authService.refreshToken(refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidate the refresh token. Send refresh token in x-refresh-token header.',
  })
  @ApiHeader({
    name: 'x-refresh-token',
    description: 'Refresh token to invalidate',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
    schema: {
      example: {
        message: AUTH_MESSAGES.SUCCESSFULLY_LOGGED_OUT,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Refresh token missing or invalid',
    schema: {
      example: {
        message: AUTH_MESSAGES.REFRESH_TOKEN_REQUIRED,
      },
    },
  })
  async logout(@Headers('x-refresh-token') refreshToken: string): Promise<{ message: string }> {
    return this.authService.logout(refreshToken);
  }

  @ApiBearerAuth()
  @Get('validate-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Validate current token',
    description: 'Validates if the current JWT token is still valid and user exists',
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: {
      example: {
        valid: true,
        user: {
          id: 'user-id',
          email: 'user@example.com',
          role: UserRole.ADMIN,
          tenant_id: 'tenant-id',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token is invalid or user not found',
    schema: {
      example: {
        message: AUTH_MESSAGES.USER_NOT_FOUND_OR_DELETED,
      },
    },
  })
  async validateUser(@Req() req: AuthenticatedRequest): Promise<ValidatedUser> {
    return this.authService.validateUser(req.user.id);
  }
}
