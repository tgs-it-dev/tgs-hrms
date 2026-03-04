import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Repository, Not, IsNull, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { EmailService } from '../../common/utils/email';
import { InviteStatusService } from '../invite-status/invite-status.service';
import { Employee } from 'src/entities/employee.entity';
import { SignupSession } from 'src/entities/signup-session.entity';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../common/constants/enums';
import { Role } from '../../entities/role.entity';
import { Tenant } from '../../entities/tenant.entity';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    private configService: ConfigService,
    private emailService: EmailService,
    private inviteStatusService: InviteStatusService
  ) { }

  /**
   * Normalizes and checks if a role name is system-admin.
   * This makes the check case-insensitive and resilient to minor formatting differences
   * between local and deployed databases (e.g. "System-Admin" vs "system-admin").
   */
  private isSystemAdminRole(roleName?: string | null): boolean {
    if (!roleName) {
      return false;
    }

    return roleName.trim().toLowerCase() === 'system-admin';
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      this.logger.log(`Loading permissions for user ${userId}`);

      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });

      if (!user || !user.role) {
        this.logger.warn(`User ${userId} has no role assigned`);
        return [];
      }

      const permissions = await this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.role', 'role')
        .leftJoin('role.rolePermissions', 'rp')
        .leftJoin('rp.permission', 'permission')
        .where('user.id = :userId', { userId: user.id })
        .select('permission.name', 'name')
        .getRawMany();

      const permissionNames = permissions
        .map((row: { name: string }) => row.name)
        .filter((name) => !!name)
        .map((name) => name.toLowerCase());

      this.logger.log(`Processed permissions for user ${userId}: ${JSON.stringify(permissionNames)}`);

      return permissionNames;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to load permissions for user ${userId}: ${errorMessage}`);
      if (errorStack) {
        this.logger.error(`Error stack: ${errorStack}`);
      }
      return [];
    }
  }

  private async getCompanyDetails(tenantId: string): Promise<{
    id: string;
    company_name: string;
    domain: string | null;
    logo_url: string | null;
    tenant_id: string | null;
    is_paid: boolean;
    plan_id: string | null;
    stripe_session_id: string | null;
    stripe_customer_id: string | null;
    stripe_payment_intent_id: string | null;
  } | null> {
    try {
      this.logger.log(`Loading company details for tenant: ${tenantId}`);

      const company = await this.companyDetailsRepository.findOne({
        where: { tenant_id: tenantId },
      });

      if (!company) {
        this.logger.warn(`Company details not found for tenant: ${tenantId}`);
        return null;
      }

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
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load company details for tenant ${tenantId}: ${errorMessage}`);
      return null;
    }
  }

  async register(dto: RegisterDto) {
    // Check if the role is system-admin to assign global tenant ID
    const role = await this.roleRepository.findOne({
      where: { id: dto.role_id },
    });

    // System-admin users always get the global system tenant ID
    const finalTenantId = role?.name === 'system-admin' ? GLOBAL_SYSTEM_TENANT_ID : dto.tenant_id;

    const existingUser = await this.userRepository.findOne({
      where: {
        email: dto.email.toLowerCase(),
        tenant_id: finalTenantId
      },
    });

    if (existingUser) {
      throw new BadRequestException({
        field: 'email',
        message: 'User with this email already exists in this organization',
      });
    }

    // Validation: Only one system admin is allowed in the entire HRMS
    if (role?.name === 'system-admin') {
      const existingSystemAdmin = await this.userRepository.findOne({
        where: {
          role_id: dto.role_id,
          tenant_id: GLOBAL_SYSTEM_TENANT_ID,
        },
      });

      if (existingSystemAdmin) {
        throw new BadRequestException(
          'Only one system admin is allowed in the entire HRMS. A system admin already exists.'
        );
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
      role_id: dto.role_id,
      tenant_id: finalTenantId,
    });

    await this.userRepository.save(user);
    return { message: 'User registered successfully' };
  }

  async validateToken(userId: string) {
    this.logger.log(`Validating token for user: ${userId}`);

    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });

      if (!user) {
        this.logger.warn(`Token validation failed: user not found for id: ${userId}`);
        throw new UnauthorizedException('User not found or has been deleted');
      }

      if (!user.role?.name) {
        this.logger.warn(`Token validation failed: user role missing for id: ${userId}`);
        throw new UnauthorizedException('User role not found');
      }

      // System-admin users always use the global system tenant ID
      const isSystemAdmin = this.isSystemAdminRole(user.role.name);
      const tenantId = isSystemAdmin ? GLOBAL_SYSTEM_TENANT_ID : user.tenant_id;

      // Check if tenant is deleted or suspended (for non-system-admin users)
      if (!isSystemAdmin && tenantId) {
        const tenant = await this.tenantRepository.findOne({
          where: { id: tenantId },
        });

        if (!tenant || tenant.deleted_at) {
          this.logger.warn(`Token validation failed: tenant is deleted for user: ${userId}`);
          throw new UnauthorizedException('Your organization account has been deleted. Please contact support.');
        }
        if (tenant.status === 'suspended') {
          this.logger.warn(`Token validation failed: tenant is suspended for user: ${userId}`);
          throw new UnauthorizedException('Your organization account has been suspended. Please contact support.');
        }
      }

      const permissions = await this.getUserPermissions(user.id);

      this.logger.log(`Token validation successful for user: ${user.email}`);

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role.name.toLowerCase(),
          tenant_id: tenantId,
          permissions,
        }
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Token validation error for user ${userId}: ${errorMessage}`);
      throw new UnauthorizedException('Token validation failed');
    }
  }





  async validateUser(email: string, password: string) {
    const normalizedEmail = email.toLowerCase();
    this.logger.log(`Login attempt for email: ${normalizedEmail}`);

    const users = await this.userRepository.find({
      where: { email: normalizedEmail },
      relations: ['role'],
    });

    if (!users || users.length === 0) {
      this.logger.warn(`Login failed: user not found for email: ${normalizedEmail}`);
      const sessionUser = await this.signupSessionRepository.findOne({ where: { email: normalizedEmail } });
      if (!sessionUser) {
        this.logger.warn(`Signup session not found for email: ${normalizedEmail}`);
        throw new BadRequestException({
          field: 'email',
          message: 'Email not found',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, sessionUser.password_hash);

      if (!isPasswordValid)
        throw new BadRequestException({
          field: 'password',
          message: 'Incorrect password',
        });

      return {
        signupSessionId: sessionUser.id,
        resumed: false,
        status: 'personal_completed',
        nextStep: 'company-details',
        companyDetailsCompleted: false,
        paymentCompleted: false,
        message: 'Personal details fetched successfully. Continue with company details.',
      };
    }

    let user: User | null = null;
    for (const u of users) {
      const isPasswordValid = await bcrypt.compare(password, u.password);
      if (isPasswordValid) {
        user = u;
        break;
      }
    }

    if (!user) {
      this.logger.warn(`Login failed: invalid password for email: ${normalizedEmail}`);
      throw new BadRequestException({
        field: 'password',
        message: 'Incorrect password',
      });
    }

    if (!user.role || !user.role.name) {
      this.logger.error(`User role missing for email: ${normalizedEmail}`);
      throw new UnauthorizedException('User role not found');
    }

    // System-admin users always use the global system tenant ID
    const isSystemAdmin = this.isSystemAdminRole(user.role.name);
    const tenantId = isSystemAdmin ? GLOBAL_SYSTEM_TENANT_ID : user.tenant_id;

    // Check if tenant is deleted or suspended (for non-system-admin users)
    if (!isSystemAdmin && tenantId) {
      const tenant = await this.tenantRepository.findOne({
        where: { id: tenantId },
      });

      if (!tenant || tenant.deleted_at) {
        this.logger.warn(`Login failed: tenant is deleted for email: ${normalizedEmail}`);
        throw new UnauthorizedException('Your organization account has been deleted. Please contact support.');
      }
      if (tenant.status === 'suspended') {
        this.logger.warn(`Login failed: tenant is suspended for email: ${normalizedEmail}`);
        throw new UnauthorizedException('Your organization account has been suspended. Please contact support.');
      }
    }

    const permissions = await this.getUserPermissions(user.id);

    const employee = await this.employeeRepository.findOne({ where: { user_id: user.id } });

    const companyDetails = await this.getCompanyDetails(tenantId);
    const requiresPayment = companyDetails ? !companyDetails.is_paid : false;

    this.logger.log(`User ${user.email} has role: ${user.role.name}`);
    this.logger.log(`User ${user.email} permissions: ${JSON.stringify(permissions)}`);

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.name.toLowerCase(),
      tenant_id: tenantId,
      permissions,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    this.logger.log(`JWT payload for user ${user.email}: ${JSON.stringify(payload)}`);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '7d',
    });

    user.refresh_token = refreshToken;


    if (!user.first_login_time) {
      user.first_login_time = new Date();
      this.logger.log(`First login recorded for user: ${normalizedEmail}`);


      await this.inviteStatusService.updateInviteStatusOnLogin(user.id);
    }

    await this.userRepository.save(user);

    // Find SignupSession by email to get session_id
    const signupSession = await this.signupSessionRepository.findOne({
      where: { email: normalizedEmail },
    });

    this.logger.log(`Login successful for email: ${normalizedEmail}`);
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
    // Sanitize email from logs
    const emailHash = this.sanitizeEmailForLogging(dto.email);
    this.logger.log(`Forgot password request for email: ${emailHash}`);

    const users = await this.userRepository.find({
      where: { email: dto.email.toLowerCase() },
    });

    if (!users || users.length === 0) {
      this.logger.warn(`Forgot password failed: user not found for email: ${emailHash}`);
      throw new BadRequestException('In Valid email address');
    }

    const resetToken = this.generateSecureToken();
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Update all users with this email
    for (const user of users) {
      await this.userRepository.update(user.id, {
        reset_token: hashedResetToken,
        reset_token_expiry: resetTokenExpiry,
      });
    }

    const firstUser = users[0];
    const userName = `${firstUser.first_name} ${firstUser.last_name}`;
    await this.emailService.sendPasswordResetEmail(firstUser.email, resetToken, userName);

    this.logger.log(`Password reset email sent to: ${emailHash}`);

    return {
      message: 'Check your email for the password reset link.',
    };
  }

  private generateSecureToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sanitize email for logging to prevent PII exposure
   * Shows only first 3 characters and domain
   */
  private sanitizeEmailForLogging(email: string): string {
    if (!email || !email.includes('@')) {
      return '***';
    }
    const parts = email.split('@');
    if (parts.length !== 2) {
      return '***';
    }
    const [localPart, domain] = parts;
    if (!localPart || localPart.length <= 3) {
      return '***@' + domain;
    }
    return localPart.substring(0, 3) + '***@' + domain;
  }

  async verifyResetToken(token: string) {
    if (!token) {
      return { valid: false, message: 'Token is required' };
    }

    // Find all users with non-expired reset tokens and verify the token
    const users = await this.userRepository.find({
      where: {
        reset_token: Not(IsNull()),
        reset_token_expiry: MoreThan(new Date()),
      },
    });

    // Verify token against hashed tokens
    for (const user of users) {
      if (user.reset_token && await bcrypt.compare(token, user.reset_token)) {
        return { valid: true, message: 'Token is valid' };
      }
    }

    return { valid: false, message: 'Invalid or expired reset token' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    this.logger.log(`Reset password attempt with token (sanitized)`);

    // Find all users with non-expired reset tokens and verify the token
    const users = await this.userRepository.find({
      where: {
        reset_token: Not(IsNull()),
        reset_token_expiry: MoreThan(new Date()),
      },
    });

    const matchingUsers: User[] = [];
    // Verify token against hashed tokens
    for (const u of users) {
      if (u.reset_token && await bcrypt.compare(dto.token, u.reset_token)) {
        matchingUsers.push(u);
      }
    }

    if (matchingUsers.length === 0) {
      this.logger.warn(`Reset password failed: invalid or expired token`);
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    for (const user of matchingUsers) {
      await this.userRepository.update(user.id, {
        password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      });
    }

    const firstUser = matchingUsers[0];
    const userName = `${firstUser.first_name} ${firstUser.last_name}`;
    const emailHash = this.sanitizeEmailForLogging(firstUser.email);
    await this.emailService.sendPasswordResetSuccessEmail(firstUser.email, userName);

    this.logger.log(`Password reset successful for user: ${emailHash}`);

    return { message: 'Password reset successfully' };
  }



  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['role'],
      });

      if (!user) {
        this.logger.warn(`Refresh token failed: user not found for id: ${payload.sub}`);
        throw new UnauthorizedException('User not found or has been deleted');
      }

      if (!user.role?.name) {
        this.logger.warn(`Refresh token failed: user role missing for id: ${payload.sub}`);
        throw new UnauthorizedException('User role not found');
      }

      // System-admin users always use the global system tenant ID
      const isSystemAdmin = this.isSystemAdminRole(user.role.name);
      const tenantId = isSystemAdmin ? GLOBAL_SYSTEM_TENANT_ID : user.tenant_id;

      // Check if tenant is deleted or suspended (for non-system-admin users)
      if (!isSystemAdmin && tenantId) {
        const tenant = await this.tenantRepository.findOne({
          where: { id: tenantId },
        });

        if (!tenant || tenant.deleted_at) {
          this.logger.warn(`Refresh token failed: tenant is deleted for user: ${user.email}`);
          throw new UnauthorizedException('Your organization account has been deleted. Please contact support.');
        }
        if (tenant.status === 'suspended') {
          this.logger.warn(`Refresh token failed: tenant is suspended for user: ${user.email}`);
          throw new UnauthorizedException('Your organization account has been suspended. Please contact support.');
        }
      }

      if (user.refresh_token !== refreshToken) {
        this.logger.warn(`Refresh token failed: token mismatch for user: ${user.email}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const permissions = await this.getUserPermissions(user.id);

      this.logger.log(`Refresh: User ${user.email} has role: ${user.role.name}`);
      this.logger.log(`Refresh: User ${user.email} permissions: ${JSON.stringify(permissions)}`);

      const newPayload = {
        email: user.email,
        sub: user.id,
        role: user.role.name.toLowerCase(),
        tenant_id: tenantId,
        permissions,
        first_name: user.first_name,
        last_name: user.last_name,
      };

      this.logger.log(`Refresh: JWT payload for user ${user.email}: ${JSON.stringify(newPayload)}`);

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
      });

      this.logger.log(`Access token refreshed successfully for user: ${user.email}`);
      return { accessToken: newAccessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Refresh token failed: ${errorMessage}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.userRepository.update(user.id, {
        refresh_token: null,
      });

      this.logger.log(`User logged out successfully: ${user.email}`);
      return { message: 'Successfully logged out' };
    } catch (error) {
      this.logger.warn(`Logout failed: invalid refresh token`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async deleteUser(userId: string) {
    this.logger.log(`Deleting user: ${userId}`);

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }


    await this.userRepository.update(userId, {
      refresh_token: null,
    });


    await this.userRepository.delete(userId);

    this.logger.log(`User deleted successfully: ${user.email}`);
    return { message: 'User deleted successfully' };
  }




}