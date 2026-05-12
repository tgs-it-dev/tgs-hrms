import {
  Body,
  Controller,
  Post,
  Query,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Feature } from '../../common/decorators/feature.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import { SignupService } from './signup.service';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { CompanyDetailsDto } from './dto/company-details.dto';
import { PaymentDto } from './dto/payment.dto';
import { CompleteSignupDto } from './dto/complete-signup.dto';
import { GoogleSignupInitDto } from './dto/google-signup-init.dto';
import { CompanyLogoDto } from './dto/company-logo.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { createImageFileFilter } from '../common/utils/file-validation.util';

@ApiTags('Signup')
@Controller('signup')
@Public()
@Feature('signup')
@UseGuards(FeatureGuard)
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
  async startPayment(@Body() paymentDto: PaymentDto) {
    return this.signupService.startPayment(paymentDto);
  }
  @Post('payment/confirm')
  confirmPayment(
    @Body()
    body: { signupSessionId?: string; checkoutSessionId?: string } | undefined,
    @Query('signupSessionId') signupSessionIdQuery?: string,
    @Query('checkoutSessionId') checkoutSessionIdQuery?: string,
    @Query('session_id') sessionIdFromStripe?: string,
  ) {
    const signupSessionId = body?.signupSessionId || signupSessionIdQuery;
    const checkoutSessionId =
      body?.checkoutSessionId || checkoutSessionIdQuery || sessionIdFromStripe;

    if (!signupSessionId) {
      throw new BadRequestException(
        'signupSessionId is required (in body or query)',
      );
    }

    return this.signupService.markPaymentSuccess(
      signupSessionId,
      checkoutSessionId,
    );
  }

  @Post('upload-logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        signupSessionId: {
          type: 'string',
        },
      },
      required: ['file', 'signupSessionId'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: createImageFileFilter(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CompanyLogoDto,
  ) {
    return this.signupService.saveCompanyLogo(dto.signupSessionId, file);
  }

  @Post('complete')
  complete(@Body() dto: CompleteSignupDto) {
    return this.signupService.completeSignup(dto);
  }

  @Post('google-init')
  googleInit(@Body() dto: GoogleSignupInitDto) {
    return this.signupService.googleSignupInit(dto);
  }
}
