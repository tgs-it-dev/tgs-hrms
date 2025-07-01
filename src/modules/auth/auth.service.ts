import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
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
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

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
    try {
      const decoded = this.jwtService.verify(dto.token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userRepository.findOne({ where: { id: decoded.sub } });

      if (!user) throw new BadRequestException('Invalid token');

      if (user.resetTokenExpiry && new Date() > user.resetTokenExpiry) {
        throw new BadRequestException('Reset token has expired');
      }

      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
      user.password = hashedPassword;
      await this.userRepository.save(user);

      return { message: 'Password successfully reset' };
    } catch (err) {
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

  // ✅ LOGOUT METHOD
  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    const user = await this.userRepository.findOne({ where: { refreshToken } });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    user.refreshToken = null;
    await this.userRepository.save(user);

    return { message: 'Successfully logged out' };
  }
}
