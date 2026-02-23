/**
 * Middleware Configuration
 * Global middleware setup for the application
 */

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { jwtMiddleware } from './jwt.middleware';
import { TokenValidationModule } from '../modules/token-validation.module';

@Module({
  imports: [TokenValidationModule],
})
export class MiddlewareConfigModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply JWT middleware (Passport JwtStrategy) to all routes except auth/public
    consumer
      .apply(jwtMiddleware)
      .exclude(
        'auth/login',
        'auth/register',
        'auth/forgot-password',
        'auth/reset-password',
        'auth/verify-email',
        'auth/resend-verification',
        'auth/refresh',
        'auth/logout',
        { path: 'users/:id/profile-picture', method: RequestMethod.GET },
        // Public static assets (serve without auth)
        { path: 'profile-pictures/(.*)', method: RequestMethod.GET },
        { path: 'cnic-pictures/(.*)', method: RequestMethod.GET },
        { path: 'cnic-back-pictures/(.*)', method: RequestMethod.GET },
        { path: 'company-logos/(.*)', method: RequestMethod.GET },
        // Allow unauthenticated access to signup flow
        'signup/personal-details',
        'signup/company-details',
        'signup/upload-logo',
        'signup/payment',
        'signup/payment/confirm',
        'signup/complete',
        'signup/google-init',
        'subscription-plans',
        'subscription-plans/prices',
        'health',
        'docs',
        'api-docs',
      )
      .forRoutes('*');
  }
}
 