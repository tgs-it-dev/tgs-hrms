/**
 * Middleware Configuration
 * Global middleware setup for the application
 */

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { jwtMiddleware } from './jwt.middleware';
import { TokenValidationModule } from '../modules/token-validation.module';
import { AUTH_ROUTES, PUBLIC_ROUTES } from '../constants';

@Module({
  imports: [TokenValidationModule],
})
export class MiddlewareConfigModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(jwtMiddleware)
      .exclude(
        AUTH_ROUTES.LOGIN,
        AUTH_ROUTES.REGISTER,
        AUTH_ROUTES.FORGOT_PASSWORD,
        AUTH_ROUTES.RESET_PASSWORD,
        AUTH_ROUTES.VERIFY_EMAIL,
        AUTH_ROUTES.RESEND_VERIFICATION,
        AUTH_ROUTES.REFRESH,
        AUTH_ROUTES.LOGOUT,
        { path: PUBLIC_ROUTES.PROFILE_PICTURE_GET, method: RequestMethod.GET },
        { path: PUBLIC_ROUTES.PROFILE_PICTURES, method: RequestMethod.GET },
        { path: PUBLIC_ROUTES.CNIC_PICTURES, method: RequestMethod.GET },
        { path: PUBLIC_ROUTES.CNIC_BACK_PICTURES, method: RequestMethod.GET },
        { path: PUBLIC_ROUTES.COMPANY_LOGOS, method: RequestMethod.GET },
        PUBLIC_ROUTES.SIGNUP_PERSONAL,
        PUBLIC_ROUTES.SIGNUP_COMPANY,
        PUBLIC_ROUTES.SIGNUP_UPLOAD_LOGO,
        PUBLIC_ROUTES.SIGNUP_PAYMENT,
        PUBLIC_ROUTES.SIGNUP_PAYMENT_CONFIRM,
        PUBLIC_ROUTES.SIGNUP_COMPLETE,
        PUBLIC_ROUTES.SIGNUP_GOOGLE,
        PUBLIC_ROUTES.SUBSCRIPTION_PLANS,
        PUBLIC_ROUTES.SUBSCRIPTION_PLANS_PRICES,
        PUBLIC_ROUTES.HEALTH,
        PUBLIC_ROUTES.DOCS,
        PUBLIC_ROUTES.API_DOCS,
      )
      .forRoutes('*');
  }
}
