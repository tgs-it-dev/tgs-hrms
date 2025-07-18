import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  password: bcrypt.hashSync('123456', 10),
  role: UserRole.ADMIN,
  tenantId: '1', 
  resetToken: 'valid-token',
  resetTokenExpiry: new Date(Date.now() + 60000),
  refreshToken: 'refresh-token',
  name: 'Test User',
  company: null, 
};

const mockUserRepository = () => ({
  findOneBy: jest.fn().mockResolvedValue(mockUser),
  findOne: jest.fn().mockResolvedValue(mockUser),
  save: jest.fn(),
});

describe('AuthService - Forgot/Reset/Refresh/Logout', () => {
  let service: AuthService;
  let userRepo: Repository<User>;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('new-token'),
            verify: jest.fn().mockReturnValue({ sub: '1' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              switch (key) {
                case 'JWT_SECRET':
                  return 'test-secret';
                case 'RESET_TOKEN_SECRET':
                  return 'test-reset-secret';
                default:
                  return 'dummy';
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('forgotPassword', () => {
    it('should generate reset token for valid email', async () => {
      const result = await service.forgotPassword({ email: 'admin@company.com' });
      expect(result).toEqual({
        message: 'Reset link sent to email',
        resetToken: expect.any(String),
      });
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ resetToken: expect.any(String) })
      );
    });

    it('should throw BadRequestException for unknown email', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);
      await expect(
        service.forgotPassword({ email: 'invalid@example.com' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      const token = 'valid-token';

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: mockUser.id });

      jest.spyOn(userRepo, 'findOne').mockResolvedValue({
        ...mockUser,
        resetToken: token,
        resetTokenExpiry: new Date(Date.now() + 60000),
      });

      jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashedPassword');

      const result = await service.resetPassword({
        token,
        newPassword: 'newpass123',
      });

      expect(result).toEqual({ message: 'Password successfully reset' });
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashedPassword',
          resetToken: null,
          resetTokenExpiry: null,
        })
      );
    });

    it('should throw for invalid token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error();
      });

      await expect(
        service.resetPassword({ token: 'wrong', newPassword: 'newpass123' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for expired token', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: mockUser.id });

      const expiredUser = {
        ...mockUser,
        resetToken: 'valid-token',
        resetTokenExpiry: new Date(Date.now() - 60000),
      };

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(expiredUser);

      await expect(
        service.resetPassword({ token: 'valid-token', newPassword: 'newpass123' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should return new access token if refresh token is valid', async () => {
      const result = await service.refreshToken('refresh-token');
      expect(result).toEqual({ accessToken: 'new-token' });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);
      await expect(service.refreshToken('invalid')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token is tampered', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error();
      });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear refresh token on logout', async () => {
      const result = await service.logout('refresh-token');
      expect(result).toEqual({ message: 'Successfully logged out' });
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ refreshToken: null })
      );
    });

    it('should throw BadRequestException if no token', async () => {
      await expect(service.logout('')).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);
      await expect(service.logout('invalid')).rejects.toThrow(UnauthorizedException);
    });
  });
});
