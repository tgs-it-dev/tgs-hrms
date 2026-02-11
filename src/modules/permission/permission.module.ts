import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../../entities/permission.entity';
import { PermissionController } from './permission.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permission]),
    SharedJwtModule,
  ],
  providers: [],
  controllers: [PermissionController],
})
export class PermissionModule {}
