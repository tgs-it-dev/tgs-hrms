import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Repository, Not, IsNull, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { JwtHelperService } from '../../common/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailTemplateService } from '../../common/utils/email';
import { InviteStatusService } from '../invite-status/invite-status.service';
import { Employee } from 'src/entities/employee.entity';
import { SignupSession } from 'src/entities/signup-session.entity';
import {
  AUTH_MESSAGES,
  BCRYPT_SALT_ROUNDS,
  DEFAULT_JWT_REFRESH_EXPIRES_IN,
  EMAIL_SUBJECT_PASSWORD_RESET,
  EMAIL_SUBJECT_PASSWORD_RESET_SUCCESS,
  GLOBAL_SYSTEM_TENANT_ID,
  RESET_TOKEN_BYTES,
  RESET_TOKEN_EXPIRY_MS,
  UserRole,
} from '../../common/constants';
import { Role } from '../../entities/role.entity';
import { Tenant } from '../../entities/tenant.entity';
import { ValidatedUser, LoginResponse, RegisterResponse, JwtPayload, TokenPair, CompanyInfo } from './interfaces';
import { TokenValidationService } from '../../common/services/token-validation.service';
import { ContextLogger, LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class AuthService {
  private readonly logger: ContextLogger;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CompanyDetails)
    private companyDetailsRepository: Repository<CompanyDetails>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(SignupSession)
    private signupSessionRepository: Repository<SignupSession>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private jwtService: JwtService,
    private jwtHelper: JwtHelperService,
    private configService: ConfigService,
    private emailService: EmailService,
    private emailTemplateService: EmailTemplateService,
    private inviteStatusService: InviteStatusService,
    private tokenValidationService: TokenValidationService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.forChild(AuthService.name);
  }

  /**
   * Normalizes and checks if a role name is system-admin.
   */
  private isSystemAdminRole(roleName?: string | null): boolean {
    if (!roleName) return false;
    const normalized = roleName.trim().toLowerCase() as UserRole;
    return normalized === UserRole.SYSTEM_ADMIN;
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });
      if (!user || !user.role) return [];
      const permissions = await this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.role', 'role')
        .leftJoin('role.rolePermissions', 'rp')
        .leftJoin('rp.permission', 'permission')
        .where('user.id = :userId', { userId: user.id })
        .select('permission.name', 'name')
        .getRawMany();
      return permissions
        .map((row: { name: string }) => row.name)
        .filter((name) => !!name)
        .map((name) => name.toLowerCase());
    } catch {
      return [];
    }
  }

  private async getCompanyDetails(tenantId: string): Promise<CompanyInfo | null> {
    try {
      const company = await this.companyDetailsRepository.findOne({
        where: { tenant_id: tenantId },
      });
      if (!company) return null;
      return {
        id: company.id,
        company_name: company.company_name,
        domain: company.domain,
        logo_url: company.logo_url,
        tenant_id: company.tenant_id,
        is_paid: !!company.is_paid,
        plan_id: company.plan_id ?? null,
        stripe_session_id: company.stripe_session_id ?? null,
        stripe_customer_id: company.stripe_customer_id ?? null,
        stripe_payment_intent_id: company.stripe_payment_intent_id ?? null,
      } as CompanyInfo;
    } catch {
      return null;
    }
  }

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const role = await this.roleRepository.findOne({
      where: { id: dto.role_id },
    });
    const finalTenantId = role?.name === UserRole.SYSTEM_ADMIN ? GLOBAL_SYSTEM_TENANT_ID : dto.tenant_id;
    const normalizedEmail = dto.email.toLowerCase();
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new BadRequestException({
        field: 'email',
        message: AUTH_MESSAGES.USER_EMAIL_EXISTS,
      });
    }
    if (role?.name === UserRole.SYSTEM_ADMIN) {
      const existingSystemAdmin = await this.userRepository.findOne({
        where: {
          role_id: dto.role_id,
          tenant_id: GLOBAL_SYSTEM_TENANT_ID,
        },
      });
      if (existingSystemAdmin) {
        throw new BadRequestException(AUTH_MESSAGES.ONLY_ONE_SYSTEM_ADMIN);
      }
    }
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = this.userRepository.create({
      email: normalizedEmail,
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
      role_id: dto.role_id,
      tenant_id: finalTenantId,
    });
    await this.userRepository.save(user);
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      message: AUTH_MESSAGES.USER_REGISTERED,
    };
  }

  async validateUser(userId: string): Promise<ValidatedUser> {
    return this.tokenValidationService.validateUser(userId);
  }

  async validateUserForLogin(email: string, password: string): Promise<LoginResponse> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      relations: ['role'],
    });
    if (!user) {
      throw new BadRequestException({
        field: 'email',
        message: AUTH_MESSAGES.EMAIL_NOT_FOUND,
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException({
        field: 'password',
        message: AUTH_MESSAGES.INCORRECT_PASSWORD,
      });
    }
    if (!user.role || !user.role.name) {
      throw new UnauthorizedException(AUTH_MESSAGES.USER_ROLE_NOT_FOUND);
    }
    const isSystemAdmin = this.isSystemAdminRole(user.role.name);
    const tenantId = isSystemAdmin ? GLOBAL_SYSTEM_TENANT_ID : user.tenant_id;
    if (!isSystemAdmin && tenantId) {
      const tenant = await this.tenantRepository.findOne({
        where: { id: tenantId },
      });
      if (!tenant || tenant.deleted_at) {
        throw new UnauthorizedException(AUTH_MESSAGES.ORG_ACCOUNT_DELETED);
      }
    }
    const permissions = await this.getUserPermissions(user.id);
    const employee = await this.employeeRepository.findOne({ where: { user_id: user.id } });
    const companyDetails = await this.getCompanyDetails(tenantId);
    const requiresPayment = companyDetails ? !companyDetails.is_paid : false;
    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      sub: user.id,
      role: user.role.name.toLowerCase(),
      tenant_id: tenantId,
      permissions,
      first_name: user.first_name,
      last_name: user.last_name,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: DEFAULT_JWT_REFRESH_EXPIRES_IN,
    });
    user.refresh_token = refreshToken;
    if (!user.first_login_time) {
      user.first_login_time = new Date();
      await this.inviteStatusService.updateInviteStatusOnLogin(user.id);
    }
    await this.userRepository.save(user);
    const signupSession = await this.signupSessionRepository.findOne({
      where: { email: normalizedEmail },
    });
    return {
      accessToken,
      refreshToken,
      user,
      permissions,
      employee: employee,
      company: companyDetails,
      requiresPayment,
      session_id: signupSession?.id || null,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new BadRequestException(AUTH_MESSAGES.INVALID_EMAIL_ADDRESS);
    }
    const resetToken = this.generateSecureToken();
    const hashedResetToken = await bcrypt.hash(resetToken, BCRYPT_SALT_ROUNDS);
    const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await this.userRepository.update(user.id, {
      reset_token: hashedResetToken,
      reset_token_expiry: resetTokenExpiry,
    });
    const userName = `${user.first_name} ${user.last_name}`;
    await this.sendPasswordResetEmail(user.email, resetToken, userName);
    return { message: AUTH_MESSAGES.CHECK_EMAIL_RESET_LINK };
  }

  private async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<void> {
    const from = this.emailService.getFromEmail();
    if (!from) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping password reset email.');
      return;
    }
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? '';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const html = this.emailTemplateService.render('password-reset', { userName, resetUrl });
    this.emailService.send({ to: email, from, subject: EMAIL_SUBJECT_PASSWORD_RESET, html });
  }

  private async sendPasswordResetSuccessEmail(email: string, userName: string): Promise<void> {
    const from = this.emailService.getFromEmail();
    if (!from) {
      this.logger.warn('SENDGRID_FROM not configured. Skipping password reset success email.');
      return;
    }
    const html = this.emailTemplateService.render('password-reset-success', { userName });
    this.emailService.send({ to: email, from, subject: EMAIL_SUBJECT_PASSWORD_RESET_SUCCESS, html });
  }

  private generateSecureToken(): string {
    return randomBytes(RESET_TOKEN_BYTES).toString('hex');
  }

  async verifyResetToken(token: string): Promise<{ valid: boolean; message: string }> {
    if (!token) {
      return { valid: false, message: AUTH_MESSAGES.TOKEN_REQUIRED };
    }
    const user = await this.userRepository.findOne({
      where: {
        reset_token: Not(IsNull()),
        reset_token_expiry: MoreThan(new Date()),
      },
    });
    if (!user?.reset_token) {
      return { valid: false, message: AUTH_MESSAGES.INVALID_OR_EXPIRED_RESET_TOKEN };
    }
    const valid = await bcrypt.compare(token, user.reset_token);
    return { valid, message: valid ? AUTH_MESSAGES.TOKEN_VALID : AUTH_MESSAGES.INVALID_OR_EXPIRED_RESET_TOKEN };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: {
        reset_token: Not(IsNull()),
        reset_token_expiry: MoreThan(new Date()),
      },
    });
    if (!user?.reset_token || !bcrypt.compareSync(dto.token, user.reset_token)) {
      throw new BadRequestException(AUTH_MESSAGES.INVALID_OR_EXPIRED_RESET_TOKEN);
    }
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    await this.userRepository.update(user.id, {
      password: hashedPassword,
      reset_token: null,
      reset_token_expiry: null,
    });
    const userName = `${user.first_name} ${user.last_name}`;
    await this.sendPasswordResetSuccessEmail(user.email, userName);
    return { message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken) {
      throw new BadRequestException(AUTH_MESSAGES.REFRESH_TOKEN_REQUIRED);
    }
    try {
      const payload = this.jwtHelper.verifyToken<JwtPayload>(refreshToken);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['role'],
      });
      if (!user) throw new UnauthorizedException(AUTH_MESSAGES.USER_NOT_FOUND_OR_DELETED);
      if (!user.role?.name) throw new UnauthorizedException(AUTH_MESSAGES.USER_ROLE_NOT_FOUND);
      const isSystemAdmin = this.isSystemAdminRole(user.role.name);
      const tenantId = isSystemAdmin ? GLOBAL_SYSTEM_TENANT_ID : user.tenant_id;
      if (!isSystemAdmin && tenantId) {
        const tenant = await this.tenantRepository.findOne({
          where: { id: tenantId },
        });
        if (!tenant || tenant.deleted_at) {
          throw new UnauthorizedException(AUTH_MESSAGES.ORG_ACCOUNT_DELETED);
        }
      }
      if (user.refresh_token !== refreshToken) {
        throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
      }
      const permissions = await this.getUserPermissions(user.id);
      const newPayload: JwtPayload = {
        id: user.id,
        email: user.email,
        sub: user.id,
        role: user.role.name.toLowerCase(),
        tenant_id: tenantId,
        permissions,
        first_name: user.first_name,
        last_name: user.last_name,
      };
      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
      });
      return { accessToken: newAccessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) throw error;
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    }
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    if (!refreshToken) {
      throw new BadRequestException(AUTH_MESSAGES.REFRESH_TOKEN_REQUIRED);
    }
    try {
      const payload = this.jwtHelper.verifyToken<JwtPayload>(refreshToken);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
      await this.userRepository.update(user.id, { refresh_token: null });
      return { message: AUTH_MESSAGES.SUCCESSFULLY_LOGGED_OUT };
    } catch {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    }
  }

  async deleteUser(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException(AUTH_MESSAGES.USER_NOT_FOUND);
    await this.userRepository.update(userId, { refresh_token: null });
    await this.userRepository.delete(userId);
    return { message: AUTH_MESSAGES.USER_DELETED };
  }
}
