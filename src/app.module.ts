import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentModule } from './modules/department/department.module';
import { DesignationModule } from './modules/designation/designation.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionModule } from './modules/permission/permission.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceModule } from './modules/attendance/attendace.module';
import { TimesheetModule } from './modules/timesheet/timesheet.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PolicyModule } from './modules/policy/policy.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TeamModule } from './modules/team/team.module';
import { HolidayModule } from './modules/holiday/holiday.module';

// Added imports for mailer
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

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
        console.log('JWT_SECRET in AppModule:', secret);
        return {
          secret,
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h'),
          },
        };
      },
    }),

    // ✅ Mailer Module configuration
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST'),
          port: config.get<number>('SMTP_PORT'),
          secure: false,
          auth: {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          },
        },
        defaults: {
          from: config.get<string>('SMTP_FROM'),
        },
        template: {
          dir: join(process.cwd(), 'src', 'templates'), // works in dev
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),

    // Existing modules
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
    ReportsModule,
    TeamModule,
    HolidayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
