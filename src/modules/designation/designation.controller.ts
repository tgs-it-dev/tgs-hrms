import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DesignationService } from './designation.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/company.deorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Designations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
@Controller('designations')
export class DesignationController {
  constructor(private service: DesignationService) {}

  @Post()
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('manage_designations')
  @ApiOperation({ summary: 'Create designation' })
  @ApiResponse({ status: 201, description: 'Designation created.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Title already exists in this department.',
    schema: {
      example: {
        statusCode: 409,
        message: 'Designation with this title already exists in this department',
        error: 'Conflict',
      },
    },
  })
  async create(@TenantId() tenant_id: string, @Body() dto: CreateDesignationDto) {
    return this.service.create(tenant_id, dto);
  }

  @Put(':id')
  @Roles('admin', 'system-admin' , 'hr-admin')
  @Permissions('manage_designations')
  @ApiOperation({ summary: 'Update designation' })
  @ApiResponse({ status: 200, description: 'Designation updated.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: Title already exists in this department.',
    schema: {
      example: {
        statusCode: 409,
        message: "Title 'Manager' already exists in this department.",
        error: 'Conflict',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async update(@Param('id') id: string, @Body() dto: UpdateDesignationDto) {
    return this.service.update(id, dto);
  }

  
  @Get('all-tenants')
  @Roles('system-admin')
  @ApiOperation({ summary: 'Get all designations across all tenants with tenant filter (System Admin only)' })
  @ApiQuery({
    name: 'tenant_id',
    required: false,
    description: 'Optional tenant ID to filter by',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns all designations grouped by tenant with department information',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - System admin access required',
  })
  async getAllDesignationsAcrossTenants(
    @Query('tenant_id') tenantId?: string
  ) {
    return this.service.getAllDesignationsAcrossTenants(tenantId);
  }

  @Get('department/:departmentId')
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('manage_designations')
  @ApiOperation({ summary: 'List designations under a department' })
  @ApiResponse({ status: 200, description: 'List of designations.' })
  async findAllByDepartment(
    @Param('departmentId') departmentId: string,
    @Query('page') page?: string
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.service.findAllByDepartment(departmentId, pageNumber);
  }

  @Get(':id')
  @Roles('admin', 'system-admin', 'hr-admin', 'manager')
  @Permissions('manage_designations')
  @ApiOperation({ summary: 'Get a single designation' })
  @ApiResponse({ status: 200, description: 'Designation found.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('manage_designations')
  @ApiOperation({ summary: 'Delete a designation' })
  @ApiResponse({ status: 200, description: 'Designation deleted.' })
  @ApiResponse({ status: 404, description: 'Designation not found.' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
