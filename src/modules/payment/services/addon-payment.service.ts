import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddonPurchase } from '../../../entities/addon-purchase.entity';
import { CompanyDetails } from '../../../entities/company-details.entity';
import { SubscriptionPlan } from '../../../entities/subscription-plan.entity';
import { PayPalProvider } from '../providers/paypal.provider';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PAYPAL_DEFAULT_CURRENCY } from '../constants/payment.constants';
import { ConfigService } from '@nestjs/config';
import {
  CreateAddonOrderDto,
  CreateAddonOrderResponseDto,
} from '../dto/create-addon-order.dto';
import {
  CaptureAddonOrderDto,
  CaptureAddonOrderResponseDto,
} from '../dto/capture-addon-order.dto';

/** Price per additional employee slot (USD). */
const EMPLOYEE_SLOT_PRICE_USD = 2.0 as const;

@Injectable()
export class AddonPaymentService {
  private readonly logger = new Logger(AddonPaymentService.name);

  constructor(
    @InjectRepository(AddonPurchase)
    private readonly addonRepo: Repository<AddonPurchase>,
    @InjectRepository(CompanyDetails)
    private readonly companyRepo: Repository<CompanyDetails>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    private readonly paypal: PayPalProvider,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Creates a PayPal order for purchasing additional employee slots.
   * Checks that the feature is enabled on the tenant's plan before proceeding.
   */
  async createAddonOrder(
    tenantId: string,
    dto: CreateAddonOrderDto,
  ): Promise<CreateAddonOrderResponseDto> {
    const company = await this.companyRepo.findOne({ where: { tenant_id: tenantId } });
    if (!company) throw new NotFoundException('Company details not found for this tenant');

    const plan = await this.planRepo.findOne({ where: { id: company.plan_id } });
    if (!plan) throw new BadRequestException('Subscription plan not found');

    if (!plan.addon_feature_enabled) {
      throw new BadRequestException(
        'The employee-slot addon feature is not enabled for your current plan. Please upgrade to a plan that supports addons.',
      );
    }

    const totalAmount = EMPLOYEE_SLOT_PRICE_USD * dto.employeeCount;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const returnUrl =
      this.configService.get<string>('PAYPAL_ADDON_RETURN_URL') ||
      `${frontendUrl}/employees?payment=success`;
    const cancelUrl =
      this.configService.get<string>('PAYPAL_ADDON_CANCEL_URL') ||
      `${frontendUrl}/employees?payment=cancelled`;

    const purchase = this.addonRepo.create({
      tenant_id: tenantId,
      employee_count: dto.employeeCount,
      amount: totalAmount,
      payment_status: PaymentStatus.PENDING,
    });
    const savedPurchase = await this.addonRepo.save(purchase);

    const order = await this.paypal.createOrder({
      amount: totalAmount,
      currency: PAYPAL_DEFAULT_CURRENCY,
      description: `Employee slot purchase: ${dto.employeeCount} slot(s) @ $${EMPLOYEE_SLOT_PRICE_USD} each`,
      returnUrl: `${returnUrl}&purchaseId=${savedPurchase.id}`,
      cancelUrl,
      customId: savedPurchase.id,
    });

    savedPurchase.paypal_order_id = order.orderId;
    await this.addonRepo.save(savedPurchase);

    this.logger.log(
      `Addon order created: ${order.orderId} for tenant ${tenantId} (${dto.employeeCount} slots)`,
    );

    return {
      orderId: order.orderId,
      approvalUrl: order.approvalUrl,
      status: order.status,
      amount: totalAmount,
      currency: PAYPAL_DEFAULT_CURRENCY,
      purchaseId: savedPurchase.id,
    };
  }

  /**
   * Captures a PayPal order and marks the addon purchase as completed.
   * Idempotent — safe to call if order was already captured.
   */
  async captureAddonOrder(
    tenantId: string,
    dto: CaptureAddonOrderDto,
  ): Promise<CaptureAddonOrderResponseDto> {
    const purchase = await this.addonRepo.findOne({
      where: { id: dto.purchaseId, tenant_id: tenantId },
    });
    if (!purchase) throw new NotFoundException('Addon purchase record not found');

    if (purchase.payment_status === PaymentStatus.COMPLETED) {
      this.logger.log(`Addon purchase ${dto.purchaseId} already captured — returning cached result`);
      return {
        captureId: purchase.paypal_capture_id ?? '',
        status: 'COMPLETED',
        amount: Number(purchase.amount),
        currency: PAYPAL_DEFAULT_CURRENCY,
        employeeCount: purchase.employee_count,
      };
    }

    if (purchase.paypal_order_id && purchase.paypal_order_id !== dto.orderId) {
      throw new BadRequestException('Order ID does not match the purchase record');
    }

    const capture = await this.paypal.captureOrder(dto.orderId);

    purchase.paypal_capture_id = capture.captureId;
    purchase.payment_status =
      capture.status === 'COMPLETED' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
    await this.addonRepo.save(purchase);

    this.logger.log(
      `Addon order captured: ${capture.captureId} for tenant ${tenantId}, status=${capture.status}`,
    );

    return {
      captureId: capture.captureId,
      status: capture.status,
      amount: capture.amount,
      currency: capture.currency,
      employeeCount: purchase.employee_count,
    };
  }

  async findByPayPalOrderId(orderId: string): Promise<AddonPurchase | null> {
    return this.addonRepo.findOne({ where: { paypal_order_id: orderId } });
  }
}
