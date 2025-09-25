import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Role } from 'src/entities/role.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { FileUploadService } from './file-upload.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    AuthModule
  ],
  controllers: [UserController, ProfileController],
  providers: [UserService, ProfileService, FileUploadService],
})
export class UserModule {}