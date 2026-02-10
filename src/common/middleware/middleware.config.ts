/**
 * Middleware Configuration
 * Global middleware setup for the application
 */

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { JwtMiddleware } from './jwt.middleware';
import { SharedJwtModule } from '../modules/jwt.module';
import { AuthModule } from '../../modules/auth/auth.module';

@Module({
  imports: [SharedJwtModule, AuthModule],
  providers: [JwtMiddleware],
  exports: [JwtMiddleware],
})
export class MiddlewareConfigModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply JWT middleware to all routes except auth routes
    consumer
      .apply(JwtMiddleware)
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
 