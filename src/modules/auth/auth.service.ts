// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * AuthService handles authentication logic including registration, login, password reset,
 * and token refresh. It uses bcrypt for password hashing and JWT for stateless authentication.
 *
 * Security:
 * - Passwords are hashed with bcrypt before storage.
 * - JWT payload includes user id, role, and tenantId for multi-tenant and role-based access.
 * - Refresh tokens are issued for session renewal (demo: stored in user entity).
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({ ...dto, password: hashedPassword });
    await this.userRepository.save(user);
    return { message: 'User registered successfully' };
  }

  /**
   * Validates user credentials and issues JWT access and refresh tokens.
   * Passwords are compared using bcrypt.
   *
   * Security: Throws UnauthorizedException for invalid credentials.
   */
  async validateUser(email: string, password: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const payload = { email: user.email, sub: user.id, role: user.role, tenantId: user.tenantId };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    user["refreshToken"] = refreshToken;
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
    const resetToken = this.jwtService.sign(payload, { expiresIn: '15m' });

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
      const decoded = this.jwtService.verify(dto.token);
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

  /**
   * Issues a new access token if the provided refresh token is valid.
   *
   * Security: Throws UnauthorizedException for invalid or expired refresh tokens.
   */
  async refreshToken(refreshToken: string) {
    const user = await this.userRepository.findOne({ where: { refreshToken } });
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    try {
      const payload = this.jwtService.verify(refreshToken);
      const newAccessToken = this.jwtService.sign({
        email: user.email,
        sub: user.id,
        role: user.role,
        tenantId: user.tenantId,
      });
      return { accessToken: newAccessToken };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
