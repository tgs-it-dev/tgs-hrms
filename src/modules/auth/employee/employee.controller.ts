import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { TenantGuard } from '../../../common/guards/company.guard';
import { TenantId } from '../../../common/decorators/company.deorator';


@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create employee' })
  @ApiResponse({ status: 201, description: 'Employee created.' })
  @ApiResponse({ status: 400, description: 'Invalid department or designation.' })
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update employee' })
  @ApiResponse({ status: 200, description: 'Employee updated.' })
  @ApiResponse({ status: 400, description: 'Invalid department or designation.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all employees for tenant' })
  @ApiResponse({ status: 200, description: 'List of employees.' })
  async findAll(@TenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee found.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee deleted.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }
}
