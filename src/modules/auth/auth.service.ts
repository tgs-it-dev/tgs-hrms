import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException({
        field: 'email',
        message: 'User with this email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
      role_id: dto.role_id,
      tenant_id: dto.tenant_id,
    });

    await this.userRepository.save(user);
    return { message: 'User registered successfully' };
  }

  async validateUser(email: string, password: string) {
    const normalizedEmail = email.toLowerCase();
    this.logger.log(`Login attempt for email: ${normalizedEmail}`);

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      relations: ['role'],
    });

    if (!user) {
      this.logger.warn(`Login failed: user not found for email: ${normalizedEmail}`);
      throw new BadRequestException({
        field: 'email',
        message: 'Email not found',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password for email: ${normalizedEmail}`);
      throw new BadRequestException({
        field: 'password',
        message: 'Incorrect password',
      });
    }

    
    if (!user.role || !user.role.name) {
      this.logger.error(`User role missing for email: ${normalizedEmail}`);
      throw new UnauthorizedException('User role not found');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.name.toLowerCase(),
      tenant_id: user.tenant_id,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '7d',
    });

    user.refresh_token = refreshToken;
    await this.userRepository.save(user);

    this.logger.log(`Login successful for email: ${normalizedEmail}`);
    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    this.logger.log(`Forgot password request for email: ${dto.email}`);

    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      this.logger.warn(`Forgot password failed: user not found for email: ${dto.email}`);
      throw new BadRequestException('In Valid email address');
    }

  
    const resetToken = this.generateSecureToken();
    
    
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); 

    
    await this.userRepository.update(user.id, {
      reset_token: resetToken,
      reset_token_expiry: resetTokenExpiry,
    });

    
    const userName = `${user.first_name} ${user.last_name}`;
    await this.emailService.sendPasswordResetEmail(user.email, resetToken, userName);

    this.logger.log(`Password reset email sent to: ${user.email}`);
    
    return {
      message: 'Check your email for the password reset link.',
    };
  }

  private generateSecureToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  async verifyResetToken(token: string) {
    if (!token) {
      return { valid: false, message: 'Token is required' };
    }

    const user = await this.userRepository.findOne({
      where: { reset_token: token }
    });

    if (!user) {
      return { valid: false, message: 'Invalid reset token' };
    }

    if (user.reset_token_expiry && new Date() > user.reset_token_expiry) {
      return { valid: false, message: 'Reset token has expired' };
    }

    return { valid: true, message: 'Token is valid' };
  }


async resetPassword(dto: ResetPasswordDto) {
  this.logger.log(`Reset password attempt with token: ${dto.token}`);

  
  const user = await this.userRepository.findOne({
    where: { reset_token: dto.token }
  });

  if (!user) {
    this.logger.warn(`Reset password failed: invalid token`);
    throw new BadRequestException('Invalid or expired reset token');
  }

  
  if (user.reset_token_expiry && new Date() > user.reset_token_expiry) {
    this.logger.warn(`Reset password failed: expired token for user: ${user.email}`);
    throw new BadRequestException('Reset token has expired. Please request a new password reset.');
  }

  
  const hashedPassword = await bcrypt.hash(dto.password, 10);

  
  await this.userRepository.update(user.id, {
    password: hashedPassword,
    reset_token: null,
    reset_token_expiry: null,
  });

  
  const userName = `${user.first_name} ${user.last_name}`;
  await this.emailService.sendPasswordResetSuccessEmail(user.email, userName);

  this.logger.log(`Password reset successful for user: ${user.email}`);
  
  return { message: 'Password reset successfully' };
}


  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['role'],
      });

      if (!user) {
        this.logger.warn(`Refresh token failed: user not found for id: ${payload.sub}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (!user.role?.name) {
        this.logger.warn(`Refresh token failed: user role missing for id: ${payload.sub}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify that the stored refresh token matches the provided one
      if (user.refresh_token !== refreshToken) {
        this.logger.warn(`Refresh token failed: token mismatch for user: ${user.email}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = {
        email: user.email,
        sub: user.id,
        role: user.role.name.toLowerCase(),
        tenant_id: user.tenant_id,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
      });

      this.logger.log(`Access token refreshed successfully for user: ${user.email}`);
      return { accessToken: newAccessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(`Refresh token failed: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      
      await this.userRepository.update(user.id, {
        refresh_token: null,
      });

      this.logger.log(`User logged out successfully: ${user.email}`);
      return { message: 'Successfully logged out' };
    } catch (error) {
      this.logger.warn(`Logout failed: invalid refresh token`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
