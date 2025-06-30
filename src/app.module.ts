// import { Module } from '@nestjs/common';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { typeOrmConfig } from './config/typeorm.config';
// import { UserModule } from './modules/user/user.module';
// import { DepartmentModule } from './modules/department/department.module';
// import { AuthModule } from './auth/auth.module';
// @Module({
//   imports: [
//     ConfigModule.forRoot({ isGlobal: true }),
//     TypeOrmModule.forRootAsync({
//       imports: [ConfigModule],
//       useFactory: typeOrmConfig,
//       inject: [ConfigService],
//     }),
//     UserModule,
//     DepartmentModule,
//     AuthModule,
//   ],
// })
// export class AppModule {}


// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { typeOrmConfig } from './config/typeorm.config';
import { UserModule } from './modules/user/user.module';
import { DepartmentModule } from './modules/department/department.module';
import { AuthModule } from './auth/auth.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/company.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    // 1️⃣ Global .env configuration
    ConfigModule.forRoot({ isGlobal: true }),

    // 2️⃣ Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: typeOrmConfig,
      inject: [ConfigService],
    }),

    // 3️⃣ Feature modules
    UserModule,
    DepartmentModule,
    AuthModule,
  ],

  // 4️⃣ Global guards (order matters)
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },  // must be first
    { provide: APP_GUARD, useClass: TenantGuard },   // checks tenantId
    { provide: APP_GUARD, useClass: RolesGuard },    // checks @Roles()
  ],
})
export class AppModule {}
