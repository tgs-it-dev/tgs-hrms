import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Role } from '../../entities/role.entity';
import { Tenant } from '../../entities/tenant.entity';
import { PassportModule } from '@nestjs/passport';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { TokenValidationModule } from '../../common/modules/token-validation.module';
import { LoggerModule } from '../../common/logger/logger.module';
import { EmailModule } from '../../common/utils/email/email.module';
import { InviteStatusModule } from '../invite-status/invite-status.module';
import { Employee } from 'src/entities/employee.entity';
import { SignupSession } from 'src/entities/signup-session.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, CompanyDetails, Employee, SignupSession, Role, Tenant]),
    PassportModule,
    SharedJwtModule,
    TokenValidationModule,
    LoggerModule,
    EmailModule,
    InviteStatusModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
