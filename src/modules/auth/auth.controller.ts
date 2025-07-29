
import {
  Body,
  Controller,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ApiTags,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import { RolesGuard } from '../../guards/roles.guard';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { Roles } from '../../decorators/roles.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
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
          { field: 'password', message: 'Password is required' }
        ]
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'User already exists',
    schema: {
      example: {
        field: 'email',
        message: 'User with this email already exists'
      }
    }
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ 
    status: 400, 
    description: 'Missing Fields Error',
    schema: {
      example: {
        message: 'Missing Fields Error',
        errors: [
          { field: 'email', message: 'Email is required' },
          { field: 'password', message: 'Password is required' }
        ]
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Email not found',
    schema: {
      example: {
        field: 'email',
        message: 'Email not found'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid password',
    schema: {
      example: {
        field: 'password',
        message: 'Incorrect password'
      }
    }
  })
  async login(@Body() body: LoginDto) {
    return this.authService.validateUser(body.email, body.password);
  }

  @Post('forgot-password')
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset link sent to email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password successfully reset' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @ApiBody({
    schema: {
      properties: {
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @ApiBearerAuth()
  @Post('admin-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAdminData() {
    return { message: 'Only Admin can access this route' };
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiBody({
    schema: {
      properties: {
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiResponse({ status: 400, description: 'Refresh token missing or invalid' })
  async logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }
}
