import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from '../../entities/team.entity';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Employee, User])],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
