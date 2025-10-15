import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SignupController } from "./signup.controller";
import { SignupService } from "./signup.service";
import { SignupSession } from "../../entities/signup-session.entity";
import { CompanyDetails } from "../../entities/company-details.entity";
import { Tenant } from "../../entities/tenant.entity";
import { User } from "../../entities/user.entity";
import { Role } from "../../entities/role.entity";
import { SubscriptionPlan } from "../../entities/subscription-plan.entity";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SignupSession,
      CompanyDetails,
      Tenant,
      User,
      Role,
      SubscriptionPlan,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "default_secret",
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    }),
  ],
  controllers: [SignupController],
  providers: [SignupService],
})
export class SignupModule {}
