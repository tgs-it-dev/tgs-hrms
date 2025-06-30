import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: typeOrmConfig,
      inject: [ConfigService],
    }),
    // ThrottlerModule is used to globally rate limit API requests for security and performance.
    // Here, we set a limit of 5 requests per minute (60,000 ms) per IP address.
    // This helps prevent brute-force attacks and abuse of sensitive endpoints like login.
    ThrottlerModule.forRoot({
      throttlers: [
        { ttl: 60_000, limit: 5 },
      ],
    }),
    UserModule,
    AuthModule,
  ],
})
export class AppModule {}
