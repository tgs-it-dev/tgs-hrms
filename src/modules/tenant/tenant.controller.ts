import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Query,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { TenantService } from './tenant.service';
import { TenantSchemaProvisioningService } from './services/tenant-schema-provisioning.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantSchemaProvisioning: TenantSchemaProvisioningService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('system-admin')
  @Permissions('manage_tenants')
  @ApiOperation({ summary: 'Get all tenants (Admin only) - Paginated' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 25, max: 100)' })
  @ApiResponse({
    status: 200,
    description: 'List of tenants retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getTenants(@Query('page') page?: string, @Query('limit') limit?: string) {
    try {
      const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
      const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '25', 10) || 25));
      const result = await this.tenantService.findAll(pageNumber, limitNumber);
      return {
        statusCode: 200,
        message: 'List of tenants retrieved successfully.',
        ...result,
      };
    } catch (err) {
      throw new BadRequestException('Failed to fetch tenants');
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('system-admin')
  @Permissions('manage_tenants')
  @ApiOperation({ summary: 'Get tenant by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Tenant UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant retrieved successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Default Company',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  async getTenantById(@Param('id') id: string) {
    try {
      const tenant = await this.tenantService.findOne(id);
      return {
        statusCode: 200,
        message: 'Tenant retrieved successfully.',
        data: tenant,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException('Failed to fetch tenant');
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('system-admin')
  @Permissions('manage_tenants')
  @ApiOperation({ summary: 'Create a new tenant (Admin only)' })
  @ApiBody({ type: CreateTenantDto })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'New Company',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid tenant data',
  })
  async createTenant(@Body() createTenantDto: CreateTenantDto) {
    try {
      const tenant = await this.tenantService.create(createTenantDto);
      return {
        statusCode: 201,
        message: 'Tenant created successfully.',
        data: tenant,
      };
    } catch (err) {
      throw new BadRequestException('Failed to create tenant');
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('system-admin')
  @Permissions('manage_tenants')
  @ApiOperation({ summary: 'Update tenant by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Tenant UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: UpdateTenantDto })
  @ApiResponse({
    status: 200,
    description: 'Tenant updated successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  async updateTenant(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    try {
      const tenant = await this.tenantService.update(id, updateTenantDto);
      return {
        statusCode: 200,
        message: 'Tenant updated successfully.',
        data: tenant,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException('Failed to update tenant');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('system-admin')
  @ApiOperation({ summary: 'Delete tenant by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Tenant UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant deleted successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Tenant already deleted',
  })
  async deleteTenant(@Param('id') id: string) {
    try {
      await this.tenantService.remove(id);
      return {
        statusCode: 200,
        message: 'Tenant deleted successfully.',
        id,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if (err instanceof BadRequestException) throw err; // Already deleted case
      throw new BadRequestException('Failed to delete tenant');
    }
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('system-admin')
  @Permissions('manage_tenants')
  @ApiOperation({ summary: 'Restore a deleted tenant (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Tenant UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant restored successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Tenant is not deleted',
  })
  async restoreTenant(@Param('id') id: string) {
    try {
      const tenant = await this.tenantService.restore(id);
      return {
        statusCode: 200,
        message: 'Tenant restored successfully.',
        data: tenant,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Failed to restore tenant');
    }
  }

  @Post(':id/upgrade-schema')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('system-admin')
  @Permissions('manage_tenants')
  @ApiOperation({
    summary: 'Upgrade tenant schema to current layout (Admin only)',
    description:
      'Idempotent. Creates missing tables (departments, designations, teams, ' +
      'billing_transactions) and fixes employees FK constraints to point to the ' +
      'tenant schema instead of the public schema. Safe to run on Phase 1 schemas, ' +
      'already-upgraded schemas, or completely new schemas.',
  })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Schema upgraded successfully.' })
  @ApiResponse({ status: 404, description: 'Tenant not found.' })
  @ApiResponse({ status: 500, description: 'Schema upgrade failed.' })
  async upgradeSchema(@Param('id') id: string) {
    const tenant = await this.tenantService.findOne(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    try {
      await this.tenantSchemaProvisioning.upgradeTenantSchema(id);

      if (!tenant.schema_provisioned) {
        await this.tenantService.update(id, { schema_provisioned: true } as any);
      }

      return {
        statusCode: 200,
        message: `Schema for tenant "${tenant.name}" upgraded successfully.`,
        schema: this.tenantSchemaProvisioning.getSchemaName(id),
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Schema upgrade failed for tenant ${id}: ${(err as Error).message}`,
      );
    }
  }
}
