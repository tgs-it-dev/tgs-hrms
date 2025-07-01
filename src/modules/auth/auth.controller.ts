import { Body, Controller, Post, Param, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ApiTags, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';

// Import guards and decorators from the correct path
import { RolesGuard } from '../../guards/roles.guard'; 
import { JwtAuthGuard } from '../../guards/jwt-auth.guard'; 
import { Roles } from '../../decorators/roles.decorator'; 
import { TenantGuard } from '../../guards/tenant.guard'; 

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

  // LOGIN
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

  // REFRESH TOKEN
  @Post('refresh')
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  // PROTECTED ROUTES
  @ApiBearerAuth()
  @Post('admin-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAdminData() {
    return { message: 'Only Admin can access this route' };
  }

  @ApiBearerAuth()
  @Post('tenant/:tenantId/profile')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Roles('admin', 'staff')
  getTenantProfile(@Param('tenantId') tenantId: number) {
    return { message: `Profile for tenant ${tenantId}` };
  }

  // ✅ LOGOUT
  @ApiBearerAuth()
  @Post('logout')
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiResponse({ status: 400, description: 'Refresh token missing or invalid' })
  async logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }
}
