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
    ],
})
export class AppModule {}
