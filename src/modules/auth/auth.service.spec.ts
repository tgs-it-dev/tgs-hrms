import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const mockPassword = bcrypt.hashSync('123456', 10);

const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  password: mockPassword,
  role: UserRole.ADMIN,
  tenantId: 1,
  resetToken: '',
  resetTokenExpiry: new Date(),
  refreshToken: '',
  name: 'Admin User',
  companyId: 'some-company-uuid',
  company: null,
};

const mockUserRepository = () => ({
  findOneBy: jest.fn().mockResolvedValue(mockUser),
  save: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn().mockImplementation(({ where }: { where: { email: string } }) => {
    if (where.email === mockUser.email) return Promise.resolve(mockUser);
    return Promise.resolve(null);
  }),
});

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'JWT_SECRET') return 'mocked-secret';
    if (key === 'JWT_EXPIRES_IN') return '15m';
    return null;
  }),
};

describe('AuthService - Login', () => {
  let service: AuthService;
  let userRepo: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should validate and return access token for valid credentials', async () => {
    const result = await service.validateUser('admin@company.com', '123456');
    expect(result).toHaveProperty('accessToken', 'mocked-jwt-token');
    expect(result.user?.email).toBe('admin@company.com');
  });

  it('should throw error for invalid email', async () => {
    await expect(service.validateUser('wrong@company.com', '123456')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw error for invalid password', async () => {
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));
    await expect(service.validateUser('admin@company.com', 'wrongpass')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
