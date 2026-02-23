import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../common/utils/email';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

type MockUserRepository = {
  findOne: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  query: jest.Mock;
};

describe('AuthService - Refresh Token', () => {
  let service: AuthService;

  const mockUserRepository: MockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'JWT_SECRET') return 'mocked-secret';
      if (key === 'JWT_EXPIRES_IN') return '24h';
      return null;
    }),
  };

  const mockEmailService = {
    sendPasswordResetEmail: jest.fn(),
    sendPasswordResetSuccessEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'valid-refresh-token';
    const mockNewAccessToken = 'new-access-token';
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      refresh_token: mockRefreshToken,
      tenant_id: 1,
      role: {
        name: 'user',
      },
    };

    it('should successfully refresh access token with valid refresh token', async () => {
      const mockPayload = {
        sub: 1,
        email: 'test@example.com',
        role: 'user',
        tenant_id: 1,
      };

      const mockPermissions = [{ name: 'read:users' }, { name: 'write:users' }];

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.query.mockResolvedValue(mockPermissions);
      mockJwtService.sign.mockReturnValue(mockNewAccessToken);

      const result = await service.refreshToken(mockRefreshToken);

      expect(result).toEqual({ accessToken: mockNewAccessToken });
      expect(mockJwtService.verify).toHaveBeenCalledWith(mockRefreshToken, {
        secret: 'mocked-secret',
      });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['role'],
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          email: 'test@example.com',
          sub: 1,
          role: 'user',
          tenant_id: 1,
          permissions: ['read:users', 'write:users'],
        },
        {
          secret: 'mocked-secret',
          expiresIn: '24h',
        },
      );
    });

    it('should throw BadRequestException when refresh token is missing', async () => {
      await expect(service.refreshToken('')).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const mockPayload = { sub: 999 };
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user role is missing', async () => {
      const mockPayload = { sub: 1 };
      const userWithoutRole = { ...mockUser, role: null };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUserRepository.findOne.mockResolvedValue(userWithoutRole);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when stored refresh token does not match', async () => {
      const mockPayload = { sub: 1 };
      const userWithDifferentToken = { ...mockUser, refresh_token: 'different-token' };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUserRepository.findOne.mockResolvedValue(userWithDifferentToken);

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when JWT verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });
});
