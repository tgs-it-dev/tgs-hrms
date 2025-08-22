import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Local enum because UserRole is not exported from entity
enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

const mockPassword = bcrypt.hashSync('123456', 10);

const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  password: mockPassword,
  role: {} as any, // agar relation chahiye to dummy daal do
  role_id: 'role-uuid',
  tenant_id: '1',
  reset_token: '',
  reset_token_expiry: new Date(),
  refresh_token: '',
  first_name: 'Admin',
  last_name: 'User',
  phone: '1234567890',
  gender: null,
  created_at: new Date(),
  updated_at: new Date(),
  employees: [],
  attendances: [],
  tenant: {} as any,
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
    if (key === 'JWT_EXPIRES_IN') return '1d';
    return null;
  }),
};

describe('AuthService - Logout', () => {
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

     it('should clear refresh token on logout', async () => {
    mockUser.refresh_token = 'sometoken';

    jest.spyOn(userRepo, 'save').mockResolvedValue({
      ...mockUser,
      refresh_token: '', 
    });

    const result = await service.logout(mockUser.id);
    expect(result).toEqual({ message: 'Logged out successfully' });
  });


  it('should throw error if user not found', async () => {
    jest.spyOn(userRepo, 'findOneBy').mockResolvedValue(null);

    await expect(service.logout('wrong-id')).rejects.toThrow(BadRequestException);
  });
});
