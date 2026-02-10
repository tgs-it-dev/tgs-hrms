import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../../entities/permission.entity';
import { PermissionController } from './permission.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permission]),
    SharedJwtModule,
    AuthModule,
  ],
  providers: [],
  controllers: [PermissionController],
})
export class PermissionModule {}
