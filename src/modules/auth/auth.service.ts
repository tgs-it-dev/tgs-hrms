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
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({ ...dto, password: hashedPassword });
    await this.userRepository.save(user);
    return { message: 'User registered successfully' };
  }

  async validateUser(email: string, password: string) {
    this.logger.log(`Login attempt for email: ${email}`);
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      this.logger.warn(`Login failed: user not found for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '7d',
    });

    user.refreshToken = refreshToken;
    await this.userRepository.save(user);

    this.logger.log(`Login successful for email: ${email}`);
    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('User with this email does not exist');

    const payload = { email: user.email, sub: user.id };
    const resetToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await this.userRepository.save(user);

    return {
      message: 'Reset link sent to email',
      resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    this.logger.log(`Password reset attempt with token: ${dto.token}`);
    try {
      const decoded = this.jwtService.verify(dto.token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      const user = await this.userRepository.findOne({ where: { id: decoded.sub } });
      if (!user) {
        this.logger.warn(`Password reset failed: user not found for token: ${dto.token}`);
        throw new BadRequestException('Invalid token');
      }
      if (!user.resetToken || user.resetToken !== dto.token) {
        this.logger.warn(`Password reset failed: token mismatch for user id: ${user.id}`);
        throw new BadRequestException('Invalid or expired token');
      }
      if (user.resetTokenExpiry && new Date() > user.resetTokenExpiry) {
        this.logger.warn(`Password reset failed: token expired for user id: ${user.id}`);
        throw new BadRequestException('Reset token has expired');
      }
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
      user.password = hashedPassword;
      user.resetToken = null;
      user.resetTokenExpiry = null;
      await this.userRepository.save(user);
      this.logger.log(`Password reset successful for user id: ${user.id}`);
      return { message: 'Password successfully reset' };
    } catch (err) {
      this.logger.warn(`Password reset failed: ${err.message}`);
      throw new BadRequestException('Invalid or expired token');
    }
  }

  async refreshToken(refreshToken: string) {
    const user = await this.userRepository.findOne({ where: { refreshToken } });
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const newAccessToken = this.jwtService.sign(
        {
          email: user.email,
          id: user.id,
          role: user.role,
          tenantId: user.tenantId,
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
        },
      );

      return { accessToken: newAccessToken };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  
  async logout(refreshToken: string) {
    this.logger.log(`Logout attempt with refresh token: ${refreshToken}`);
    if (!refreshToken) {
      this.logger.warn('Logout failed: Refresh token is required');
      throw new BadRequestException('Refresh token is required');
    }
    const user = await this.userRepository.findOne({ where: { refreshToken } });
    if (!user) {
      this.logger.warn('Logout failed: Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }
    user.refreshToken = null;
    await this.userRepository.save(user);
    this.logger.log(`Logout successful for user id: ${user.id}`);
    return { message: 'Successfully logged out' };
  }
}
