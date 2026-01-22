import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { Employee } from '../../entities/employee.entity';
import { Team } from '../../entities/team.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, Employee, Team]),
    JwtModule,
    ConfigModule,
    AuthModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
