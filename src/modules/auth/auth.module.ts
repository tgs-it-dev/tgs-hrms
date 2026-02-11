import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Role } from '../../entities/role.entity';
import { Tenant } from '../../entities/tenant.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TokenValidationModule } from '../../common/modules/token-validation.module';
import { EmailModule } from '../../common/utils/email/email.module';
import { InviteStatusModule } from '../invite-status/invite-status.module';
import { Employee } from 'src/entities/employee.entity';
import { SignupSession } from 'src/entities/signup-session.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, CompanyDetails, Employee, SignupSession, Role, Tenant]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
    }),
    SharedJwtModule,
    TokenValidationModule,
    EmailModule,
    InviteStatusModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
