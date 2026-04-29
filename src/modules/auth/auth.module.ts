import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthTokenCleanupService } from "./auth-token-cleanup.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity";
import { CompanyDetails } from "../../entities/company-details.entity";
import { Role } from "../../entities/role.entity";
import { Tenant } from "../../entities/tenant.entity";
import { UserToken } from "../../entities/user-token.entity";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EmailService, SendGridService } from "../../common/utils/email";
import { InviteStatusModule } from "../invite-status/invite-status.module";
import { Employee } from "../../entities/employee.entity";
import { SignupSession } from "../../entities/signup-session.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      CompanyDetails,
      Employee,
      SignupSession,
      Role,
      Tenant,
      UserToken,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: config.get<string>("JWT_EXPIRES_IN") ?? "24h",
        },
      }),
    }),
    InviteStatusModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenCleanupService,
    EmailService,
    SendGridService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
