import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from './email.service';
import { SendGridService } from './sendgrid.service';
import { InviteStatusModule } from '../invite-status/invite-status.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CompanyDetails]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
    }),
    InviteStatusModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailService, SendGridService],
  exports: [AuthService], 
})
export class AuthModule {}