import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../entities/role.entity';
import { Tenant } from '../../entities/tenant.entity';
import { SubscriptionStatus } from '../../common/constants/enums';
import { Employee } from '../../entities/employee.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { SignupSession } from '../../entities/signup-session.entity';
import { UserToken } from '../../entities/user-token.entity';
import { EmailService } from '../../common/utils/email';
import { InviteStatusService } from '../invite-status/invite-status.service';
import { SystemSettingsService } from '../system/system-settings/system-settings.service';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { IpWhitelistService } from '../ip-whitelist/ip-whitelist.service';

jest.mock('bcrypt', () => ({
  ...jest.requireActual<typeof import('bcrypt')>('bcrypt'),
  hash: jest.fn(),
  compare: jest.fn(),
}));

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
  status: 'active',
  subscription_status: SubscriptionStatus.ACTIVE,
  trial_ends_at: null,
  grace_period_ends_at: null,
  seat_limit: null,
  schema_provisioned: false,
  workflow_enabled: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  users: [],
  departments: [],
  designations: [],
  leaves: [],
  geofences: [],
};

const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  password: bcrypt.hashSync('123456', 10),
  role_id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '11111111-1111-1111-1111-111111111111',
  reset_token: 'valid-token',
  reset_token_expiry: new Date(Date.now() + 60000),
  first_name: 'Test',
  last_name: 'User',
  phone: '1234567890',
  gender: null,
  profile_pic: null,
  first_login_time: new Date(0),
  created_at: new Date(),
  updated_at: new Date(),
  role: mockRole,
  tenant: mockTenant,
  deleted_at: null,
  employees: [],
  attendances: [],
  managedTeams: [],
  email_verified: true,
  email_verification_token: null,
  email_verification_expires_at: null,
  failed_login_attempts: 0,
  locked_until: null,
};

// A valid token record for the new refresh-token-rotation flow
const mockTokenRecord = {
  id: 'valid-jti',
  user_id: '1',
  is_revoked: false,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  platform: null,
  device_info: null,
  ip_address: null,
};

const mockUserRepository = () => ({
  find: jest.fn().mockResolvedValue([mockUser]),
  findOneBy: jest.fn().mockResolvedValue(mockUser),
  findOne: jest.fn().mockResolvedValue(mockUser),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  query: jest.fn().mockResolvedValue([]),
  createQueryBuilder: jest.fn(() => ({
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(mockUser),
  })),
});

const mockEmailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetSuccessEmail: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService - Forgot/Reset/Refresh/Logout', () => {
  let service: AuthService;
  let userRepo: any;
  let jwtService: JwtService;
  let _userTokenRepo: any;
  let updateSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        {
          provide: getRepositoryToken(Employee),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(CompanyDetails),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(SignupSession),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Role),
          useValue: { findOne: jest.fn().mockResolvedValue(mockRole) },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: { findOne: jest.fn().mockResolvedValue(mockTenant) },
        },
        {
          provide: getRepositoryToken(UserToken),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockTokenRecord),
            save: jest.fn().mockResolvedValue(mockTokenRecord),
            create: jest.fn(),
            delete: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            manager: {
              transaction: jest
                .fn()
                .mockImplementation(async (fn: (em: any) => Promise<any>) => {
                  const mockEm = {
                    update: jest.fn().mockResolvedValue({ affected: 1 }),
                    save: jest.fn().mockResolvedValue({}),
                  };
                  return fn(mockEm);
                }),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('new-token'),
            verify: jest
              .fn()
              .mockReturnValue({ type: 'refresh', jti: 'valid-jti', sub: '1' }),
            decode: jest.fn().mockReturnValue({ jti: 'valid-jti' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'JWT_SECRET':
                  return 'test-secret';
                case 'JWT_EXPIRES_IN':
                  return '24h';
                case 'RESET_TOKEN_SECRET':
                  return 'test-reset-secret';
                default:
                  return 'dummy';
              }
            }),
          },
        },
        { provide: EmailService, useValue: mockEmailService },
        {
          provide: InviteStatusService,
          useValue: {
            getInviteStatus: jest.fn(),
            setInviteStatus: jest.fn(),
            updateInviteStatusOnLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TenantSettingsService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            getBoolean: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: IpWhitelistService,
          useValue: {
            isIpWhitelisted: jest.fn().mockResolvedValue(true),
            isIpRestrictionEnabled: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: SystemSettingsService,
          useValue: { getBoolean: jest.fn().mockReturnValue(true) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    _userTokenRepo = module.get(getRepositoryToken(UserToken));
    updateSpy = jest.spyOn(userRepo, 'update');

    (bcrypt.hash as jest.Mock).mockResolvedValue('mocked-hash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => jest.resetAllMocks());

  describe('forgotPassword', () => {
    it('should generate reset token for valid email', async () => {
      // forgotPassword uses createQueryBuilder to find user
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ ...mockUser, tenant: mockTenant }),
      };
      jest.spyOn(userRepo, 'createQueryBuilder').mockReturnValue(mockQb);

      const result = await service.forgotPassword({
        email: 'admin@company.com',
      });
      expect(result).toEqual({
        message: 'Check your email for the password reset link.',
      });
      expect(updateSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reset_token: expect.any(String) as unknown,
          reset_token_expiry: expect.any(Date) as unknown,
        }),
      );
    });

    it('should throw BadRequestException for unknown email', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(userRepo, 'createQueryBuilder').mockReturnValue(mockQb);

      await expect(
        service.forgotPassword({ email: 'invalid@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      // Service uses find() to get all users with non-expired tokens, then bcrypt.compare per user
      const hashedToken = await bcrypt.hash('valid-token', 10);
      jest.spyOn(userRepo, 'find').mockResolvedValue([
        {
          ...mockUser,
          reset_token: hashedToken,
          reset_token_expiry: new Date(Date.now() + 60000),
          tenant: mockTenant,
        },
      ]);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.resetPassword({
        token: 'valid-token',
        password: 'newpass123',
        confirmPassword: 'newpass123',
      });

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(updateSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          password: 'hashedPassword',
          reset_token: null,
          reset_token_expiry: null,
        }),
      );
    });

    it('should throw for invalid/unknown token', async () => {
      // No users found with matching non-expired tokens
      jest.spyOn(userRepo, 'find').mockResolvedValue([]);

      await expect(
        service.resetPassword({
          token: 'wrong',
          password: 'newpass123',
          confirmPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for expired token', async () => {
      // Service query filters out expired tokens, so find returns []
      jest.spyOn(userRepo, 'find').mockResolvedValue([]);

      await expect(
        service.resetPassword({
          token: 'valid-token',
          password: 'newpass123',
          confirmPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should return new access + refresh token if refresh token is valid', async () => {
      // verify returns { type: 'refresh', jti: 'valid-jti', sub: '1' } (set in beforeEach)
      // userTokenRepo.findOne returns non-revoked, non-expired record (set in beforeEach)
      // userRepo.findOne returns user with role (set in beforeEach)
      const result = await service.refreshToken('refresh-token');
      expect(result).toHaveProperty('accessToken', 'new-token');
      expect(result).toHaveProperty('refreshToken', 'new-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);
      await expect(service.refreshToken('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh token is tampered', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke token on logout', async () => {
      // Service uses jwtService.decode() (not verify) and calls userTokenRepo.update
      const result = await service.logout('refresh-token');
      expect(result).toEqual({ message: 'Successfully logged out' });
    });

    it('should throw BadRequestException if no token', async () => {
      await expect(service.logout('')).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for token with missing jti', async () => {
      jest.spyOn(jwtService, 'decode').mockReturnValue({ jti: null } as any);
      await expect(service.logout('invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
