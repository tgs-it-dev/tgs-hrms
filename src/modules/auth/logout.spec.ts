import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const mockPassword = bcrypt.hashSync('123456', 10);

// Mock Role entity
const mockRole = {
  id: 'role-1',
  name: 'Admin',
  users: [],
};

// Mock user according to User entity
const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  phone: '1234567890',
  password: mockPassword,
  first_name: 'Admin',
  last_name: 'User',
  role_id: mockRole.id,
  role: mockRole as any, // Mock Role
  gender: 'male',
  tenant_id: '1', // Correct property name
  tenant: null as any, // Mock Tenant if needed
  created_at: new Date(),
  updated_at: new Date(),
  employees: [],
  attendances: [],
  refresh_token: '',
  reset_token: null,
  reset_token_expiry: null,
};

// Mock UserRepository
const mockUserRepository = () => ({
  findOneBy: jest.fn().mockResolvedValue(mockUser),
  save: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn().mockImplementation(({ where }: { where: { email: string } }) => {
    if (where.email === mockUser.email) return Promise.resolve(mockUser);
    return Promise.resolve(null);
  }),
});

// Mock JwtService
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
};

// Mock ConfigService
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
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

    const result = await service.validateUser('admin@company.com', '123456');

    expect(result).toHaveProperty('accessToken', 'mocked-jwt-token');
    expect(result.user?.email).toBe('admin@company.com');
  });

  it('should throw error for invalid email', async () => {
    await expect(
      service.validateUser('wrong@company.com', '123456')
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw error for invalid password', async () => {
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

    await expect(
      service.validateUser('admin@company.com', 'wrongpass')
    ).rejects.toThrow(BadRequestException);
  });
});
