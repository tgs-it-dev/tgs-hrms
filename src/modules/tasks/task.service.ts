import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { Task } from '../../entities/task.entity';
import { TaskHistory } from '../../entities/task-history.entity';
import { Employee } from '../../entities/employee.entity';
import { Team } from '../../entities/team.entity';
import { TaskStatus } from '../../common/constants/enums';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(TaskHistory)
    private taskHistoryRepo: Repository<TaskHistory>,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Create a new task
   * Managers can create tasks for their team members
   * HR Admin can create tasks for any employee
   */
  async createTask(
    userId: string,
    tenantId: string,
    dto: CreateTaskDto,
    userRole: string,
  ): Promise<Task> {
    // Get the creator employee record
    const creatorEmployee = await this.employeeRepo.findOne({
      where: { user_id: userId },
      relations: ['team', 'user'],
    });

    if (!creatorEmployee || creatorEmployee.user.tenant_id !== tenantId) {
      throw new NotFoundException('Employee record not found');
    }

    // Validate assignment if provided
    if (dto.assigned_to) {
      const assignedEmployee = await this.employeeRepo.findOne({
        where: { id: dto.assigned_to },
        relations: ['team', 'user'],
      });

      if (!assignedEmployee) {
        throw new NotFoundException('Assigned employee not found');
      }

      // Check tenant match
      if (assignedEmployee.user.tenant_id !== tenantId) {
        throw new ForbiddenException('Cannot assign task to employee from different tenant');
      }

      // Manager can only assign to their team members
      if (userRole.toLowerCase() === 'manager') {
        const managerTeams = await this.teamRepo.find({
          where: { manager_id: userId },
        });

        const teamIds = managerTeams.map((t) => t.id);
        if (!assignedEmployee.team_id || !teamIds.includes(assignedEmployee.team_id)) {
          throw new ForbiddenException(
            'Managers can only assign tasks to employees in their teams',
          );
        }
      }
    }

    // Validate team assignment if provided
    if (dto.team_id) {
      const team = await this.teamRepo.findOne({
        where: { id: dto.team_id },
        relations: ['manager'],
      });

      if (!team) {
        throw new NotFoundException('Team not found');
      }

      if (team.manager.tenant_id !== tenantId) {
        throw new ForbiddenException('Team does not belong to this tenant');
      }

      // Manager can only assign to their own teams
      if (userRole.toLowerCase() === 'manager' && team.manager_id !== userId) {
        throw new ForbiddenException('Managers can only assign tasks to their own teams');
      }
    }

    const task = this.taskRepo.create({
      title: dto.title,
      description: dto.description,
      assigned_to: dto.assigned_to || null,
      team_id: dto.team_id || null,
      created_by: creatorEmployee.id,
      status: TaskStatus.PENDING,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      priority: dto.priority || null,
      tenant_id: tenantId,
    });

    return await this.taskRepo.save(task);
  }

  /**
   * Get all tasks with role-based filtering
   * HR Admin: All tasks in organization
   * Manager: Tasks for their team members
   * Employee: Only their assigned tasks
   */
  async findAll(
    userId: string,
    tenantId: string,
    userRole: string,
    filters?: {
      status?: TaskStatus;
      team_id?: string;
      assigned_to?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    items: Task[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 25;
    const skip = (page - 1) * limit;

    const query = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedEmployee', 'assignedEmployee')
      .leftJoinAndSelect('assignedEmployee.user', 'assignedUser')
      .leftJoinAndSelect('task.creator', 'creator')
      .leftJoinAndSelect('creator.user', 'creatorUser')
      .leftJoinAndSelect('task.team', 'team')
      .where('task.tenant_id = :tenantId', { tenantId });

    const roleLower = userRole.toLowerCase();

    // HR Admin: Can see all tasks
    if (roleLower === 'hr-admin' || roleLower === 'admin' || roleLower === 'system-admin') {
      // No additional filtering
    }
    // Manager: Can see tasks for their team members
    else if (roleLower === 'manager') {
      const managerTeams = await this.teamRepo.find({
        where: { manager_id: userId },
        select: ['id'],
      });

      const teamIds = managerTeams.map((t) => t.id);

      if (teamIds.length > 0) {
        // Get employee IDs in manager's teams
        const teamEmployees = await this.employeeRepo
          .createQueryBuilder('e')
          .select('e.id', 'id')
          .where('e.team_id IN (:...teamIds)', { teamIds })
          .getRawMany();

        const employeeIds = teamEmployees.map((emp) => emp.id);

        if (employeeIds.length > 0) {
          query.andWhere(
            '(task.assigned_to IN (:...employeeIds) OR task.team_id IN (:...teamIds))',
            { employeeIds, teamIds },
          );
        } else {
          // Manager has teams but no employees
          query.andWhere('1 = 0');
        }
      } else {
        // Manager has no teams
        query.andWhere('1 = 0');
      }
    }
    // Employee: Can only see their assigned tasks
    else {
      const employee = await this.employeeRepo.findOne({
        where: { user_id: userId },
      });

      if (!employee) {
        throw new NotFoundException('Employee record not found');
      }

      query.andWhere('task.assigned_to = :employeeId', { employeeId: employee.id });
    }

    // Apply filters
    if (filters?.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters?.team_id) {
      query.andWhere('task.team_id = :teamId', { teamId: filters.team_id });
    }

    if (filters?.assigned_to) {
      query.andWhere('task.assigned_to = :assignedTo', { assignedTo: filters.assigned_to });
    }

    const [items, total] = await query
      .orderBy('task.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get a single task by ID with role-based access control
   */
  async findOne(
    taskId: string,
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: [
        'assignedEmployee',
        'assignedEmployee.user',
        'creator',
        'creator.user',
        'team',
        'team.manager',
        'history',
        'history.changedByEmployee',
        'history.changedByEmployee.user',
      ],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.tenant_id !== tenantId) {
      throw new ForbiddenException('Task does not belong to this tenant');
    }

    // Check access permissions
    const roleLower = userRole.toLowerCase();

    // HR Admin: Can access all tasks
    if (roleLower === 'hr-admin' || roleLower === 'admin' || roleLower === 'system-admin') {
      return task;
    }

    // Manager: Can access tasks for their team members
    if (roleLower === 'manager') {
      const managerTeams = await this.teamRepo.find({
        where: { manager_id: userId },
        select: ['id'],
      });

      const teamIds = managerTeams.map((t) => t.id);

      // Check if task is assigned to a team managed by this manager
      if (task.team_id && teamIds.length > 0 && teamIds.includes(task.team_id)) {
        return task;
      }

      // Check if assigned employee is in manager's team
      if (task.assigned_to && teamIds.length > 0) {
        const assignedEmployee = await this.employeeRepo.findOne({
          where: { id: task.assigned_to },
        });

        if (assignedEmployee && assignedEmployee.team_id && teamIds.includes(assignedEmployee.team_id)) {
          return task;
        }
      }

      throw new ForbiddenException('You do not have permission to access this task');
    }

    // Employee: Can only access their assigned tasks
    const employee = await this.employeeRepo.findOne({
      where: { user_id: userId },
    });

    if (!employee) {
      throw new NotFoundException('Employee record not found');
    }

    if (task.assigned_to !== employee.id) {
      throw new ForbiddenException('You do not have permission to access this task');
    }

    return task;
  }

  /**
   * Update a task
   * Managers can update tasks for their team members
   * HR Admin can update any task
   */
  async updateTask(
    taskId: string,
    userId: string,
    tenantId: string,
    userRole: string,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.findOne(taskId, userId, tenantId, userRole);

    // Update fields
    if (dto.title !== undefined) {
      task.title = dto.title;
    }
    if (dto.description !== undefined) {
      task.description = dto.description;
    }
    if (dto.deadline !== undefined) {
      task.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }
    if (dto.priority !== undefined) {
      task.priority = dto.priority;
    }

    return await this.taskRepo.save(task);
  }

  /**
   * Assign or unassign a task
   * Managers can assign to their team members
   * HR Admin can assign to any employee
   */
  async assignTask(
    taskId: string,
    userId: string,
    tenantId: string,
    userRole: string,
    dto: AssignTaskDto,
  ): Promise<Task> {
    const task = await this.findOne(taskId, userId, tenantId, userRole);

    // Validate assignment if provided
    if (dto.assigned_to) {
      const assignedEmployee = await this.employeeRepo.findOne({
        where: { id: dto.assigned_to },
        relations: ['user', 'team'],
      });

      if (!assignedEmployee) {
        throw new NotFoundException('Assigned employee not found');
      }

      if (assignedEmployee.user.tenant_id !== tenantId) {
        throw new ForbiddenException('Cannot assign task to employee from different tenant');
      }

      // Manager can only assign to their team members
      if (userRole.toLowerCase() === 'manager') {
        const managerTeams = await this.teamRepo.find({
          where: { manager_id: userId },
        });

        const teamIds = managerTeams.map((t) => t.id);
        if (!assignedEmployee.team_id || !teamIds.includes(assignedEmployee.team_id)) {
          throw new ForbiddenException(
            'Managers can only assign tasks to employees in their teams',
          );
        }
      }

      task.assigned_to = dto.assigned_to;
    } else {
      // Unassign
      task.assigned_to = null;
    }

    // Handle team assignment
    if (dto.team_id !== undefined) {
      if (dto.team_id) {
        const team = await this.teamRepo.findOne({
          where: { id: dto.team_id },
          relations: ['manager'],
        });

        if (!team) {
          throw new NotFoundException('Team not found');
        }

        if (team.manager.tenant_id !== tenantId) {
          throw new ForbiddenException('Team does not belong to this tenant');
        }

        // Manager can only assign to their own teams
        if (userRole.toLowerCase() === 'manager' && team.manager_id !== userId) {
          throw new ForbiddenException('Managers can only assign tasks to their own teams');
        }

        task.team_id = dto.team_id;
      } else {
        task.team_id = null;
      }
    }

    return await this.taskRepo.save(task);
  }

  /**
   * Update task status
   * Employees can update their own task status
   * Managers can update status for their team members' tasks
   * HR Admin can update any task status
   */
  async updateTaskStatus(
    taskId: string,
    userId: string,
    tenantId: string,
    userRole: string,
    dto: UpdateTaskStatusDto,
  ): Promise<Task> {
    const task = await this.findOne(taskId, userId, tenantId, userRole);

    if (!task?.id) {
      throw new BadRequestException('Invalid task id');
    }

    const previousStatus = task.status;
    const newStatus = dto.status;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate employee (who changed the status)
      const employee = await queryRunner.manager.getRepository(Employee).findOne({
        where: { user_id: userId },
      });

      if (!employee) {
        throw new NotFoundException('Employee record not found');
      }

      // Save history atomically with the task update
      const historyRepo = queryRunner.manager.getRepository(TaskHistory);
      const history = historyRepo.create({
        // Use a minimal relation object to avoid accidentally persisting a fully-loaded graph
        task: { id: task.id } as Task,
        task_id: task.id, // explicit id
        previous_status: previousStatus,
        new_status: newStatus,
        changed_by: employee.id,
        remarks: dto.remarks ?? null,
      });

      await historyRepo.save(history);

      // Update task status
      task.status = newStatus;
      await queryRunner.manager.getRepository(Task).update(task.id, { status: newStatus });

      await queryRunner.commitTransaction();
      return task;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Delete a task
   * Managers can delete tasks for their team members
   * HR Admin can delete any task
   */
  async deleteTask(
    taskId: string,
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<void> {
    const task = await this.findOne(taskId, userId, tenantId, userRole);
    await this.taskRepo.remove(task);
  }

  /**
   * Get task history for a task
   */
  async getTaskHistory(
    taskId: string,
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<TaskHistory[]> {
    // First verify access to the task
    await this.findOne(taskId, userId, tenantId, userRole);

    return await this.taskHistoryRepo.find({
      where: { task_id: taskId },
      relations: ['changedByEmployee', 'changedByEmployee.user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get workload distribution (for HR Admin)
   */
  async getWorkloadDistribution(
    tenantId: string,
    filters?: { team_id?: string; status?: TaskStatus },
  ): Promise<{
    employeeWise: Array<{
      employee_id: string;
      employee_name: string;
      total_tasks: number;
      pending: number;
      in_progress: number;
      completed: number;
    }>;
    teamWise: Array<{
      team_id: string;
      team_name: string;
      total_tasks: number;
      pending: number;
      in_progress: number;
      completed: number;
    }>;
  }> {
    const query = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedEmployee', 'assignedEmployee')
      .leftJoinAndSelect('assignedEmployee.user', 'assignedUser')
      .leftJoinAndSelect('task.team', 'team')
      .where('task.tenant_id = :tenantId', { tenantId });

    if (filters?.team_id) {
      query.andWhere('task.team_id = :teamId', { teamId: filters.team_id });
    }

    if (filters?.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }

    const tasks = await query.getMany();

    // Employee-wise distribution
    const employeeMap = new Map<string, any>();
    tasks.forEach((task) => {
      if (task.assigned_to) {
        const key = task.assigned_to;
        if (!employeeMap.has(key)) {
          employeeMap.set(key, {
            employee_id: key,
            employee_name: `${task.assignedEmployee?.user?.first_name || ''} ${task.assignedEmployee?.user?.last_name || ''}`.trim(),
            total_tasks: 0,
            pending: 0,
            in_progress: 0,
            completed: 0,
          });
        }
        const emp = employeeMap.get(key);
        emp.total_tasks++;
        emp[task.status] = (emp[task.status] || 0) + 1;
      }
    });

    // Team-wise distribution
    const teamMap = new Map<string, any>();
    tasks.forEach((task) => {
      if (task.team_id) {
        const key = task.team_id;
        if (!teamMap.has(key)) {
          teamMap.set(key, {
            team_id: key,
            team_name: task.team?.name || 'Unknown',
            total_tasks: 0,
            pending: 0,
            in_progress: 0,
            completed: 0,
          });
        }
        const team = teamMap.get(key);
        team.total_tasks++;
        team[task.status] = (team[task.status] || 0) + 1;
      }
    });

    return {
      employeeWise: Array.from(employeeMap.values()),
      teamWise: Array.from(teamMap.values()),
    };
  }
}

