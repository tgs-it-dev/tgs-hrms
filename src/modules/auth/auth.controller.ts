
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
  ApiOperation
} from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/guards/company.guard';
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
  @Throttle({ default: { limit: 3, ttl: 300_000 } }) 
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOperation({ 
    summary: 'Request password reset',
    description: 'Sends a password reset link to the provided email address. The link will expire in 1 hour.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Password reset email sent',
    schema: {
      example: {
        message: 'If an account with this email exists, a password reset link has been sent.'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid email format',
    schema: {
      example: {
        message: 'Validation failed',
        errors: [
          { field: 'email', message: 'Email must be a valid email' }
        ]
      }
    }
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-token')
  @ApiOperation({ 
    summary: 'Verify reset token',
    description: 'Verifies if a reset token is valid and not expired. Useful for frontend validation.'
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
        message: 'Token is valid'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Token is invalid or expired',
    schema: {
      example: {
        valid: false,
        message: 'Invalid or expired reset token'
      }
    }
  })
  async verifyResetToken(@Body('token') token: string) {
    return this.authService.verifyResetToken(token);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 300_000 } }) 
  @ApiOperation({ 
    summary: 'Reset password using token',
    description: 'Resets the user password using a valid reset token received via email.'
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Password reset successful',
    schema: {
      example: {
        message: 'Password reset successfully'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid or expired token',
    schema: {
      example: {
        message: 'Invalid or expired reset token'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Password validation failed',
    schema: {
      example: {
        message: 'Validation failed',
        errors: [
          { field: 'password', message: 'Password must be at least 6 characters long' },
          { field: 'confirmPassword', message: 'Passwords do not match' }
        ]
      }
    }
  })
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
