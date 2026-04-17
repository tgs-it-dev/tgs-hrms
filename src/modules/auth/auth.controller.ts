import { Body, Controller, Post, UseGuards, Get, Req } from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { Throttle } from '@nestjs/throttler';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 300_000 } }) // 3 requests per 5 minutes
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
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 requests per minute (stricter for auth)
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
          role: 'admin',
          tenant_id: 'tenant-id'
        },
        permissions: ['manage_users', 'view_reports'],
        employee: null,
        company: {
          id: 'company-id',
          company_name: 'Company Name',
          domain: 'company.com',
          is_paid: false
        },
        requiresPayment: true,
        session_id: 'signup-session-id'
      }
    }
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
  async login(@Body() body: LoginDto, @Req() req: any) {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? null;
    return this.authService.validateUser(
      body.email,
      body.password,
      body.platform,
      body.device_info,
      ipAddress,
    );
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a password reset link to the provided email address. The link will expire in 1 hour.',
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
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-token')
  @Public()
  @ApiOperation({
    summary: 'Verify reset token',
    description:
      'Verifies if a reset token is valid and not expired. Useful for frontend validation.',
  })
  @ApiBody({
    schema: {
      properties: {
        token: { type: 'string' },
      },
    },
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
  async verifyResetToken(@Body('token') token: string) {
    return this.authService.verifyResetToken(token);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @ApiOperation({
    summary: 'Reset password using token',
    description: 'Resets the user password using a valid reset token received via email.',
  })
  @ApiBody({ type: ResetPasswordDto })
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
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Generate a new access token using a valid refresh token. Access tokens expire after 24 hours.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Tokens rotated — store BOTH tokens; the old refresh token is now revoked.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
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
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('admin-data')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('manage_users')
  getAdminData() {
    return { message: 'Only Admin can access this route' };
  }

  @ApiBearerAuth()
  @Get('test-permissions')
  @UseGuards(JwtAuthGuard)
  async testPermissions(@Req() req: any) {
    return {
      message: 'Permissions test endpoint',
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        tenant_id: req.user.tenant_id,
        permissions: req.user.permissions,
      },
    };
  }

  @Post('logout')
  @Public()
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidate the refresh token to log out the user',
  })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
    schema: {
      example: {
        message: 'Successfully logged out',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Refresh token missing or invalid',
    schema: {
      example: {
        message: 'Refresh token is required',
      },
    },
  })
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('validate-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Validate current token',
    description: 'Validates if the current JWT token is still valid and user exists',
  })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Token is invalid or user not found' })
  async validateToken(@Req() req: any) {
    return this.authService.validateToken(req.user.id);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Revokes all active refresh token sessions for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'All sessions revoked' })
  async logoutAll(@Req() req: any) {
    return this.authService.logoutAll(req.user.id);
  }

  @ApiBearerAuth()
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'List active sessions',
    description: 'Returns all active (non-revoked, non-expired) login sessions for the current user.',
  })
  @ApiResponse({ status: 200, description: 'Active sessions returned' })
  async getSessions(@Req() req: any) {
    return this.authService.getActiveSessions(req.user.id);
  }
}