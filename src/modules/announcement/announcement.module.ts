import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../../entities/announcement.entity';
import { User } from '../../entities/user.entity';
import { AnnouncementService } from './announcement.service';
import { AnnouncementController } from './announcement.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';
import { EmailModule } from '../../common/utils/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, User]),
    SharedJwtModule,
    EmailModule,
  ],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
