import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { WebhookProcessorService } from '../services/webhook-processor.service';

@ApiTags('Payments - Webhooks')
@Controller('payments/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookProcessor: WebhookProcessorService) {}

  /**
   * PayPal webhook endpoint.
   *
   * PayPal sends all subscription and payment events here.  The raw JSON
   * body is forwarded directly to the processor; signature verification
   * uses the PayPal-specific headers below.
   *
   * Set this URL in your PayPal developer dashboard under Webhooks.
   */
  @Post('paypal')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handlePayPalWebhook(
    @Req() req: Request,
    @Headers('paypal-auth-algo') authAlgo: string,
    @Headers('paypal-cert-url') certUrl: string,
    @Headers('paypal-transmission-id') transmissionId: string,
    @Headers('paypal-transmission-sig') transmissionSig: string,
    @Headers('paypal-transmission-time') transmissionTime: string,
  ) {
    const rawBody = req.body as Record<string, unknown>;

    const result = await this.webhookProcessor.receive(rawBody, {
      authAlgo: authAlgo ?? '',
      certUrl: certUrl ?? '',
      transmissionId: transmissionId ?? '',
      transmissionSig: transmissionSig ?? '',
      transmissionTime: transmissionTime ?? '',
    });

    this.logger.log(
      `Webhook ${result.eventType} (${result.eventId}): ${result.processed ? 'processed' : 'skipped (duplicate)'}`,
    );

    return { ok: true };
  }
}
