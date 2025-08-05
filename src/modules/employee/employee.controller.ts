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

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/company.deorator';


@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create employee by assigning user to designation' })
  @ApiResponse({ status: 201, description: 'Employee created.' })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid user or designation.',
    schema: {
      example: {
        message: 'Invalid user for this tenant.',
        error: 'Bad Request',
        statusCode: 400
      }
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: 'User is already an employee in this tenant.',
    schema: {
      example: {
        message: 'User is already an employee in this tenant.',
        error: 'Conflict',
        statusCode: 409
      }
    }
  })
  async create(
    @TenantId() tenant_id: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.service.create(tenant_id, dto);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update employee designation' })
  @ApiResponse({ status: 200, description: 'Employee updated.' })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid designation.',
    schema: {
      example: {
        message: 'Invalid designation ID',
        error: 'Bad Request',
        statusCode: 400
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
  async update(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.update(tenant_id, id, dto);
  }

 @Get()
@ApiOperation({ summary: 'List all employees for tenant with optional designation and department filters' })
@ApiQuery({ 
  name: 'designation_id', 
  required: false, 
  description: 'Filter employees by designation ID',
  example: '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c'
})
@ApiQuery({ 
  name: 'department_id', 
  required: false, 
  description: 'Filter employees by department ID',
  example: '3fa85f64-5717-4562-b3fc-2c963f66afa6'
})
@ApiResponse({ 
  status: 200, 
  description: 'List of employees matching optional filters.' 
})
@ApiResponse({ 
  status: 400, 
  description: 'Invalid query parameters.',
  schema: {
    example: {
      message: 'Invalid designation ID or department ID',
      error: 'Bad Request',
      statusCode: 400
    }
  }
})
async findAll(
  @TenantId() tenant_id: string,
  @Query() query: EmployeeQueryDto
) {
  return this.service.findAll(tenant_id, query);
}


  @Get(':id')
  @ApiOperation({ summary: 'Get single employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee found.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async findOne(@TenantId() tenant_id: string, @Param('id') id: string) {
    return this.service.findOne(tenant_id, id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee deleted.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  async remove(@TenantId() tenant_id: string, @Param('id') id: string) {
    return this.service.remove(tenant_id, id);
  }
}
