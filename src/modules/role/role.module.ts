import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../../entities/role.entity';
import { RoleController } from './role.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role]),
  ],
  providers: [],
  controllers: [RoleController],
})
export class RoleModule {} 