import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

const mockPassword = bcrypt.hashSync('123456', 10);

const baseUser: User = {
  id: 1,
  email: 'admin@company.com',
  password: mockPassword,
  role: 'admin',
  tenantId: 1,
  resetToken: '',
  resetTokenExpiry: new Date(),
  refreshToken: '',
};

describe('AuthService - Reset Password', () => {
  let service: AuthService;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-jwt-token'),
    verify: jest.fn().mockReturnValue({ sub: baseUser.id }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate reset token for valid email', async () => {
    mockUserRepository.findOne.mockResolvedValue(baseUser);
    mockUserRepository.save.mockResolvedValue(baseUser);

    const result = await service.forgotPassword({ email: baseUser.email });

    expect(result).toEqual({ message: 'Reset link sent to email', resetToken: expect.any(String) });
    expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining({ resetToken: expect.any(String) }));
  });

  it('should throw BadRequestException for unknown email', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: 'unknown@email.com' })
    ).rejects.toThrow(BadRequestException);
  });

  it('should reset password for valid token', async () => {
    const validUser = {
      ...baseUser,
      resetToken: 'valid-token',
      resetTokenExpiry: new Date(Date.now() + 10000),
    };

    mockJwtService.verify.mockReturnValue({ sub: validUser.id });
    mockUserRepository.findOne.mockResolvedValue(validUser);
    mockUserRepository.save.mockResolvedValue(validUser);
     jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashedPassword');

    const result = await service.resetPassword({
      token: 'valid-token',
      newPassword: 'newpass123',
    });

    expect(result).toEqual({ message: 'Password successfully reset' });
    expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining({ password: 'hashedPassword' }));
  });

  it('should throw for invalid token (no user)', async () => {
    mockJwtService.verify.mockReturnValue({ sub: 999 }); // unknown user
    mockUserRepository.findOne.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: 'wrong', newPassword: 'newpass123' })
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw for expired token', async () => {
    const expiredUser = {
      ...baseUser,
      resetToken: 'expired-token',
      resetTokenExpiry: new Date(Date.now() - 10000),
    };

    mockJwtService.verify.mockReturnValue({ sub: expiredUser.id });
    mockUserRepository.findOne.mockResolvedValue(expiredUser);

    await expect(
      service.resetPassword({ token: 'expired-token', newPassword: 'newpass123' })
    ).rejects.toThrow(BadRequestException);
  });
});
