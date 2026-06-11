import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedRequest } from '../../common/types/request.types';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Tenant } from '../../entities/tenant.entity';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { SignupSession } from '../../entities/signup-session.entity';
import {
  SubscriptionStatus,
  PaypalSubscriptionStatus,
} from '../../common/constants/enums';
import { PaypalService } from './services/paypal.service';
import { PaypalWebhookService } from './services/paypal-webhook.service';
import { InitiateSubscriptionDto } from './dto/initiate-subscription.dto';
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto';
import { SignupInitiateSubscriptionDto } from './dto/signup-initiate-subscription.dto';
import { SignupActivateSubscriptionDto } from './dto/signup-activate-subscription.dto';
import { PaypalWebhookPayload } from './interfaces/paypal.interfaces';

@Controller('payments/paypal')
export class PaypalController {
  private readonly logger = new Logger(PaypalController.name);

  constructor(
    private readonly paypalService: PaypalService,
    private readonly webhookService: PaypalWebhookService,
    private readonly configService: ConfigService,
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(SignupSession)
    private readonly signupSessionRepo: Repository<SignupSession>,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /paypal/subscriptions/initiate
  // Authenticated: creates a PayPal subscription and returns the approval URL.
  // ---------------------------------------------------------------------------

  @Post('subscriptions/initiate')
  async initiateSubscription(
    @Body() dto: InitiateSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ approvalUrl: string; subscriptionId: string }> {
    const tenantId = req.user.tenant_id;

    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan?.paypalPlanId) {
      throw new NotFoundException(
        'Subscription plan not found or has no PayPal plan ID',
      );
    }

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenantId },
    });

    const apiBaseUrl = this.configService.get<string>(
      'API_BASE_URL',
      'http://localhost:3000',
    );
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:4200',
    );

    const returnUrl = `${apiBaseUrl}/payments/paypal/subscriptions/return`;
    const cancelUrl = `${frontendUrl}/settings/billing?paypal=cancelled`;

    const { subscriptionId, approvalUrl } =
      await this.paypalService.createSubscription(
        plan.paypalPlanId,
        tenantId,
        req.user.email,
        returnUrl,
        cancelUrl,
      );

    // Persist the subscription ID immediately (status is APPROVAL_PENDING).
    if (company) {
      await this.companyDetailsRepo.update(
        { tenant_id: tenantId },
        {
          paypal_subscription_id: subscriptionId,
          active_plan_id: plan.id,
        },
      );
    }

    return { approvalUrl, subscriptionId };
  }

  // ---------------------------------------------------------------------------
  // POST /paypal/subscriptions/activate
  // Authenticated: called by the frontend after the user returns from PayPal.
  // Verifies the subscription is APPROVED/ACTIVE then activates the tenant.
  // ---------------------------------------------------------------------------

  @Post('subscriptions/activate')
  async activateSubscription(
    @Body() dto: ActivateSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ status: string }> {
    const tenantId = req.user.tenant_id;

    const details = await this.paypalService.getSubscription(
      dto.subscriptionId,
    );

    const allowedStatuses: string[] = [
      PaypalSubscriptionStatus.APPROVED,
      PaypalSubscriptionStatus.ACTIVE,
    ];

    if (!allowedStatuses.includes(details.status)) {
      throw new UnauthorizedException(
        `PayPal subscription is in status "${details.status}" — cannot activate`,
      );
    }

    // Guard: subscription must belong to this tenant (custom_id set at creation).
    if (details.custom_id && details.custom_id !== tenantId) {
      throw new UnauthorizedException(
        'PayPal subscription does not belong to this tenant',
      );
    }

    await this.tenantRepo.update(
      { id: tenantId },
      {
        subscription_status: SubscriptionStatus.ACTIVE,
        trial_ends_at: null,
        grace_period_ends_at: null,
      },
    );

    await this.companyDetailsRepo.update(
      { tenant_id: tenantId },
      {
        paypal_subscription_id: details.id,
        paypal_payer_id: details.subscriber?.payer_id ?? null,
        is_paid: true,
      },
    );

    this.logger.log(`Tenant ${tenantId} activated via PayPal (${details.id})`);

    return { status: 'activated' };
  }

  // ---------------------------------------------------------------------------
  // GET /paypal/subscriptions/return  (Public — PayPal browser redirect)
  // PayPal appends: ?subscription_id=I-XXX&ba_token=...&token=...
  // Verifies the subscription then redirects to the frontend.
  // ---------------------------------------------------------------------------

  @Public()
  @Get('subscriptions/return')
  async handleReturn(
    @Query('subscription_id') subscriptionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:4200',
    );

    if (!subscriptionId) {
      res.redirect(`${frontendUrl}/settings/billing?paypal=error`);
      return;
    }

    try {
      const details = await this.paypalService.getSubscription(subscriptionId);

      const allowedStatuses: string[] = [
        PaypalSubscriptionStatus.APPROVED,
        PaypalSubscriptionStatus.ACTIVE,
      ];

      if (!allowedStatuses.includes(details.status)) {
        res.redirect(`${frontendUrl}/settings/billing?paypal=error`);
        return;
      }

      const tenantId = details.custom_id;
      if (!tenantId) {
        this.logger.warn(
          `PayPal return: subscription ${subscriptionId} has no custom_id`,
        );
        res.redirect(`${frontendUrl}/settings/billing?paypal=error`);
        return;
      }

      await this.tenantRepo.update(
        { id: tenantId },
        {
          subscription_status: SubscriptionStatus.ACTIVE,
          trial_ends_at: null,
          grace_period_ends_at: null,
        },
      );

      await this.companyDetailsRepo.update(
        { tenant_id: tenantId },
        {
          paypal_subscription_id: details.id,
          paypal_payer_id: details.subscriber?.payer_id ?? null,
          is_paid: true,
        },
      );

      this.logger.log(
        `Tenant ${tenantId} activated via PayPal return URL (${subscriptionId})`,
      );

      res.redirect(
        `${frontendUrl}/settings/billing?paypal=success&subscription_id=${subscriptionId}`,
      );
    } catch {
      res.redirect(`${frontendUrl}/settings/billing?paypal=error`);
    }
  }

  // ---------------------------------------------------------------------------
  // GET /paypal/subscriptions/cancel  (Public — PayPal browser redirect)
  // ---------------------------------------------------------------------------

  @Public()
  @Get('subscriptions/cancel')
  handleCancel(@Res() res: Response): void {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:4200',
    );
    res.redirect(`${frontendUrl}/settings/billing?paypal=cancelled`);
  }

  // ---------------------------------------------------------------------------
  // POST /paypal/webhook  (Public — PayPal signed event)
  // ---------------------------------------------------------------------------

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Body() body: PaypalWebhookPayload,
  ): Promise<void> {
    const transmissionId = req.headers['paypal-transmission-id'] as string;
    const transmissionTime = req.headers['paypal-transmission-time'] as string;
    const transmissionSig = req.headers['paypal-transmission-sig'] as string;
    const certUrl = req.headers['paypal-cert-url'] as string;
    const authAlgo = req.headers['paypal-auth-algo'] as string;

    const rawBody: Buffer =
      (req as Request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(body));

    const isValid = await this.paypalService.verifyWebhookSignature(
      transmissionId,
      transmissionTime,
      transmissionSig,
      certUrl,
      authAlgo,
      rawBody,
    );

    if (!isValid) {
      this.logger.warn(
        'PayPal webhook signature verification failed — ignored',
      );
      return;
    }

    await this.webhookService.handleEvent(body.event_type, body.resource);
  }

  // ---------------------------------------------------------------------------
  // POST /payments/paypal/signup/initiate  (Public — user not logged in yet)
  // Called during the signup flow before a tenant exists.
  // Creates a PayPal subscription and returns the subscriptionId for the JS SDK.
  // ---------------------------------------------------------------------------

  @Public()
  @Post('signup/initiate')
  async signupInitiateSubscription(
    @Body() dto: SignupInitiateSubscriptionDto,
  ): Promise<{ subscriptionId: string; approvalUrl: string }> {
    const session = await this.signupSessionRepo.findOne({
      where: { id: dto.signupSessionId },
    });
    if (!session) throw new NotFoundException('Signup session not found');

    const company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: dto.signupSessionId },
    });
    if (!company)
      throw new BadRequestException(
        'Company details not found. Complete company details step first.',
      );

    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan?.paypalPlanId) {
      throw new NotFoundException(
        'Subscription plan not found or has no PayPal plan ID',
      );
    }

    const apiBaseUrl = this.configService.get<string>(
      'API_BASE_URL',
      'http://localhost:3000',
    );
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    const returnUrl = `${apiBaseUrl}/payments/paypal/subscriptions/return`;
    const cancelUrl = `${frontendUrl}/signup/select-plan?paypal=cancelled`;

    const { subscriptionId, approvalUrl } =
      await this.paypalService.createSubscription(
        plan.paypalPlanId,
        dto.signupSessionId,
        session.email,
        returnUrl,
        cancelUrl,
      );

    await this.companyDetailsRepo.update(
      { signup_session_id: dto.signupSessionId },
      { paypal_subscription_id: subscriptionId, active_plan_id: plan.id },
    );

    return { subscriptionId, approvalUrl };
  }

  // ---------------------------------------------------------------------------
  // POST /payments/paypal/signup/activate  (Public — user not logged in yet)
  // Called after PayPal popup approval during signup.
  // Verifies the subscription and marks company.is_paid = true so
  // signup/complete can proceed.
  // ---------------------------------------------------------------------------

  @Public()
  @Post('signup/activate')
  async signupActivateSubscription(
    @Body() dto: SignupActivateSubscriptionDto,
  ): Promise<{ status: string }> {
    const session = await this.signupSessionRepo.findOne({
      where: { id: dto.signupSessionId },
    });
    if (!session) throw new NotFoundException('Signup session not found');

    const company = await this.companyDetailsRepo.findOne({
      where: { signup_session_id: dto.signupSessionId },
    });
    if (!company) throw new BadRequestException('Company details not found');

    const details = await this.paypalService.getSubscription(
      dto.subscriptionId,
    );

    const allowedStatuses: string[] = [
      PaypalSubscriptionStatus.APPROVED,
      PaypalSubscriptionStatus.ACTIVE,
    ];

    if (!allowedStatuses.includes(details.status)) {
      throw new BadRequestException(
        `PayPal subscription is in status "${details.status}" — cannot activate`,
      );
    }

    await this.companyDetailsRepo.update(
      { signup_session_id: dto.signupSessionId },
      {
        paypal_subscription_id: details.id,
        paypal_payer_id: details.subscriber?.payer_id ?? null,
        is_paid: true,
      },
    );

    this.logger.log(
      `Signup session ${dto.signupSessionId} payment confirmed via PayPal (${details.id})`,
    );

    return { status: 'payment_confirmed' };
  }
}
