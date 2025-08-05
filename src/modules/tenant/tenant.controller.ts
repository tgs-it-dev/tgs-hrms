import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor() {}

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
  getTenants() {
    return { message: 'Get all tenants - Implementation pending' };
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
  getTenantById(@Param('id') id: string) {
    return { message: `Get tenant by ID: ${id} - Implementation pending` };
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
  createTenant(@Body() createTenantDto: CreateTenantDto) {
    return { message: 'Create tenant - Implementation pending' };
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
  updateTenant(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return { message: `Update tenant: ${id} - Implementation pending` };
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
  deleteTenant(@Param('id') id: string) {
    return { message: `Delete tenant: ${id} - Implementation pending` };
  }
} 