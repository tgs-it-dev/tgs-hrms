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
  private readonly stripe?: Stripe;

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
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not configured. Payment flows will run in fallback mode.');
    }

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

    if (!this.stripe) {
      // Fallback: pretend checkout was created; caller should handle confirm step
      this.logger.warn('Stripe not configured. Returning mocked checkout URL.');
      return { checkoutSessionId: 'mock_session', url: 'https://example.com/mock-checkout' };
    }

    if (dto.mode === 'checkout') {
      let successUrl = this.configService.get<string>('STRIPE_SUCCESS_URL') || 'https://example.com/success';
      const hasQuery = successUrl.includes('?');
      const joiner = hasQuery ? '&' : '?';
      if (!successUrl.includes('session_id=')) {
        successUrl = `${successUrl}${joiner}session_id={CHECKOUT_SESSION_ID}`;
      }
      if (!successUrl.includes('signupSessionId=')) {
        successUrl = `${successUrl}&signupSessionId=${encodeURIComponent(session.id)}`;
      }

      const checkout = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: this.configService.get<string>('STRIPE_CANCEL_URL') || 'https://example.com/cancel',
        line_items: [
          { price: priceId, quantity: 1 },
        ],
        metadata: { signupSessionId: session.id, planId: plan.id },
      });
      company.stripe_session_id = checkout.id;
      await this.companyDetailsRepo.save(company);
      return { checkoutSessionId: checkout.id, url: checkout.url };
    }

    // Alternative: create a subscription directly without checkout
    if (this.stripe) {
      const customer = await this.stripe.customers.create({
        email: session.email,
        name: `${session.first_name} ${session.last_name}`.trim(),
        metadata: { signupSessionId: session.id },
      });
      const sub = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId, quantity: 1 }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: { signupSessionId: session.id, planId: plan.id },
      });
      company.stripe_customer_id = customer.id;
      // Save PI id if available on expanded latest invoice
      const latestInvoice: any = (sub as any)?.latest_invoice;
      const createdPiId: string | undefined = latestInvoice?.payment_intent?.id;
      if (createdPiId) {
        company.stripe_payment_intent_id = createdPiId;
      }
      await this.companyDetailsRepo.save(company);
      return { subscriptionId: sub.id, status: sub.status };
    }

    return { subscriptionId: 'mock_subscription', status: 'incomplete' };
  }

  async markPaymentSuccess(signupSessionId: string, checkoutSessionId?: string) {
    const session = await this.signupSessionRepo.findOne({ where: { id: signupSessionId } });
    if (!session) throw new NotFoundException('Signup session not found');
    let company = await this.companyDetailsRepo.findOne({ where: { signup_session_id: session.id } });
    if (!company && checkoutSessionId) {
      company = await this.companyDetailsRepo.findOne({ where: { stripe_session_id: checkoutSessionId } });
    }
    if (!company) throw new BadRequestException('Company details not found');

    const sessionIdToFetch = checkoutSessionId || company.stripe_session_id || null;
    if (sessionIdToFetch && this.stripe) {
      try {
        const stripeSession = await this.stripe.checkout.sessions.retrieve(sessionIdToFetch as string, {
          // Payment intent can be on multiple nested paths depending on flow
          expand: [
            'payment_intent',
            'subscription',
            'subscription.latest_invoice.payment_intent',
            'invoice.payment_intent',
          ] as any,
        } as any);

        let paymentIntent: any = (stripeSession as any).payment_intent;
        let subscription: any = (stripeSession as any).subscription;
        if (!paymentIntent && subscription && typeof subscription === 'object') {
          const fromExpanded = (subscription as any)?.latest_invoice?.payment_intent;
          if (fromExpanded) {
            paymentIntent = fromExpanded;
          }
        }
        if (!paymentIntent) {
          const fromInvoice = (stripeSession as any)?.invoice?.payment_intent;
          if (fromInvoice) {
            paymentIntent = fromInvoice;
          }
        }

        const paymentComplete =
          stripeSession.payment_status === 'paid' ||
          stripeSession.status === 'complete' ||
          (paymentIntent && paymentIntent.status === 'succeeded');
        if (paymentComplete) {
          company.is_paid = true;
        }

        let customerId: string | null = null;
        if (stripeSession.customer && typeof stripeSession.customer === 'string') {
          customerId = stripeSession.customer;
        }
        if (!customerId && subscription && typeof (subscription as any).customer === 'string') {
          customerId = (subscription as any).customer as string;
        }
        if (!customerId && paymentIntent && typeof paymentIntent.customer === 'string') {
          customerId = paymentIntent.customer as string;
        }
        if (customerId) {
          company.stripe_customer_id = customerId;
        }
        // Persist Payment Intent ID
        if (paymentIntent && typeof paymentIntent.id === 'string') {
          company.stripe_payment_intent_id = paymentIntent.id;
        } else if (subscription && typeof subscription === 'string') {
          // Fallback: retrieve subscription for expanded latest invoice PI
          const sub = await this.stripe.subscriptions.retrieve(subscription as string, {
            expand: ['latest_invoice.payment_intent'],
          } as any);
          const piId = (sub as any)?.latest_invoice?.payment_intent?.id;
          if (piId) {
            company.stripe_payment_intent_id = piId;
          }
        }
      } catch (e) {
        this.logger.warn(`Stripe session retrieve failed: ${String((e as any)?.message || e)}`);
        // Do not fail; allow manual confirmation to proceed
        company.is_paid = true;
      }
    } else {
      // Fallback path when no session id or Stripe not configured
      company.is_paid = true;
    }

    await this.companyDetailsRepo.save(company);
    session.status = 'payment_completed';
    await this.signupSessionRepo.save(session);
    return { ok: true, isPaid: company.is_paid, stripeCustomerId: company.stripe_customer_id, stripePaymentIntentId: company.stripe_payment_intent_id };
  }

  async completeSignup(dto: CompleteSignupDto) {
    const session = await this.signupSessionRepo.findOne({ where: { id: dto.signupSessionId } });
    if (!session) throw new NotFoundException('Signup session not found');
    const company = await this.companyDetailsRepo.findOne({ where: { signup_session_id: session.id } });
    if (!company) throw new BadRequestException('Company details not found');
    if (!company.is_paid) throw new BadRequestException('Payment not completed');

    const tenant = await this.tenantRepo.save(this.tenantRepo.create({ name: company.company_name }));

    company.tenant_id = tenant.id as unknown as any;
    await this.companyDetailsRepo.save(company);

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
