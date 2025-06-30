import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';

/**
 * AuthController handles authentication-related endpoints such as login, registration,
 * password reset, and token refresh. It integrates with AuthService for business logic.
 *
 * Security: Sensitive endpoints like login are rate-limited to prevent brute-force attacks.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // REGISTER
  @Post('register')
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * Authenticates a user using email and password.
   *
   * Rate limited to 5 requests per minute per IP using @Throttle.
   * Returns JWT access and refresh tokens on success.
   *
   * Security: Rate limiting helps prevent brute-force attacks.
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginDto) {
    return this.authService.validateUser(body.email, body.password);
  }

  // FORGOT PASSWORD
  @Post('forgot-password')
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset link sent to email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // RESET PASSWORD
  @Post('reset-password')
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password successfully reset' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
