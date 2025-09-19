import { Body, Controller, Headers, Post, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SignupService } from './signup.service';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { CompanyDetailsDto } from './dto/company-details.dto';
import { PaymentDto } from './dto/payment.dto';
import { CompleteSignupDto } from './dto/complete-signup.dto';

@ApiTags('Signup')
@Controller('signup')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Post('personal-details')
  savePersonal(@Body() dto: PersonalDetailsDto) {
    return this.signupService.savePersonalDetails(dto);
  }

  @Post('company-details')
  saveCompany(@Body() dto: CompanyDetailsDto) {
    return this.signupService.saveCompanyDetails(dto);
  }

  // In your SignupController
  @Post('payment') // This should be the endpoint
  async startPayment(@Body() paymentDto: PaymentDto) {
    return this.signupService.startPayment(paymentDto);
  }
  @Post('payment/confirm')
  confirmPayment(
    @Body() body: { signupSessionId?: string; checkoutSessionId?: string } | undefined,
    @Query('signupSessionId') signupSessionIdQuery?: string,
    @Query('checkoutSessionId') checkoutSessionIdQuery?: string,
    @Query('session_id') sessionIdFromStripe?: string
  ) {
    const signupSessionId = body?.signupSessionId || signupSessionIdQuery;
    const checkoutSessionId =
      body?.checkoutSessionId || checkoutSessionIdQuery || sessionIdFromStripe;

    if (!signupSessionId) {
      throw new BadRequestException('signupSessionId is required (in body or query)');
    }

    return this.signupService.markPaymentSuccess(signupSessionId, checkoutSessionId);
  }

  @Post('complete')
  complete(@Body() dto: CompleteSignupDto) {
    return this.signupService.completeSignup(dto);
  }
}
