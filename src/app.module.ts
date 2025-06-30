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

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { UserModule } from './modules/user/user.module';
import { DepartmentModule } from './modules/department/department.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
  controllers: [AppController],

  providers: [
    AppService,
    // { provide: APP_GUARD, useClass: JwtAuthGuard },  // must be first
    // { provide: APP_GUARD, useClass: TenantGuard },   // checks tenantId
    // { provide: APP_GUARD, useClass: RolesGuard },    // checks @Roles()
  ],
})
export class AppModule {}
