/**
 * Provides token validation and JWT guard/middleware.
 * Global so any module can use JwtAuthGuard without importing AuthModule.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TokenValidationService } from '../services/token-validation.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtMiddleware } from '../middleware/jwt.middleware';
import { SharedJwtModule } from './jwt.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant]),
    SharedJwtModule,
  ],
  providers: [TokenValidationService, JwtAuthGuard, JwtMiddleware],
  exports: [TokenValidationService, JwtAuthGuard, JwtMiddleware],
})
export class TokenValidationModule {}
