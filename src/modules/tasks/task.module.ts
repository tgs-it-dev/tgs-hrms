import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../../entities/task.entity';
import { TaskHistory } from '../../entities/task-history.entity';
import { Employee } from '../../entities/employee.entity';
import { Team } from '../../entities/team.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { SharedJwtModule } from '../../common/modules/jwt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskHistory, Employee, Team]),
    SharedJwtModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}

