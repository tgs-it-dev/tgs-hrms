import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

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
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid department, designation, or missing required fields.',
    schema: {
      example: {
        message: 'Missing Fields Error',
        errors: [
          { field: 'email', message: 'Email is required' },
          { field: 'name', message: 'Name is required' }
        ]
      }
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Employee with this email already exists.',
    schema: {
      example: {
        message: 'Employee with this email already exists in this tenant.',
        error: 'Conflict',
        statusCode: 409
      }
    }
  })
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
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid department, designation, or missing required fields.',
    schema: {
      example: {
        message: 'Missing Fields Error',
        errors: [
          { field: 'email', message: 'Please provide a valid email address' }
        ]
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Employee not found.',
    schema: {
      example: {
        message: 'Employee not found',
        error: 'Not Found',
        statusCode: 404
      }
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Employee with this email already exists.',
    schema: {
      example: {
        message: 'Employee with this email already exists in this tenant.',
        error: 'Conflict',
        statusCode: 409
      }
    }
  })
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all employees for tenant with optional filters' })
  @ApiQuery({ 
    name: 'department_id', 
    required: false, 
    description: 'Filter employees by department ID',
    example: '3a275957-c811-4ebb-b9f1-481bd96e47d1'
  })
  @ApiQuery({ 
    name: 'designation_id', 
    required: false, 
    description: 'Filter employees by designation ID',
    example: '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c'
  })
  @ApiResponse({ status: 200, description: 'List of employees.' })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid department_id or designation_id',
    schema: {
      example: {
        message: 'Invalid department for this tenant.',
        error: 'Bad Request',
        statusCode: 400
      }
    }
  })
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: EmployeeQueryDto
  ) {
    return this.service.findAll(tenantId, query);
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
