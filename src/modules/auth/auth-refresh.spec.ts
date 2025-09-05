import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../entities/role.entity';
import { Tenant } from '../../entities/tenant.entity';
import { EmailService } from './email.service';

const mockRole: Role = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'admin',
  description: 'Administrator role',
  users: [],
  rolePermissions: [],
};

const mockTenant: Tenant = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Test Company',
  created_at: new Date(),
  users: [],
  departments: [],
};

const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  password: bcrypt.hashSync('123456', 10),
  role_id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '11111111-1111-1111-1111-111111111111', 
  reset_token: 'valid-token',
  reset_token_expiry: new Date(Date.now() + 60000),
  refresh_token: 'refresh-token',
  first_name: 'Test',
  last_name: 'User',
  phone: '1234567890',
  gender: null,
  profile_pic: null,
  created_at: new Date(),
  updated_at: new Date(),
  role: mockRole,
  tenant: mockTenant,
  employees: [],
  attendances: [],
  managedTeams: [],
};

const mockUserRepository = () => ({
  findOneBy: jest.fn().mockResolvedValue(mockUser),
  findOne: jest.fn().mockResolvedValue(mockUser),
  save: jest.fn(),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  query: jest.fn().mockResolvedValue([]),
});

const mockEmailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetSuccessEmail: jest.fn().mockResolvedValue(undefined),
};

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
        { provide: EmailService, useValue: mockEmailService },
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
        message: 'Check your email for the password reset link.',
      });
      expect(userRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ 
          reset_token: expect.any(String),
          reset_token_expiry: expect.any(Date)
        })
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
        reset_token: token,
        reset_token_expiry: new Date(Date.now() + 60000),
      });

      jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashedPassword');

      const result = await service.resetPassword({
        token,
        password: 'newpass123',
        confirmPassword: 'newpass123',
      });

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(userRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          password: 'hashedPassword',
          reset_token: null,
          reset_token_expiry: null,
        })
      );
    });

    it('should throw for invalid token', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'wrong', password: 'newpass123', confirmPassword: 'newpass123' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for expired token', async () => {
      const expiredUser = {
        ...mockUser,
        reset_token: 'valid-token',
        reset_token_expiry: new Date(Date.now() - 60000),
      };

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(expiredUser);

      await expect(
        service.resetPassword({ token: 'valid-token', password: 'newpass123', confirmPassword: 'newpass123' })
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
      expect(userRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ refresh_token: null })
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
