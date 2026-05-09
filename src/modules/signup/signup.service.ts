import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignupSession } from '../../entities/signup-session.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { CompanyDetailsDto } from './dto/company-details.dto';
import { PaymentDto } from './dto/payment.dto';
import { CompleteSignupDto } from './dto/complete-signup.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import axios from 'axios';
import {
  GoogleSignupInitDto,
  GoogleSignupInitResponse,
} from './dto/google-signup-init.dto';
import { JwtService } from '@nestjs/jwt';
import { S3StorageService } from '../storage';
import * as fs from 'fs';
import * as path from 'path';
import { TenantSchemaProvisioningService } from '../tenant/services/tenant-schema-provisioning.service';
import { SubscriptionPaymentService } from '../payment/services/subscription-payment.service';

const PREFIX_COMPANY_LOGOS = 'company-logos';

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    @InjectRepository(SignupSession)
    private readonly signupSessionRepo: Repository<SignupSession>,
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly s3: S3StorageService,
    private readonly tenantSchemaProvisioning: TenantSchemaProvisioningService,
    private readonly subscriptionPaymentService: SubscriptionPaymentService,
  ) {}

  async savePersonalDetails(dto: PersonalDetailsDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const existingUser = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new BadRequestException({
        field: 'email',
        message: 'User with this email already exists',
      });
    }

    const existingSession = await this.signupSessionRepo.findOne({
      where: { email: normalizedEmail },
      order: { created_at: 'DESC' as const },
    });

    if (existingSession && existingSession.status !== 'completed') {
      const { nextStep, companyDetailsCompleted, paymentCompleted } =
        await this.computeNextStep(existingSession.id);
      const message =
        nextStep === 'company-details'
          ? 'Signup already completed. Please re-login'
          : nextStep === 'payment'
            ? 'Personal and company details already completed. Continue with payment.'
            : nextStep === 'complete'
              ? 'Payment completed. Finalize your signup.'
              : 'Signup already completed.';
      throw new BadRequestException({
        code: 'SIGNUP_ALREADY_STARTED',
        message,
        status: existingSession.status,
        nextStep,
        companyDetailsCompleted,
        paymentCompleted,
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const session = this.signupSessionRepo.create({
      email: normalizedEmail,
      password_hash: passwordHash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
      status: 'personal_completed',
    });
    const saved = await this.signupSessionRepo.save(session);
    return {
      signupSessionId: saved.id,
      resumed: false,
      status: 'personal_completed',
      nextStep: 'company-details',
      companyDetailsCompleted: false,
      paymentCompleted: false,
      message: 'Personal details saved successfully. Continue with company details.',
    };
  }

  async googleSignupInit(
    dto: GoogleSignupInitDto,
  ): Promise<GoogleSignupInitResponse | Record<string, unknown>> {
    let payload: Record<string, string>;
    try {
      const resp = await axios.get<Record<string, string>>(
        'https://oauth2.googleapis.com/tokeninfo',
        { params: { id_token: dto.idToken } },
      );
      payload = resp.data;
    } catch {
      throw new BadRequestException('Invalid Google ID token');
    }

    const email = String(payload['email'] || '').toLowerCase();
    const givenName = String(payload['given_name'] || '').trim();
    const familyName = String(payload['family_name'] || '').trim();
    const name = String(payload['name'] || '').trim();

    const firstName = givenName || (name ? name.split(' ')[0] : '');
    const lastName = familyName || (name ? name.split(' ').slice(1).join(' ') : '');

    const existingUser = await this.userRepo.findOne({
      where: { email },
      relations: ['role'],
    });
    if (existingUser) {
      if (!existingUser.role?.name) {
        throw new BadRequestException('User role not found for existing user');
      }

      const permissions: Array<{ name: string }> = await this.userRepo.query(
        `SELECT p.name FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = $1`,
        [existingUser.role.id],
      );
      const perms = permissions.map((row) => row.name.toLowerCase());

      const tokenPayload = {
        email: existingUser.email,
        sub: existingUser.id,
        role: existingUser.role.name.toLowerCase(),
        tenant_id: existingUser.tenant_id,
        permissions: perms,
      };

      const accessToken = this.jwtService.sign(tokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
      });
      const refreshToken = this.jwtService.sign(tokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '7d',
      });

      return { alreadyRegistered: true, accessToken, refreshToken, user: existingUser, permissions: perms };
    }

    const session = this.signupSessionRepo.create({
      email,
      password_hash: '',
      first_name: firstName,
      last_name: lastName,
      phone: '',
      status: 'personal_completed',
    });
    const saved = await this.signupSessionRepo.save(session);

    const domain = email.includes('@') ? email.split('@')[1] : '';
    const companyName = (() => {
      if (!domain) return '';
      const parts = domain.split('.');
      const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      if (!base) return '';
      return base.charAt(0).toUpperCase() + base.slice(1);
    })();

    const signupPayload = {
      sub: saved.id,
      email,
      first_name: firstName,
      last_name: lastName,
      flow: 'signup',
      stage: 'personal_completed',
    } as const;

    const signupToken = this.jwtService.sign(signupPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '30m',
    });

    return {
      signupSessionId: saved.id,
      email,
      first_name: firstName,
      last_name: lastName,
      signupToken,
      suggested: { companyName, domain },
      companyDetailsCompleted: false,
    };
  }

  async saveCompanyDetails(dto: CompanyDetailsDto) {
    const session = await this.signupSessionRepo.findOne({
      where: { id: dto.signupSessionId },
    });
    if (!session) throw new NotFoundException('Signup session not found');

    const domainNormalized = (dto.domain || '').trim().toLowerCase();
    if (!domainNormalized) {
      throw new BadRequestException('Domain cannot be empty');
    }

    let details = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: session.id },
    });
    const existingByDomain = await this.companyDetailsRepo
      .createQueryBuilder('cd')
      .where('LOWER(cd.domain) = :domain', { domain: domainNormalized })
      .andWhere(
        '(cd.signup_session_id IS NULL OR cd.signup_session_id != :sessionId)',
        { sessionId: session.id },
      )
      .getOne();
    if (existingByDomain) {
      throw new ConflictException('Domain already exists.');
    }

    if (details) {
      details.company_name = dto.companyName;
      details.domain = domainNormalized;
      details.plan_id = dto.planId;
    } else {
      details = this.companyDetailsRepo.create({
        company_name: dto.companyName,
        domain: domainNormalized,
        plan_id: dto.planId,
        signup_session_id: session.id,
        is_paid: false,
      });
    }
    await this.companyDetailsRepo.save(details);
    session.status = 'company_completed';
    await this.signupSessionRepo.save(session);
    const message = details.is_paid
      ? 'Company details saved. Payment already completed. Proceed to finalize signup.'
      : 'Company details saved successfully. Continue with payment.';
    return {
      signupSessionId: session.id,
      status: 'company_completed',
      nextStep: details.is_paid ? 'complete' : 'payment',
      companyDetailsCompleted: true,
      paymentCompleted: !!details.is_paid,
      message,
    };
  }

  async saveCompanyLogo(signupSessionId: string, file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const session = await this.signupSessionRepo.findOne({
      where: { id: signupSessionId },
    });
    if (!session) throw new NotFoundException('Signup session not found');
    const details = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: session.id },
    });
    if (!details) throw new NotFoundException('Company details not found');

    const ext = path.extname(file.originalname || '') || '.png';
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const key = `${PREFIX_COMPANY_LOGOS}/signup/${signupSessionId}/${fileName}`;

    let logoUrl: string;
    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      logoUrl = result.url;
    } else {
      const uploadDir = path.join(
        process.cwd(),
        'public',
        PREFIX_COMPANY_LOGOS,
        'signup',
        signupSessionId,
      );
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
      logoUrl = `/${PREFIX_COMPANY_LOGOS}/signup/${signupSessionId}/${fileName}`;
    }

    details.logo_url = logoUrl;
    await this.companyDetailsRepo.save(details);
    return { logoUrl, signupSessionId };
  }

  /**
   * Initiates a PayPal subscription for the signup session.
   * Returns the PayPal approval URL that the frontend must redirect to.
   *
   * Falls back gracefully when PAYPAL_CLIENT_ID/SECRET are not configured
   * (e.g. local dev without a PayPal account).
   */
  async startPayment(dto: PaymentDto) {
    const session = await this.signupSessionRepo.findOne({
      where: { id: dto.signupSessionId },
    });
    if (!session) throw new NotFoundException('Signup session not found');

    const company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: session.id },
    });
    if (!company) throw new BadRequestException('Company details not found');

    if (!this.subscriptionPaymentService.isPayPalConfigured) {
      this.logger.warn('PayPal not configured. Returning mock approval URL for development.');
      return {
        provider: 'paypal',
        subscriptionId: 'mock_subscription_id',
        approvalUrl: 'https://example.com/mock-paypal-approval',
        checkoutSessionId: 'mock_subscription_id',
        url: 'https://example.com/mock-paypal-approval',
      };
    }

    const { subscriptionId, approvalUrl } =
      await this.subscriptionPaymentService.createSignupSubscription(
        session.id,
        session.email,
        session.first_name,
        session.last_name,
      );

    return {
      provider: 'paypal',
      subscriptionId,
      approvalUrl,
      // Legacy aliases so existing frontend integrations still work
      checkoutSessionId: subscriptionId,
      url: approvalUrl,
    };
  }

  /**
   * Verifies payment status after the user returns from PayPal.
   *
   * Accepts the PayPal subscription ID either from the request body
   * (field: subscriptionId or checkoutSessionId) or from the stored
   * company record.
   */
  async markPaymentSuccess(
    signupSessionId: string,
    paypalSubscriptionId?: string,
  ) {
    const session = await this.signupSessionRepo.findOne({
      where: { id: signupSessionId },
    });
    if (!session) throw new NotFoundException('Signup session not found');

    const company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: session.id },
    });
    if (!company) throw new BadRequestException('Company details not found');

    const subId = paypalSubscriptionId || company.paypal_subscription_id;

    if (!subId || !this.subscriptionPaymentService.isPayPalConfigured) {
      // Fallback: mark as paid without PayPal verification (dev / no-config mode)
      this.logger.warn(
        'Marking payment as success without PayPal verification (fallback mode).',
      );
      company.is_paid = true;
      await this.companyDetailsRepo.save(company);
      session.status = 'payment_completed';
      await this.signupSessionRepo.save(session);
      return this.buildPaymentSuccessResponse(company, true, 'ACTIVE', subId ?? 'N/A');
    }

    const { isPaid, status } =
      await this.subscriptionPaymentService.verifyAndActivateSubscription(
        signupSessionId,
        subId,
      );

    if (isPaid) {
      session.status = 'payment_completed';
      await this.signupSessionRepo.save(session);
    }

    return this.buildPaymentSuccessResponse(company, isPaid, status, subId);
  }

  async completeSignup(dto: CompleteSignupDto) {
    const session = await this.signupSessionRepo.findOne({
      where: { id: dto.signupSessionId },
    });
    if (!session) throw new NotFoundException('Signup session not found');

    if (session.status === 'completed') {
      const company = await this.companyDetailsRepo.findOne({
        where: { signup_session_id: session.id },
      });
      if (!company || !company.tenant_id) {
        throw new BadRequestException('Signup completed but tenant not found');
      }

      const user = await this.userRepo.findOne({
        where: { email: session.email.toLowerCase() },
        relations: ['role'],
      });
      if (!user) {
        throw new BadRequestException('Signup completed but user not found');
      }

      const adminRole = user.role;
      if (!adminRole) throw new Error('User role not found.');

      const permissionsRows: Array<{ name: string }> = await this.userRepo.query(
        `SELECT p.name FROM permissions p INNER JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = $1`,
        [adminRole.id],
      );
      const permissions = permissionsRows.map((row) => String(row.name).toLowerCase());

      const tokenPayload = {
        sub: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: adminRole.name.toLowerCase(),
        tenant_id: user.tenant_id,
        permissions,
      } as const;

      const accessToken = this.jwtService.sign(tokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
      });
      const refreshToken = this.jwtService.sign(tokenPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '7d',
      });

      return { success: true, tenantId: company.tenant_id, accessToken, refreshToken, user, permissions, message: 'Signup already completed.' };
    }

    const company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: session.id },
    });
    if (!company) throw new BadRequestException('Company details not found');
    if (!company.is_paid) throw new BadRequestException('Payment not completed');

    let tenant = company.tenant_id
      ? await this.tenantRepo.findOne({ where: { id: company.tenant_id } })
      : null;

    if (!tenant) {
      tenant = await this.tenantRepo.save(
        this.tenantRepo.create({ name: company.company_name }),
      );
      company.tenant_id = tenant.id as unknown as string;
      await this.companyDetailsRepo.save(company);
    }

    if (!tenant.schema_provisioned) {
      try {
        await this.tenantSchemaProvisioning.provisionTenantSchema(tenant.id);
        tenant.schema_provisioned = true;
        await this.tenantRepo.save(tenant);
        this.logger.log(`Schema provisioned for tenant ${tenant.id}`);
      } catch (err) {
        this.logger.error(
          `Schema provisioning failed for tenant ${tenant.id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    const roles = await this.ensureDefaultRoles();
    const adminRole = roles.find((r) => r.name === 'Admin');
    if (!adminRole) {
      throw new Error("'Admin' role not found. Please seed the roles table.");
    }

    let user = await this.userRepo.findOne({
      where: { email: session.email.toLowerCase() },
    });

    if (!user) {
      user = this.userRepo.create({
        email: session.email,
        password: session.password_hash,
        first_name: session.first_name,
        last_name: session.last_name,
        phone: session.phone,
        tenant_id: tenant.id,
        role_id: adminRole.id,
      });
      await this.userRepo.save(user);
    }

    session.status = 'completed';
    await this.signupSessionRepo.save(session);

    // Register the PayPal subscription record under the now-known tenant_id.
    // company.tenant_id is set at this point so upsert will succeed.
    await this.subscriptionPaymentService.registerSubscriptionForNewTenant(company);

    const permissionsRows: Array<{ name: string }> = await this.userRepo.query(
      `SELECT p.name FROM permissions p INNER JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = $1`,
      [adminRole.id],
    );
    const permissions = permissionsRows.map((row) => String(row.name).toLowerCase());

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: adminRole.name.toLowerCase(),
      tenant_id: user.tenant_id,
      permissions,
    } as const;

    const accessToken = this.jwtService.sign(tokenPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
    });
    const refreshToken = this.jwtService.sign(tokenPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '7d',
    });

    return {
      success: true,
      tenantId: tenant.id,
      accessToken,
      refreshToken,
      user,
      permissions,
      message: 'Signup completed successfully.',
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildPaymentSuccessResponse(
    _company: CompanyDetails,
    isPaid: boolean,
    status: string,
    subscriptionId: string,
  ) {
    return {
      ok: true,
      isPaid,
      provider: 'paypal',
      paypalSubscriptionId: subscriptionId,
      status: isPaid ? 'succeeded' : 'failed',
      transactionId: subscriptionId,
      nextStep: isPaid ? 'complete' : 'payment',
      message: isPaid
        ? 'Payment verified successfully. Proceed to finalize your signup.'
        : `Payment not verified. PayPal subscription status: ${status}. Please try again.`,
    };
  }

  private async ensureDefaultRoles(): Promise<Role[]> {
    const roleNames = ['Admin', 'Employee', 'Manager', 'User', 'System-Admin'];
    const roles: Role[] = [];
    for (const name of roleNames) {
      const role = await this.roleRepo.findOne({ where: { name } });
      if (role) roles.push(role);
    }
    return roles;
  }

  private async computeNextStep(signupSessionId: string): Promise<{
    nextStep: 'company-details' | 'payment' | 'complete' | 'done';
    companyDetailsCompleted: boolean;
    paymentCompleted: boolean;
  }> {
    const session = await this.signupSessionRepo.findOne({
      where: { id: signupSessionId },
    });
    if (!session) throw new NotFoundException('Signup session not found');
    if (session.status === 'completed') {
      return { nextStep: 'done', companyDetailsCompleted: true, paymentCompleted: true };
    }
    const company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: signupSessionId },
    });
    const companyDetailsCompleted = !!company;
    const paymentCompleted = !!company?.is_paid;
    if (!companyDetailsCompleted) return { nextStep: 'company-details', companyDetailsCompleted, paymentCompleted };
    if (!paymentCompleted) return { nextStep: 'payment', companyDetailsCompleted, paymentCompleted };
    return { nextStep: 'complete', companyDetailsCompleted, paymentCompleted };
  }
}
