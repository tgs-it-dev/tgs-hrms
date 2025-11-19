import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Role } from '../../entities/role.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtMiddleware, JwtAuthGuard, JwtTokenValidator } from '../../common/middleware/jwt.middleware';
import { EmailService, SendGridService } from '../../common/utils/email';
import { InviteStatusModule } from '../invite-status/invite-status.module';
import { Employee } from 'src/entities/employee.entity';
import { SignupSession } from 'src/entities/signup-session.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([User, CompanyDetails, Employee, SignupSession, Role]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
    }),
    InviteStatusModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtMiddleware, JwtAuthGuard, JwtTokenValidator, EmailService, SendGridService],
  exports: [AuthService], 
})
export class AuthModule {}