/**
 * Provides JWT auth via Passport (JwtStrategy), token validation, and guard.
 * Global so any module can use JwtAuthGuard without importing AuthModule.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TokenValidationService } from '../services/token-validation.service';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SharedJwtModule } from './jwt.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    SharedJwtModule,
  ],
  providers: [TokenValidationService, JwtStrategy, JwtAuthGuard],
  exports: [TokenValidationService, JwtAuthGuard],
})
export class TokenValidationModule {}
