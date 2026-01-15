import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TaskStatus } from '../../common/constants/enums';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager', 'hr-admin', 'admin', 'system-admin')
  @Permissions('task.create')
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() dto: CreateTaskDto, @Request() req: any) {
    return this.taskService.createTask(
      req.user.id,
      req.user.tenant_id,
      dto,
      req.user.role,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks (role-based filtering)' })
  @ApiQuery({ name: 'status', enum: TaskStatus, required: false })
  @ApiQuery({ name: 'team_id', type: String, required: false })
  @ApiQuery({ name: 'assigned_to', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'List of tasks' })
  async findAll(
    @Query('status') status?: TaskStatus,
    @Query('team_id') team_id?: string,
    @Query('assigned_to') assigned_to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.taskService.findAll(req.user.id, req.user.tenant_id, req.user.role, {
      status,
      team_id,
      assigned_to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('workload-distribution')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('hr-admin', 'admin', 'system-admin')
  @Permissions('task.read')
  @ApiOperation({ summary: 'Get workload distribution (HR Admin only)' })
  @ApiQuery({ name: 'team_id', type: String, required: false })
  @ApiQuery({ name: 'status', enum: TaskStatus, required: false })
  @ApiResponse({ status: 200, description: 'Workload distribution data' })
  async getWorkloadDistribution(
    @Query('team_id') team_id?: string,
    @Query('status') status?: TaskStatus,
    @Request() req?: any,
  ) {
    return this.taskService.getWorkloadDistribution(req.user.tenant_id, {
      team_id,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single task by ID' })
  @ApiResponse({ status: 200, description: 'Task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.taskService.findOne(id, req.user.id, req.user.tenant_id, req.user.role);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get task history' })
  @ApiResponse({ status: 200, description: 'Task history' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTaskHistory(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.taskService.getTaskHistory(
      id,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager', 'hr-admin', 'admin', 'system-admin')
  @Permissions('task.update')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @Request() req: any,
  ) {
    return this.taskService.updateTask(
      id,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      dto,
    );
  }

  @Patch(':id/assign')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager', 'hr-admin', 'admin', 'system-admin')
  @Permissions('task.update')
  @ApiOperation({ summary: 'Assign or unassign a task' })
  @ApiResponse({ status: 200, description: 'Task assigned successfully' })
  @ApiResponse({ status: 404, description: 'Task or employee not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTaskDto,
    @Request() req: any,
  ) {
    return this.taskService.assignTask(
      id,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      dto,
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status' })
  @ApiResponse({ status: 200, description: 'Task status updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
    @Request() req: any,
  ) {
    return this.taskService.updateTaskStatus(
      id,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      dto,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('manager', 'hr-admin', 'admin', 'system-admin')
  @Permissions('task.delete')
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.taskService.deleteTask(
      id,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
    );
    return { message: 'Task deleted successfully' };
  }
}

