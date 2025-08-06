import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../../entities/permission.entity';
import { PermissionController } from './permission.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permission]),
  ],
  providers: [],
  controllers: [PermissionController],
})
export class PermissionModule {} 