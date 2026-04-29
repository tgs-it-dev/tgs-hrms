import { Body, Controller, Post, Query, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
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

@ApiTags('Signup')
@Controller('signup')
@Public()
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
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      const ext = (path.extname(file.originalname || '') || '').toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      if (!allowed.includes(ext)) {
        return cb(
          new BadRequestException(
            'Company logo: Only JPG, JPEG, PNG, GIF and WebP are accepted. Other formats (e.g. .jfif) are not allowed.',
          ),
          false,
        );
      }
      const mimetype = (file.mimetype || '').toLowerCase();
      const isImageMime = mimetype.startsWith('image/');
      const isGenericMime = !mimetype || mimetype === 'application/octet-stream';
      if (!isImageMime && !isGenericMime) {
        return cb(new BadRequestException('Only image files are allowed.'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CompanyLogoDto
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
