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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if user already exists with the same email
    const existingUser = await this.userRepository.findOne({ 
      where: { email: dto.email.toLowerCase() } 
    });

    if (existingUser) {
      throw new BadRequestException({ 
        field: 'email', 
        message: 'User with this email already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(), // Normalize email to lowercase
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
     const normalizedEmail = email.toLowerCase();  // 👈 Normalize to lowercase
    this.logger.log(`Login attempt for email: ${normalizedEmail}`);
    const user = await this.userRepository.findOne({ 
      where: { email : normalizedEmail },
      relations: ['role']
    });

    if (!user) {
    this.logger.warn(`Login failed: user not found for email: ${normalizedEmail}`);
    // Use BadRequestException and include a field
    throw new BadRequestException({ field: 'email', message: 'Email not found' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    this.logger.warn(`Login failed: invalid password for email: ${normalizedEmail}`);
    // Use BadRequestException and include a field
    throw new BadRequestException({ field: 'password', message: 'Incorrect password' });
  }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.name.toLowerCase(),
      tenant_id: user.tenant_id,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
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
    const user = await this.userRepository.findOne({ 
      where: { email: dto.email.toLowerCase() } 
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate reset token (you might want to use a more secure method)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // In a real application, you would:
    // 1. Hash the reset token before storing
    // 2. Send the reset token via email
    // 3. Set an expiration time
    
    // For now, we'll just return the token
    return { 
      message: 'Password reset token generated',
      resetToken: resetToken // In production, don't return this directly
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userRepository.findOne({ 
      where: { email: dto.email.toLowerCase() } 
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // In a real application, you would validate the reset token
    // For now, we'll just update the password
    
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    user.password = hashedPassword;
    
    await this.userRepository.save(user);
    
    return { message: 'Password reset successfully' };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userRepository.findOne({ 
        where: { id: payload.sub },
        relations: ['role']
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = {
        email: user.email,
        sub: user.id,
        role: user.role.name,
        tenant_id: user.tenant_id,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
      });

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userRepository.findOne({ 
        where: { id: payload.sub } 
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // In a real application, you might want to blacklist the refresh token
      // For now, we'll just return a success message
      return { message: 'Logged out successfully' };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}






