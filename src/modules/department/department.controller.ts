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
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from 'src/common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/company.deorator';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private service: DepartmentService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create department' })
  @ApiResponse({ status: 201, description: 'Department created.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Department name must be unique.',
    schema: {
      example: {
        statusCode: 409,
        message: 'Department with this name already exists in your company',
        error: 'Conflict',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  async create(
    @TenantId() tenant_id: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return await this.service.create(tenant_id, dto);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update department' })
  @ApiResponse({ status: 200, description: 'Department updated.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Duplicate department name',
    schema: {
      example: {
        statusCode: 409,
        message: "Department name 'HR' already exists for this tenant.",
        error: 'Conflict',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async update(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return await this.service.update(tenant_id, id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all departments for tenant' })
  @ApiResponse({ status: 200, description: 'List of departments returned.' })
  async findAll(@TenantId() tenant_id: string) {
    return await this.service.findAll(tenant_id);
  }

  @Get(':id')
  @Roles('admin') // Optional: restrict by role
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiResponse({ status: 200, description: 'Department found.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async findOne(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
  ) {
    return await this.service.findOne(tenant_id, id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete department' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async remove(
    @TenantId() tenant_id: string,
    @Param('id') id: string,
  ) {
    return await this.service.remove(tenant_id, id);
  }
}
