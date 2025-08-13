import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
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

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private service: DepartmentService) {}

  @Post()
  @Roles('admin', 'system-admin')
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
  async create(@Req() req, @Body() dto: CreateDepartmentDto) {
    const tenant_id = req.user.tenant_id;
    return await this.service.create(tenant_id, dto);
  }

  @Put(':id')
  @Roles('admin', 'system-admin')
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
  async update(@Req() req, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    const tenant_id = req.user.tenant_id;
    return await this.service.update(tenant_id, id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all departments for tenant' })
  @ApiResponse({ status: 200, description: 'List of departments returned.' })
  async findAll(@Req() req) {
    const tenant_id = req.user.tenant_id;
    return await this.service.findAll(tenant_id);
  }

  @Get(':id')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiResponse({ status: 200, description: 'Department found.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async findOne(@Req() req, @Param('id') id: string) {
    const tenant_id = req.user.tenant_id;
    return await this.service.findOne(tenant_id, id);
  }

  @Delete(':id')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Delete department' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  async remove(@Req() req, @Param('id') id: string) {
    const tenant_id = req.user.tenant_id;
    return await this.service.remove(tenant_id, id);
  }
}
