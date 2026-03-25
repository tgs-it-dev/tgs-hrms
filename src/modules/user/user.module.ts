import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Role } from 'src/entities/role.entity';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';
import { FileUploadService } from './services/file-upload.service';
import { AuthModule } from '../auth/auth.module';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    AuthModule,
    SharedJwtModule,
  ],
  controllers: [UserController, ProfileController],
  providers: [UserService, ProfileService, FileUploadService],
  exports: [UserService, ProfileService, FileUploadService],
})
export class UserModule {}