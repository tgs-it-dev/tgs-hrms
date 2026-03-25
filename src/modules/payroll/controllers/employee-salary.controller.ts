import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { EmployeeSalaryService } from '../services/employee-salary.service';
import { CreateEmployeeSalaryDto, UpdateEmployeeSalaryDto } from '../dto/employee-salary.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../../entities/employee.entity';

@ApiTags('Employee Salary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('payroll/salary')
export class EmployeeSalaryController {
  constructor(
    private readonly employeeSalaryService: EmployeeSalaryService,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  @Post()
  @Roles('admin', 'hr-admin')
  @ApiOperation({ summary: 'Assign salary structure to employee' })
  @ApiResponse({ status: 201, description: 'Salary structure assigned successfully.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async create(@Req() req: any, @Body() dto: CreateEmployeeSalaryDto) {
    const userRole = req.user.role?.toLowerCase();
    if (userRole === 'system-admin') {
      throw new ForbiddenException('System admin cannot create employee salary');
    }
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    return await this.employeeSalaryService.create(tenantId, userId, dto);
  }

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Get salary structure of all employees (Paginated)' })
  @ApiResponse({ status: 200, description: 'Salary structures retrieved successfully.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 25, max: 100)' })
  async getAll(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const tenantId = req.user.tenant_id;
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '25', 10) || 25));
    return await this.employeeSalaryService.getAllEmployeeSalaries(tenantId, pageNumber, limitNumber);
  }

  @Get(':employeeId')
  @Roles('admin', 'system-admin', 'hr-admin', 'employee', 'manager')
  @ApiOperation({ summary: 'Get active salary structure for employee' })
  @ApiResponse({ status: 200, description: 'Salary structure retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Salary structure not found.' })
  async getByEmployeeId(@Req() req: any, @Param('employeeId') employeeId: string) {
    const tenantId = req.user.tenant_id;
    const userRole = req.user.role;
    const userId = req.user.id;

    
    if (userRole === 'employee') {
      const employee = await this.employeeRepo.findOne({
        where: { id: employeeId },
      });
      if (!employee || employee.user_id !== userId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return await this.employeeSalaryService.getByEmployeeId(employeeId, tenantId);
  }

  @Get(':employeeId/history')
  @Roles('admin', 'system-admin', 'hr-admin', 'employee', 'manager')
  @ApiOperation({ summary: 'Get salary history for employee' })
  @ApiResponse({ status: 200, description: 'Salary history retrieved successfully.' })
  async getSalaryHistory(@Req() req: any, @Param('employeeId') employeeId: string) {
    const tenantId = req.user.tenant_id;
    const userRole = req.user.role;
    const userId = req.user.id;

    
    if (userRole === 'employee') {
      const employee = await this.employeeRepo.findOne({
        where: { id: employeeId },
      });
      if (!employee || employee.user_id !== userId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return await this.employeeSalaryService.getSalaryHistory(employeeId, tenantId);
  }

  @Put(':employeeId')
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Update employee salary structure' })
  @ApiResponse({ status: 200, description: 'Salary structure updated successfully.' })
  @ApiResponse({ status: 404, description: 'Salary structure not found.' })
  async update(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateEmployeeSalaryDto,
  ) {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    return await this.employeeSalaryService.update(employeeId, tenantId, userId, dto);
  }
}

