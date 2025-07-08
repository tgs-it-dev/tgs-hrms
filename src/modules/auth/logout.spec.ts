import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../../entities/user.entity';  
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';

describe('Logout Feature', () => {
  let authService: AuthService;
  let userRepo: Repository<User>;

  const mockUser: User = {
    id: '1',
    email: 'user@example.com',
    password: 'hashed',
    tenantId: 123,
    role: UserRole.ADMIN, 
    refreshToken: 'valid-token',
    resetToken: null,
    resetTokenExpiry: null,
    name: 'Test User',
    companyId: 'some-company-uuid',
    company: null,
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        ConfigService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should logout and nullify refreshToken', async () => {
    mockUserRepo.findOne.mockResolvedValue(mockUser);
    mockUserRepo.save.mockResolvedValue({ ...mockUser, refreshToken: null });

    const response = await authService.logout('valid-token');

    expect(mockUserRepo.findOne).toHaveBeenCalledWith({
      where: { refreshToken: 'valid-token' },
    });
    expect(mockUserRepo.save).toHaveBeenCalledWith({
      ...mockUser,
      refreshToken: null,
    });
    expect(response).toEqual({ message: 'Successfully logged out' });
  });

  it('should throw BadRequestException if token is missing', async () => {
    await expect(authService.logout(null as unknown as string)).rejects.toThrow(BadRequestException);
  });

  it('should throw UnauthorizedException if token is not found', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(authService.logout('invalid-token')).rejects.toThrow(UnauthorizedException);
  });
});
