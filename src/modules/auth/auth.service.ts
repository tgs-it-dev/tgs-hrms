import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
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
import { InviteStatusService } from '../invite-status/invite-status.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private inviteStatusService: InviteStatusService
  ) {}

  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      this.logger.log(`Loading permissions for user ${userId}`);

      // First get the user with role to ensure we have the role_id
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });

      if (!user || !user.role) {
        this.logger.warn(`User ${userId} has no role assigned`);
        return [];
      }

      // Use a raw query to get permissions for the user's role
      const result = await this.userRepository.query(
        `
        SELECT p.name 
        FROM permissions p 
        JOIN role_permissions rp ON p.id = rp.permission_id 
        WHERE rp.role_id = $1
      `,
        [user.role.id]
      );

      this.logger.log(`Raw permission query result: ${JSON.stringify(result)}`);

      const permissions = result.map((row: any) => row.name.toLowerCase());
      this.logger.log(`Processed permissions for user ${userId}: ${JSON.stringify(permissions)}`);

      return permissions;
    } catch (error) {
      this.logger.error(`Failed to load permissions for user ${userId}: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      return [];
    }
  }

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

  async validateToken(userId: string) {
    this.logger.log(`Validating token for user: ${userId}`);
  
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });
  
      if (!user) {
        this.logger.warn(`Token validation failed: user not found for id: ${userId}`);
        throw new UnauthorizedException('User not found or has been deleted');
      }
  
      if (!user.role?.name) {
        this.logger.warn(`Token validation failed: user role missing for id: ${userId}`);
        throw new UnauthorizedException('User role not found');
      }
  
      // Get user permissions
      const permissions = await this.getUserPermissions(user.id);
  
      this.logger.log(`Token validation successful for user: ${user.email}`);
  
      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role.name.toLowerCase(),
          tenant_id: user.tenant_id,
          permissions,
        }
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Token validation error for user ${userId}: ${error.message}`);
      throw new UnauthorizedException('Token validation failed');
    }
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

    // Get user permissions
    const permissions = await this.getUserPermissions(user.id);

    this.logger.log(`User ${user.email} has role: ${user.role.name}`);
    this.logger.log(`User ${user.email} permissions: ${JSON.stringify(permissions)}`);

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.name.toLowerCase(),
      tenant_id: user.tenant_id,
      permissions,
    };

    this.logger.log(`JWT payload for user ${user.email}: ${JSON.stringify(payload)}`);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '7d',
    });

    user.refresh_token = refreshToken;
    
    // Set first_login_time if it's null (first time login)
    if (!user.first_login_time) {
      user.first_login_time = new Date();
      this.logger.log(`First login recorded for user: ${normalizedEmail}`);
      
      // Update invite status to 'Joined' since user has logged in
      await this.inviteStatusService.updateInviteStatusOnLogin(user.id);
    }
    
    await this.userRepository.save(user);

    this.logger.log(`Login successful for email: ${normalizedEmail}`);
    return {
      accessToken,
      refreshToken,
      user,
      permissions,
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
      where: { reset_token: token },
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
      where: { reset_token: dto.token },
    });

    if (!user) {
      this.logger.warn(`Reset password failed: invalid token`);
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.reset_token_expiry && new Date() > user.reset_token_expiry) {
      this.logger.warn(`Reset password failed: expired token for user: ${user.email}`);
      throw new BadRequestException(
        'Reset token has expired. Please request a new password reset.'
      );
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

  // async refreshToken(refreshToken: string) {
  //   if (!refreshToken) {
  //     throw new BadRequestException('Refresh token is required');
  //   }

  //   try {
  //     const payload = this.jwtService.verify(refreshToken, {
  //       secret: this.configService.get<string>('JWT_SECRET'),
  //     });

  //     const user = await this.userRepository.findOne({
  //       where: { id: payload.sub },
  //       relations: ['role'],
  //     });

  //     if (!user) {
  //       this.logger.warn(`Refresh token failed: user not found for id: ${payload.sub}`);
  //       throw new UnauthorizedException('Invalid refresh token');
  //     }

  //     if (!user.role?.name) {
  //       this.logger.warn(`Refresh token failed: user role missing for id: ${payload.sub}`);
  //       throw new UnauthorizedException('Invalid refresh token');
  //     }

  //     // Verify that the stored refresh token matches the provided one
  //     if (user.refresh_token !== refreshToken) {
  //       this.logger.warn(`Refresh token failed: token mismatch for user: ${user.email}`);
  //       throw new UnauthorizedException('Invalid refresh token');
  //     }

  //     // Get user permissions
  //     const permissions = await this.getUserPermissions(user.id);

  //     this.logger.log(`Refresh: User ${user.email} has role: ${user.role.name}`);
  //     this.logger.log(`Refresh: User ${user.email} permissions: ${JSON.stringify(permissions)}`);

  //     const newPayload = {
  //       email: user.email,
  //       sub: user.id,
  //       role: user.role.name.toLowerCase(),
  //       tenant_id: user.tenant_id,
  //       permissions,
  //     };

  //     this.logger.log(`Refresh: JWT payload for user ${user.email}: ${JSON.stringify(newPayload)}`);

  //     const newAccessToken = this.jwtService.sign(newPayload, {
  //       secret: this.configService.get<string>('JWT_SECRET'),
  //       expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
  //     });

  //     this.logger.log(`Access token refreshed successfully for user: ${user.email}`);
  //     return { accessToken: newAccessToken };
  //   } catch (error) {
  //     if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
  //       throw error;
  //     }
  //     this.logger.warn(`Refresh token failed: ${error.message}`);
  //     throw new UnauthorizedException('Invalid refresh token');
  //   }
  // }


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
        throw new UnauthorizedException('User not found or has been deleted');
      }
  
      if (!user.role?.name) {
        this.logger.warn(`Refresh token failed: user role missing for id: ${payload.sub}`);
        throw new UnauthorizedException('User role not found');
      }
  
      // Verify that the stored refresh token matches the provided one
      if (user.refresh_token !== refreshToken) {
        this.logger.warn(`Refresh token failed: token mismatch for user: ${user.email}`);
        throw new UnauthorizedException('Invalid refresh token');
      }
  
      // Get user permissions
      const permissions = await this.getUserPermissions(user.id);
  
      this.logger.log(`Refresh: User ${user.email} has role: ${user.role.name}`);
      this.logger.log(`Refresh: User ${user.email} permissions: ${JSON.stringify(permissions)}`);
  
      const newPayload = {
        email: user.email,
        sub: user.id,
        role: user.role.name.toLowerCase(),
        tenant_id: user.tenant_id,
        permissions,
      };
  
      this.logger.log(`Refresh: JWT payload for user ${user.email}: ${JSON.stringify(newPayload)}`);
  
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
  
  async deleteUser(userId: string) {
    this.logger.log(`Deleting user: ${userId}`);
  
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
  
    if (!user) {
      throw new NotFoundException('User not found');
    }
  
    // Clear refresh token to invalidate all sessions
    await this.userRepository.update(userId, {
      refresh_token: null,
    });
  
    // Delete the user
    await this.userRepository.delete(userId);
  
    this.logger.log(`User deleted successfully: ${user.email}`);
    return { message: 'User deleted successfully' };
  }




}