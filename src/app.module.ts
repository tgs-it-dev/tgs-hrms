import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { DepartmentModule } from './modules/department/department.module';
import { DesignationModule } from './modules/user/designation/designation.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    
    ConfigModule.forRoot({ isGlobal: true }),

    
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: typeOrmConfig,
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET not found');
        console.log(' JWT_SECRET in AppModule:', secret);
        return {
          secret,
          signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
        };
      },
    }),

    
    UserModule,
    AuthModule,
    DesignationModule,
    DepartmentModule
  ],
  controllers: [AppController],

  providers: [
    AppService,
    ],
})
export class AppModule {}
