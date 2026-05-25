import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../../entities/permission.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permission, RolePermission]),
    SharedJwtModule,
  ],
  providers: [PermissionService],
  controllers: [PermissionController],
  exports: [PermissionService],
})
export class PermissionModule {}
