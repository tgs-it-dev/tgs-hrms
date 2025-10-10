import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../../entities/role.entity';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role]),
    SharedJwtModule,
  ],
  providers: [RoleService],
  controllers: [RoleController],
})
export class RoleModule {}
