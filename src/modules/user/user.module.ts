
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Role } from 'src/entities/role.entity'; 
import { CommonModule } from '../../common/common.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), CommonModule],
  controllers: [UserController,ProfileController],
  providers: [UserService,ProfileService],
})
export class UserModule {}
