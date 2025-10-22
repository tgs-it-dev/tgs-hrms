import { Module, Logger, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { MiddlewareConfigModule } from './common/middleware/middleware.config';
import { EmailModule } from './common/utils/email/email.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentModule } from './modules/department/department.module';
import { DesignationModule } from './modules/designation/designation.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionModule } from './modules/permission/permission.module';
import { AttendanceModule } from './modules/attendance/attendace.module';
import { TimesheetModule } from './modules/timesheet/timesheet.module';
import { LeaveModule } from './modules/leave/leave.module';
import { LeaveTypeModule } from './modules/leave-type/leave-type.module';
import { LeaveReportsModule } from './modules/reports/leave-reports.module';
import { PolicyModule } from './modules/policy/policy.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TeamModule } from './modules/team/team.module';
import { SignupModule } from './modules/signup/signup.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { CompanyModule } from './modules/company/company.module';
import { AssetModule } from './modules/asset/asset.module';
import { AssetRequestModule } from './modules/asset-request/asset-request.module';
import { AssetSubcategoryModule } from './modules/asset-subcategory/asset-subcategory.module';
import { BenefitsModule } from "./modules/benefits/benefits.module";
import { PmsModule } from './modules/pms/pms.module';
@Module({
  imports: [
    ScheduleModule.forRoot(),

    ConfigModule.forRoot({ isGlobal: true }),
    MiddlewareConfigModule,
    EmailModule,

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

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
        return {
          secret,
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h'),
          },
        };
      },
    }),

  
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('MailerModule');
        const sendgridApiKey = config.get<string>('SENDGRID_API_KEY');
        const sendgridFrom = config.get<string>('SENDGRID_FROM');

        
        if (!sendgridApiKey || !sendgridFrom) {
          logger.warn('SendGrid configuration incomplete. Using fallback configuration.');
          logger.warn('Required: SENDGRID_API_KEY, SENDGRID_FROM');
          
          
          return {
            transport: {
              service: 'sendgrid',
              auth: {
                api_key: 'dummy-key',
              },
            },
            defaults: {
              from: 'noreply@example.com',
            },
            template: {
              dir: join(process.cwd(), 'src', 'templates'),
              adapter: new HandlebarsAdapter(),
              options: {
                strict: true,
              },
            },
          };
        }

        return {
          transport: {
            service: 'sendgrid',
            auth: {
              api_key: sendgridApiKey,
            },
          },
          defaults: {
            from: sendgridFrom,
          },
          template: {
            dir: join(process.cwd(), 'src', 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),

    
    UserModule,
    AuthModule,
    DepartmentModule,
    DesignationModule,
    EmployeeModule,
    TenantModule,
    RoleModule,
    PermissionModule,
    AttendanceModule,
    TimesheetModule,
    PolicyModule,
    LeaveModule,
    LeaveTypeModule,
    LeaveReportsModule,
    ReportsModule,
    TeamModule,
    SignupModule,
    SubscriptionModule,
    CompanyModule,
    AssetModule,
    AssetRequestModule,
    AssetSubcategoryModule,
    BenefitsModule,
    PmsModule
  ],
})
export class AppModule {}
