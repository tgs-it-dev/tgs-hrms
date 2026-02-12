/**
 * JWT Module (common)
 * Provides JwtHelperService for the entire project. No auth-specific deps.
 */

import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtHelperService } from '../jwt/jwt-helper.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default_secret',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
        },
      }),
    }),
    ConfigModule,
  ],
  providers: [JwtHelperService],
  exports: [JwtModule, ConfigModule, JwtHelperService],
})
export class SharedJwtModule {}
