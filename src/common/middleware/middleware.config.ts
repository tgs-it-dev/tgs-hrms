/**
 * Middleware Configuration
 * Global middleware setup for the application
 */

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtMiddleware } from './jwt.middleware';
import { SharedJwtModule } from '../modules/jwt.module';

@Module({
  imports: [SharedJwtModule],
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
        'health',
        'docs',
        'api-docs',
      )
      .forRoutes('*');
  }
}
