import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../entities/role.entity';
import { Tenant } from '../../entities/tenant.entity';
import { EmailService } from '../../common/utils/email';

const mockPassword = bcrypt.hashSync('123456', 10);

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
  schema_provisioned: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  users: [],
  departments: [],
  designations: [],
  benefits: [],
  employeeBenefits: [],
  kpis: [],
  employeeKpis: [],
  employeePerformanceReviews: [],
  employeePromotions: [],
  assets: [],
  leaves: [],
  tasks: [],
  assetComments: [],
  geofences: [],
};

const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  password: mockPassword,
  role_id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '11111111-1111-1111-1111-111111111111',
  reset_token: '',
  reset_token_expiry: new Date(),
  refresh_token: '',
  first_name: 'Admin',
  last_name: 'User',
  phone: '1234567890',
  gender: null,
  profile_pic: null,
  first_login_time: null,
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
  save: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn().mockImplementation(({ where }: { where: { email: string } }) => {
    if (where.email === mockUser.email) return Promise.resolve(mockUser);
    return Promise.resolve(null);
  }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  query: jest.fn().mockResolvedValue([]),
});

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'JWT_SECRET') return 'mocked-secret';
    if (key === 'JWT_EXPIRES_IN') return '24h';
    return null;
  }),
};

const mockEmailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetSuccessEmail: jest.fn().mockResolvedValue(undefined),
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
        { provide: EmailService, useValue: mockEmailService },
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
    await expect(service.validateUser('wrong@company.com', '123456')).rejects.toThrow(
      BadRequestException
    );
  });

  it('should throw error for invalid password', async () => {
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

    await expect(service.validateUser('admin@company.com', 'wrongpass')).rejects.toThrow(
      BadRequestException
    );
  });
});
