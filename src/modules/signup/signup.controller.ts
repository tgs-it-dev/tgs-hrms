import { Body, Controller, Headers, Post } from '@nestjs/common';
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

  @Post('payment')
  startPayment(@Body() dto: PaymentDto) {
    return this.signupService.startPayment(dto);
  }

  @Post('payment/confirm')
  confirmPayment(@Body('signupSessionId') signupSessionId: string) {
    return this.signupService.markPaymentSuccess(signupSessionId);
  }

  @Post('complete')
  complete(@Body() dto: CompleteSignupDto) {
    return this.signupService.completeSignup(dto);
  }
}
