import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignupSession } from '../../entities/signup-session.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { CompanyDetailsDto } from './dto/company-details.dto';
import { PaymentDto } from './dto/payment.dto';
import { CompleteSignupDto } from './dto/complete-signup.dto';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);
  private readonly stripe: Stripe;

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
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    private readonly configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');
this.stripe = new Stripe(stripeKey);

  }

  async savePersonalDetails(dto: PersonalDetailsDto) {
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existingUser) {
      throw new BadRequestException({ field: 'email', message: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const session = this.signupSessionRepo.create({
      email: dto.email.toLowerCase(),
      password_hash: passwordHash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
      status: 'personal_completed',
    });
    const saved = await this.signupSessionRepo.save(session);
    return { signupSessionId: saved.id };
  }

  async saveCompanyDetails(dto: CompanyDetailsDto) {
    const session = await this.signupSessionRepo.findOne({ where: { id: dto.signupSessionId } });
    if (!session) throw new NotFoundException('Signup session not found');

    const details = this.companyDetailsRepo.create({
      company_name: dto.companyName,
      domain: dto.domain,
      plan_id: dto.planId,
      seats: dto.seats,
      signup_session_id: session.id,
      is_paid: false,
    });
    await this.companyDetailsRepo.save(details);
    session.status = 'company_completed';
    await this.signupSessionRepo.save(session);
    return { signupSessionId: session.id };
  }

  async startPayment(dto: PaymentDto) {
    const session = await this.signupSessionRepo.findOne({ where: { id: dto.signupSessionId }, relations: ['companyDetails'] });
    if (!session) throw new NotFoundException('Signup session not found');
    const company = await this.companyDetailsRepo.findOne({ where: { signup_session_id: session.id } });
    if (!company) throw new BadRequestException('Company details not found');

    const plan = await this.planRepo.findOne({ where: { id: company.plan_id } });
    if (!plan) throw new BadRequestException('Invalid planId');
    const priceId = (plan.stripePriceId || '').trim();
    if (!priceId || !priceId.startsWith('price_')) {
      throw new BadRequestException(
        'Invalid stripePriceId configured for plan. Expected a Stripe Price ID starting with "price_". Update the plan to use a valid recurring Price from your Stripe Dashboard.'
      );
    }

    if (dto.mode === 'checkout') {
      const checkout = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: this.configService.get<string>('STRIPE_SUCCESS_URL') || 'https://example.com/success',
        cancel_url: this.configService.get<string>('STRIPE_CANCEL_URL') || 'https://example.com/cancel',
        line_items: [
          { price: priceId, quantity: company.seats ?? 1 },
        ],
        metadata: { signupSessionId: session.id, planId: plan.id },
      });
      company.stripe_session_id = checkout.id;
      await this.companyDetailsRepo.save(company);
      return { checkoutSessionId: checkout.id, url: checkout.url };
    }

    // Alternative: create a subscription directly without checkout
    const customer = await this.stripe.customers.create({
      email: session.email,
      name: `${session.first_name} ${session.last_name}`.trim(),
      metadata: { signupSessionId: session.id },
    });
    const sub = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId, quantity: company.seats ?? 1 }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: { signupSessionId: session.id, planId: plan.id },
    });
    company.stripe_customer_id = customer.id;
    await this.companyDetailsRepo.save(company);
    return { subscriptionId: sub.id, status: sub.status };
  }

  async markPaymentSuccess(signupSessionId: string) {
    const session = await this.signupSessionRepo.findOne({ where: { id: signupSessionId } });
    if (!session) throw new NotFoundException('Signup session not found');
    const company = await this.companyDetailsRepo.findOne({ where: { signup_session_id: session.id } });
    if (!company) throw new BadRequestException('Company details not found');
    company.is_paid = true;
    await this.companyDetailsRepo.save(company);
    session.status = 'payment_completed';
    await this.signupSessionRepo.save(session);
    return { ok: true };
  }

  async completeSignup(dto: CompleteSignupDto) {
    const session = await this.signupSessionRepo.findOne({ where: { id: dto.signupSessionId } });
    if (!session) throw new NotFoundException('Signup session not found');
    const company = await this.companyDetailsRepo.findOne({ where: { signup_session_id: session.id } });
    if (!company) throw new BadRequestException('Company details not found');
    if (!company.is_paid) throw new BadRequestException('Payment not completed');

    const tenant = await this.tenantRepo.save(this.tenantRepo.create({ name: company.company_name }));

    const roles = await this.ensureDefaultRoles(tenant.id);
    const adminRole = roles.find((r) => r.name.toLowerCase() === 'admin')!;

    const user = this.userRepo.create({
      email: session.email,
      password: session.password_hash,
      first_name: session.first_name,
      last_name: session.last_name,
      phone: session.phone,
      tenant_id: tenant.id,
      role_id: adminRole.id,
    });
    await this.userRepo.save(user);

    session.status = 'completed';
    await this.signupSessionRepo.save(session);

    return { success: true, tenantId: tenant.id };
  }

  private async ensureDefaultRoles(tenantId: string): Promise<Role[]> {
    const defaultRoles = [
      { name: 'admin', description: 'Tenant administrator' },
      { name: 'hr', description: 'HR manager' },
      { name: 'employee', description: 'Regular employee' },
    ];

    const roles: Role[] = [];
    for (const def of defaultRoles) {
      let role = await this.roleRepo.findOne({ where: { name: def.name } });
      if (!role) {
        role = this.roleRepo.create({ name: def.name, description: def.description });
        role = await this.roleRepo.save(role);
      }
      roles.push(role);
    }
    return roles;
  }

  private async calculateAmountCents(planId: string, seats: number): Promise<number> {
    const basePerSeat: Record<string, number> = {
      basic: 500,
      pro: 1200,
      enterprise: 2500,
    };
    const perSeat = basePerSeat[planId] ?? 1000;
    return perSeat * seats;
  }
}
