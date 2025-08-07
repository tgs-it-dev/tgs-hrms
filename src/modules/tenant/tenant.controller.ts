import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/guards/company.guard';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';


@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get all tenants (Admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of tenants retrieved successfully.',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Default Company',
          createdAt: '2024-01-01T00:00:00.000Z'
        }
      ]
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Insufficient permissions' 
  })
  async getTenants() {
    try {
      const tenants = await this.tenantService.findAll();
      return {
        statusCode: 200,
        message: 'List of tenants retrieved successfully.',
        data: tenants,
      };
    } catch (err) {
      throw new BadRequestException('Failed to fetch tenants');
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get tenant by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Tenant UUID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant retrieved successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Default Company',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant not found' 
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new tenant (Admin only)' })
  @ApiBody({ type: CreateTenantDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Tenant created successfully.',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'New Company',
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Invalid tenant data' 
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update tenant by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Tenant UUID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiBody({ type: UpdateTenantDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant updated successfully.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant not found' 
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
  @Roles('admin')
  @ApiOperation({ summary: 'Delete tenant by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Tenant UUID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant deleted successfully.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant not found' 
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
      throw new BadRequestException('Failed to delete tenant');
    }
  }
} 