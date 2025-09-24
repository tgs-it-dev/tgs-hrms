// import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { SignupSession } from '../../entities/signup-session.entity';
// import { CompanyDetails } from '../../entities/company-details.entity';
// import { PersonalDetailsDto } from './dto/personal-details.dto';
// import { CompanyDetailsDto } from './dto/company-details.dto';
// import { PaymentDto } from './dto/payment.dto';
// import { CompleteSignupDto } from './dto/complete-signup.dto';
// import * as bcrypt from 'bcrypt';
// import Stripe from 'stripe';
// import { ConfigService } from '@nestjs/config';
// import { Tenant } from '../../entities/tenant.entity';
// import { User } from '../../entities/user.entity';
// import { Role } from '../../entities/role.entity';
// import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
// import axios from 'axios';
// import { GoogleSignupInitDto, GoogleSignupInitResponse } from './dto/google-signup-init.dto';
// import { JwtService } from '@nestjs/jwt';
// import { Department } from '../../entities/department.entity';
// import { Designation } from '../../entities/designation.entity';

// @Injectable()
// export class SignupService {
//   private readonly logger = new Logger(SignupService.name);
//   private readonly stripe?: Stripe;

//   constructor(
//     @InjectRepository(SignupSession)
//     private readonly signupSessionRepo: Repository<SignupSession>,
//     @InjectRepository(CompanyDetails)
//     private readonly companyDetailsRepo: Repository<CompanyDetails>,
//     @InjectRepository(Tenant)
//     private readonly tenantRepo: Repository<Tenant>,
//     @InjectRepository(User)
//     private readonly userRepo: Repository<User>,
//     @InjectRepository(Role)
//     private readonly roleRepo: Repository<Role>,
//     @InjectRepository(SubscriptionPlan)
//     private readonly planRepo: Repository<SubscriptionPlan>,
//     @InjectRepository(Department)
//     private readonly departmentRepo: Repository<Department>,
//     @InjectRepository(Designation)
//     private readonly designationRepo: Repository<Designation>,
//     private readonly configService: ConfigService,
//     private readonly jwtService: JwtService,
//   ) {
//     const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
//     if (stripeKey) {
//       this.stripe = new Stripe(stripeKey);
//     } else {
//       this.logger.warn(
//         'STRIPE_SECRET_KEY not configured. Payment flows will run in fallback mode.'
//       );
//     }
//   }

//   async savePersonalDetails(dto: PersonalDetailsDto) {
//     const existingUser = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
//     if (existingUser) {
//       throw new BadRequestException({
//         field: 'email',
//         message: 'User with this email already exists',
//       });
//     }

//     const passwordHash = await bcrypt.hash(dto.password, 10);
//     const session = this.signupSessionRepo.create({
//       email: dto.email.toLowerCase(),
//       password_hash: passwordHash,
//       first_name: dto.first_name,
//       last_name: dto.last_name,
//       phone: dto.phone,
//       status: 'personal_completed',
//     });
//     const saved = await this.signupSessionRepo.save(session);
//     return { signupSessionId: saved.id };
//   }

//   async googleSignupInit(dto: GoogleSignupInitDto): Promise<GoogleSignupInitResponse | any> {
//     // Verify Google ID token via tokeninfo endpoint (simple server-side verification)
//     let payload: any;
//     try {
//       const resp = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
//         params: { id_token: dto.idToken },
//       });
//       payload = resp.data;
//     } catch (e) {
//       throw new BadRequestException('Invalid Google ID token');
//     }

//     const email: string = String(payload.email || '').toLowerCase();
//     const givenName: string = String(payload.given_name || '').trim();
//     const familyName: string = String(payload.family_name || '').trim();
//     const name: string = String(payload.name || '').trim();

//     const firstName = givenName || (name ? name.split(' ')[0] : '');
//     const lastName = familyName || (name ? name.split(' ').slice(1).join(' ') : '');

//     const existingUser = await this.userRepo.findOne({ where: { email }, relations: ['role'] });
//     if (existingUser) {
//       if (!existingUser.role?.name) {
//         throw new BadRequestException('User role not found for existing user');
//       }

//       const permissions = await this.userRepo.query(`
//         SELECT p.name 
//         FROM permissions p 
//         JOIN role_permissions rp ON p.id = rp.permission_id 
//         WHERE rp.role_id = $1
//       `, [existingUser.role.id]);
//       const perms = permissions.map((row: any) => row.name.toLowerCase());

//       const payload = {
//         email: existingUser.email,
//         sub: existingUser.id,
//         role: existingUser.role.name.toLowerCase(),
//         tenant_id: existingUser.tenant_id,
//         permissions: perms,
//       };

//       const accessToken = this.jwtService.sign(payload, {
//         secret: this.configService.get<string>('JWT_SECRET'),
//         expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
//       });
//       const refreshToken = this.jwtService.sign(payload, {
//         secret: this.configService.get<string>('JWT_SECRET'),
//         expiresIn: '7d',
//       });

//       existingUser.refresh_token = refreshToken;
//       await this.userRepo.save(existingUser);

//       return {
//         alreadyRegistered: true,
//         accessToken,
//         refreshToken,
//         user: existingUser,
//         permissions: perms,
//       };
//     }

//     // Generate a random password placeholder for session; final auth can use Google --
//     const randomSecret = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
//     // const passwordHash = await bcrypt.hash(randomSecret, 10);

//     const session = this.signupSessionRepo.create({
//       email,
//       password_hash:'',
//       first_name: firstName,
//       last_name: lastName,
//       phone: '',
//       status: 'personal_completed',
//     });
   
//     const saved = await this.signupSessionRepo.save(session);

//     // Suggest company name and domain from email
//     const domain = email.includes('@') ? email.split('@')[1] : '';
//     const companyName = (() => {
//       if (!domain) return '';
//       const parts = domain.split('.');
//       const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
//       return base.charAt(0).toUpperCase() + base.slice(1);
//     })();

//     return {
//       signupSessionId: saved.id,
//       email,
//       first_name: firstName,
//       last_name: lastName,
//       suggested: {
//         companyName,
//         domain,
//       },
//       companyDetailsCompleted: false, // <-- yeh add karein
//     };
//   }

//   async saveCompanyDetails(dto: CompanyDetailsDto) {
//     const session = await this.signupSessionRepo.findOne({ where: { id: dto.signupSessionId } });
//     if (!session) throw new NotFoundException('Signup session not found');

//     const details = this.companyDetailsRepo.create({
//       company_name: dto.companyName,
//       domain: dto.domain,
//       plan_id: dto.planId,
//       signup_session_id: session.id,
//       is_paid: false,
//     });
//     await this.companyDetailsRepo.save(details);
//     session.status = 'company_completed';
//     await this.signupSessionRepo.save(session);
//     return { signupSessionId: session.id };
//   }

//   async startPayment(dto: PaymentDto) {
//     const session = await this.signupSessionRepo.findOne({
//       where: { id: dto.signupSessionId },
//       relations: ['companyDetails'],
//     });
//     if (!session) throw new NotFoundException('Signup session not found');
//     const company = await this.companyDetailsRepo.findOne({
//       where: { signup_session_id: session.id },
//     });
//     if (!company) throw new BadRequestException('Company details not found');

//     const plan = await this.planRepo.findOne({ where: { id: company.plan_id } });
//     if (!plan) throw new BadRequestException('Invalid planId');
//     const priceId = (plan.stripePriceId || '').trim();
//     if (!priceId || !priceId.startsWith('price_')) {
//       throw new BadRequestException(
//         'Invalid stripePriceId configured for plan. Expected a Stripe Price ID starting with "price_". Update the plan to use a valid recurring Price from your Stripe Dashboard.'
//       );
//     }

//     if (!this.stripe) {
//       this.logger.warn('Stripe not configured. Returning mocked checkout URL.');
//       return { checkoutSessionId: 'mock_session', url: 'https://example.com/mock-checkout' };
//     }

//     if (dto.mode === 'checkout') {
//       // Get base URL from environment
//       let successUrl =
//         this.configService.get<string>('STRIPE_SUCCESS_URL') ||
//         'http://192.168.0.141:5173/signup/confirm-payment';

//       // Add session_id parameter
//       const hasQuery = successUrl.includes('?');
//       const joiner = hasQuery ? '&' : '?';
//       if (!successUrl.includes('session_id=')) {
//         successUrl = `${successUrl}${joiner}session_id={CHECKOUT_SESSION_ID}`;
//       }

//       // Add signupSessionId parameter
//       if (!successUrl.includes('signupSessionId=')) {
//         successUrl = `${successUrl}&signupSessionId=${session.id}`;
//       }

//       console.log('=== STRIPE SUCCESS URL DEBUG ===');
//       console.log('Base URL:', this.configService.get<string>('STRIPE_SUCCESS_URL'));
//       console.log('Final success URL:', successUrl);
//       console.log('Session ID:', session.id);

//       const checkout = await this.stripe.checkout.sessions.create({
//         mode: 'subscription',
//         success_url: successUrl,
//         cancel_url:
//           this.configService.get<string>('STRIPE_CANCEL_URL') ||
//           'http://192.168.0.141:5173/signup/select-plan',
//         line_items: [{ price: priceId, quantity: 1 }],
//         metadata: { signupSessionId: session.id, planId: plan.id },
//       });

//       company.stripe_session_id = checkout.id;
//       await this.companyDetailsRepo.save(company);
//       return { checkoutSessionId: checkout.id, url: checkout.url };
//     }
//     // Alternative: create a subscription directly without checkout
//     if (this.stripe) {
//       const customer = await this.stripe.customers.create({
//         email: session.email,
//         name: `${session.first_name} ${session.last_name}`.trim(),
//         metadata: { signupSessionId: session.id },
//       });
//       const sub = await this.stripe.subscriptions.create({
//         customer: customer.id,
//         items: [{ price: priceId, quantity: 1 }],
//         payment_behavior: 'default_incomplete',
//         expand: ['latest_invoice.payment_intent'],
//         metadata: { signupSessionId: session.id, planId: plan.id },
//       });
//       company.stripe_customer_id = customer.id;
//       // Save PI id if available on expanded latest invoice
//       const latestInvoice: any = (sub as any)?.latest_invoice;
//       const createdPiId: string | undefined = latestInvoice?.payment_intent?.id;
//       if (createdPiId) {
//         company.stripe_payment_intent_id = createdPiId;
//       }
//       await this.companyDetailsRepo.save(company);
//       return { subscriptionId: sub.id, status: sub.status };
//     }

//     return { subscriptionId: 'mock_subscription', status: 'incomplete' };
//   }

//   async markPaymentSuccess(signupSessionId: string, checkoutSessionId?: string) {
//     const session = await this.signupSessionRepo.findOne({ where: { id: signupSessionId } });
//     if (!session) throw new NotFoundException('Signup session not found');
//     let company = await this.companyDetailsRepo.findOne({
//       where: { signup_session_id: session.id },
//     });
//     if (!company && checkoutSessionId) {
//       company = await this.companyDetailsRepo.findOne({
//         where: { stripe_session_id: checkoutSessionId },
//       });
//     }
//     if (!company) throw new BadRequestException('Company details not found');

//     const sessionIdToFetch = checkoutSessionId || company.stripe_session_id || null;
//     if (sessionIdToFetch && this.stripe) {
//       try {
//         const stripeSession = await this.stripe.checkout.sessions.retrieve(
//           sessionIdToFetch as string,
//           {
//             // Payment intent can be on multiple nested paths depending on flow
//             expand: [
//               'payment_intent',
//               'subscription',
//               'subscription.latest_invoice.payment_intent',
//               'invoice.payment_intent',
//             ] as any,
//           } as any
//         );

//         let paymentIntent: any = (stripeSession as any).payment_intent;
//         let subscription: any = (stripeSession as any).subscription;
//         if (!paymentIntent && subscription && typeof subscription === 'object') {
//           const fromExpanded = (subscription as any)?.latest_invoice?.payment_intent;
//           if (fromExpanded) {
//             paymentIntent = fromExpanded;
//           }
//         }
//         if (!paymentIntent) {
//           const fromInvoice = (stripeSession as any)?.invoice?.payment_intent;
//           if (fromInvoice) {
//             paymentIntent = fromInvoice;
//           }
//         }

//         const paymentComplete =
//           stripeSession.payment_status === 'paid' ||
//           stripeSession.status === 'complete' ||
//           (paymentIntent && paymentIntent.status === 'succeeded');
//         if (paymentComplete) {
//           company.is_paid = true;
//         }

//         let customerId: string | null = null;
//         if (stripeSession.customer && typeof stripeSession.customer === 'string') {
//           customerId = stripeSession.customer;
//         }
//         if (!customerId && subscription && typeof (subscription as any).customer === 'string') {
//           customerId = (subscription as any).customer as string;
//         }
//         if (!customerId && paymentIntent && typeof paymentIntent.customer === 'string') {
//           customerId = paymentIntent.customer as string;
//         }
//         if (customerId) {
//           company.stripe_customer_id = customerId;
//         }
//         // Persist Payment Intent ID
//         if (paymentIntent && typeof paymentIntent.id === 'string') {
//           company.stripe_payment_intent_id = paymentIntent.id;
//         } else if (subscription && typeof subscription === 'string') {
//           // Fallback: retrieve subscription for expanded latest invoice PI
//           const sub = await this.stripe.subscriptions.retrieve(
//             subscription as string,
//             {
//               expand: ['latest_invoice.payment_intent'],
//             } as any
//           );
//           const piId = (sub as any)?.latest_invoice?.payment_intent?.id;
//           if (piId) {
//             company.stripe_payment_intent_id = piId;
//           }
//         }
//       } catch (e) {
//         this.logger.warn(`Stripe session retrieve failed: ${String((e as any)?.message || e)}`);
//         // Do not fail; allow manual confirmation to proceed
//         company.is_paid = true;
//       }
//     } else {
//       // Fallback path when no session id or Stripe not configured
//       company.is_paid = true;
//     }

//     await this.companyDetailsRepo.save(company);
//     session.status = 'payment_completed';
//     await this.signupSessionRepo.save(session);
//     return {
//       ok: true,
//       isPaid: company.is_paid,
//       stripeCustomerId: company.stripe_customer_id,
//       stripePaymentIntentId: company.stripe_payment_intent_id,
//       status: company.is_paid ? 'succeeded' : 'failed',
//       transactionId: company.stripe_payment_intent_id || company.stripe_session_id,
//     };
//   }

//   async completeSignup(dto: CompleteSignupDto) {
//     const session = await this.signupSessionRepo.findOne({ where: { id: dto.signupSessionId } });
//     if (!session) throw new NotFoundException('Signup session not found');
//     const company = await this.companyDetailsRepo.findOne({
//       where: { signup_session_id: session.id },
//     });
//     if (!company) throw new BadRequestException('Company details not found');
//     if (!company.is_paid) throw new BadRequestException('Payment not completed');

//     const tenant = await this.tenantRepo.save(
//       this.tenantRepo.create({ name: company.company_name })
//     );

//     company.tenant_id = tenant.id as unknown as any;
//     await this.companyDetailsRepo.save(company);

//     // --- Seed default departments and designations for this tenant ---
//     const defaultDepartments = [
//       {
//         name: 'HR',
//         description: `The Human Resources department is responsible for managing the organization's workforce. 
//     It focuses on employee recruitment, training, and development to build a productive team. 
//     HR ensures compliance with labor laws and company policies. 
//     The department also handles payroll, benefits, and performance management. 
//     It plays a vital role in maintaining a positive workplace culture and employee satisfaction.`,
//         designations: ['HR Manager', 'HR Executive', 'Recruitment Specialist', 'Training Coordinator', 'Payroll Officer'],
//       },
//       {
//         name: 'Engineering',
//         description: `The Engineering department drives the design, development, and maintenance of technical systems. 
//     It focuses on building scalable software solutions and ensuring product quality. 
//     The team collaborates on innovation, architecture, and performance optimization. 
//     Engineers work on diverse areas such as web, mobile, and backend development. 
//     This department plays a crucial role in delivering reliable, modern, and user-friendly technology solutions.`,
//         designations: ['Software Engineer', 'Tech Lead', 'Web Developer', 'Android Developer', 'Backend Developer', 'QA Engineer'],
//       },
//       {
//         name: 'Sales',
//         description: `The Sales department is responsible for driving revenue and business growth. 
//     It works on building strong customer relationships and expanding market reach. 
//     Sales teams analyze customer needs to provide suitable products or services. 
//     They develop strategies to meet sales targets and achieve business goals. 
//     The department also collaborates with marketing to identify new opportunities and enhance customer satisfaction.`,
//         designations: ['Sales Manager', 'Sales Executive', 'Business Development Officer', 'Account Manager', 'Sales Analyst'],
//       },
//     ];
//     for (const dept of defaultDepartments) {
//       const department = await this.departmentRepo.save(
//         this.departmentRepo.create({
//           name: dept.name,
//           description: dept.description,
//           tenant_id: tenant.id,
//         })
//       );
//       for (const desigTitle of dept.designations) {
//         await this.designationRepo.save(
//           this.designationRepo.create({
//             title: desigTitle,
//             department_id: department.id,
//           })
//         );
//       }
//     }
//     // --- End seeding ---

//     const roles = await this.ensureDefaultRoles(tenant.id);
//     // Find the 'Admin' role (case-sensitive)
//     const adminRole = roles.find((r) => r.name === 'Admin');
//     if (!adminRole) {
//       throw new Error("'Admin' role not found in roles table. Please seed the roles table with the required roles.");
//     }

//     const user = this.userRepo.create({
//       email: session.email,
//       password: session.password_hash,
//       first_name: session.first_name,
//       last_name: session.last_name,
//       phone: session.phone,
//       tenant_id: tenant.id,
//       role_id: adminRole.id,
//     });
//     await this.userRepo.save(user);

//     session.status = 'completed';
//     await this.signupSessionRepo.save(session);

//     return { success: true, tenantId: tenant.id };
//   }

//   private async ensureDefaultRoles(tenantId: string): Promise<Role[]> {
//     // Fetch all existing roles for this tenant (or global roles if not tenant-specific)
//     const roleNames = ['Admin', 'Employee', 'Manager', 'User', 'System Admin'];
//     const roles: Role[] = [];
//     for (const name of roleNames) {
//       let role = await this.roleRepo.findOne({ where: { name } });
//       if (role) {
//         roles.push(role);
//       }
//     }
//     return roles;
//   }

//   private async calculateAmountCents(planId: string, seats: number): Promise<number> {
//     const basePerSeat: Record<string, number> = {
//       basic: 500,
//       pro: 1200,
//       enterprise: 2500,
//     };
//     const perSeat = basePerSeat[planId] ?? 1000;
//     return perSeat * seats;
//   }
// }








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
import axios from 'axios';
import { GoogleSignupInitDto, GoogleSignupInitResponse } from './dto/google-signup-init.dto';
import { JwtService } from '@nestjs/jwt';

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
    private readonly jwtService: JwtService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not configured. Payment flows will run in fallback mode.'
      );
    }
  }

  async savePersonalDetails(dto: PersonalDetailsDto) {
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existingUser) {
      throw new BadRequestException({
        field: 'email',
        message: 'User with this email already exists',
      });
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

  async googleSignupInit(dto: GoogleSignupInitDto): Promise<GoogleSignupInitResponse | any> {
    // Verify Google ID token via tokeninfo endpoint (simple server-side verification)
    let payload: any;
    try {
      const resp = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
        params: { id_token: dto.idToken },
      });
      payload = resp.data;
    } catch (e) {
      throw new BadRequestException('Invalid Google ID token');
    }

    const email: string = String(payload.email || '').toLowerCase();
    const givenName: string = String(payload.given_name || '').trim();
    const familyName: string = String(payload.family_name || '').trim();
    const name: string = String(payload.name || '').trim();

    const firstName = givenName || (name ? name.split(' ')[0] : '');
    const lastName = familyName || (name ? name.split(' ').slice(1).join(' ') : '');

    const existingUser = await this.userRepo.findOne({ where: { email }, relations: ['role'] });
    if (existingUser) {
      if (!existingUser.role?.name) {
        throw new BadRequestException('User role not found for existing user');
      }

      const permissions = await this.userRepo.query(`
        SELECT p.name 
        FROM permissions p 
        JOIN role_permissions rp ON p.id = rp.permission_id 
        WHERE rp.role_id = $1
      `, [existingUser.role.id]);
      const perms = permissions.map((row: any) => row.name.toLowerCase());

      const payload = {
        email: existingUser.email,
        sub: existingUser.id,
        role: existingUser.role.name.toLowerCase(),
        tenant_id: existingUser.tenant_id,
        permissions: perms,
      };

      const accessToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '24h',
      });
      const refreshToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '7d',
      });

      existingUser.refresh_token = refreshToken;
      await this.userRepo.save(existingUser);

      return {
        alreadyRegistered: true,
        accessToken,
        refreshToken,
        user: existingUser,
        permissions: perms,
      };
    }

    // Generate a random password placeholder for session; final auth can use Google --
    const randomSecret = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // const passwordHash = await bcrypt.hash(randomSecret, 10);

    const session = this.signupSessionRepo.create({
      email,
      password_hash:'',
      first_name: firstName,
      last_name: lastName,
      phone: '',
      status: 'personal_completed',
    });
   
    const saved = await this.signupSessionRepo.save(session);

    // Suggest company name and domain from email
    const domain = email.includes('@') ? email.split('@')[1] : '';
    const companyName = (() => {
      if (!domain) return '';
      const parts = domain.split('.');
      const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
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
      suggested: {
        companyName,
        domain,
      },
      companyDetailsCompleted: false,
    };
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
    const session = await this.signupSessionRepo.findOne({
      where: { id: dto.signupSessionId },
      relations: ['companyDetails'],
    });
    if (!session) throw new NotFoundException('Signup session not found');
    const company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: session.id },
    });
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
      this.logger.warn('Stripe not configured. Returning mocked checkout URL.');
      return { checkoutSessionId: 'mock_session', url: 'https://example.com/mock-checkout' };
    }

    if (dto.mode === 'checkout') {
      // Get base URL from environment
      let successUrl =
        this.configService.get<string>('STRIPE_SUCCESS_URL') ||
        'http://192.168.0.141:5173/signup/confirm-payment';

      // Add session_id parameter
      const hasQuery = successUrl.includes('?');
      const joiner = hasQuery ? '&' : '?';
      if (!successUrl.includes('session_id=')) {
        successUrl = `${successUrl}${joiner}session_id={CHECKOUT_SESSION_ID}`;
      }

      // Add signupSessionId parameter
      if (!successUrl.includes('signupSessionId=')) {
        successUrl = `${successUrl}&signupSessionId=${session.id}`;
      }

      console.log('=== STRIPE SUCCESS URL DEBUG ===');
      console.log('Base URL:', this.configService.get<string>('STRIPE_SUCCESS_URL'));
      console.log('Final success URL:', successUrl);
      console.log('Session ID:', session.id);

      const checkout = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: successUrl,
        cancel_url:
          this.configService.get<string>('STRIPE_CANCEL_URL') ||
          'http://192.168.0.161:5173/signup/select-plan',
        line_items: [{ price: priceId, quantity: 1 }],
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
    let company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: session.id },
    });
    if (!company && checkoutSessionId) {
      company = await this.companyDetailsRepo.findOne({
        where: { stripe_session_id: checkoutSessionId },
      });
    }
    if (!company) throw new BadRequestException('Company details not found');

    const sessionIdToFetch = checkoutSessionId || company.stripe_session_id || null;
    if (sessionIdToFetch && this.stripe) {
      try {
        const stripeSession = await this.stripe.checkout.sessions.retrieve(
          sessionIdToFetch as string,
          {
            // Payment intent can be on multiple nested paths depending on flow
            expand: [
              'payment_intent',
              'subscription',
              'subscription.latest_invoice.payment_intent',
              'invoice.payment_intent',
            ] as any,
          } as any
        );

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
          const sub = await this.stripe.subscriptions.retrieve(
            subscription as string,
            {
              expand: ['latest_invoice.payment_intent'],
            } as any
          );
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
    return {
      ok: true,
      isPaid: company.is_paid,
      stripeCustomerId: company.stripe_customer_id,
      stripePaymentIntentId: company.stripe_payment_intent_id,
      status: company.is_paid ? 'succeeded' : 'failed',
      transactionId: company.stripe_payment_intent_id || company.stripe_session_id,
    };
  }

  async completeSignup(dto: CompleteSignupDto) {
    const session = await this.signupSessionRepo.findOne({ where: { id: dto.signupSessionId } });
    if (!session) throw new NotFoundException('Signup session not found');
    const company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: session.id },
    });
    if (!company) throw new BadRequestException('Company details not found');
    if (!company.is_paid) throw new BadRequestException('Payment not completed');

    const tenant = await this.tenantRepo.save(
      this.tenantRepo.create({ name: company.company_name })
    );

    company.tenant_id = tenant.id as unknown as any;
    await this.companyDetailsRepo.save(company);

    const roles = await this.ensureDefaultRoles(tenant.id);
    // Find the 'Admin' role (case-sensitive)
    const adminRole = roles.find((r) => r.name === 'Admin');
    if (!adminRole) {
      throw new Error("'Admin' role not found in roles table. Please seed the roles table with the required roles.");
    }

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

    // Load permissions from role_permissions
    const permissionsRows = await this.userRepo.query(`
      SELECT p.name
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
    `, [adminRole.id]);
    const permissions = permissionsRows.map((row: any) => String(row.name).toLowerCase());

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

    user.refresh_token = refreshToken;
    await this.userRepo.save(user);

    return {
      success: true,
      tenantId: tenant.id,
      accessToken,
      refreshToken,
      user,
      permissions,
    };
  }

  private async ensureDefaultRoles(tenantId: string): Promise<Role[]> {
    // Fetch all existing roles for this tenant (or global roles if not tenant-specific)
    const roleNames = ['Admin', 'Employee', 'Manager', 'User', 'System-Admin'];
    const roles: Role[] = [];
    for (const name of roleNames) {
      let role = await this.roleRepo.findOne({ where: { name } });
      if (role) {
        roles.push(role);
      }
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
