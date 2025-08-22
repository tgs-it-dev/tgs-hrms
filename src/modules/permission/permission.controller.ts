import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Roles } from 'src/common/guards/company.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PermissionService } from './permission.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Get all permissions (Admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of permissions retrieved successfully.',
    schema: {
      example: {
        data: [
          {
            id: '7ca8c920-9dad-11d1-80b4-00c04fd430c8',
            name: 'read:employee',
            description: 'Can read employees'
          }
        ],
        total: 15,
        page: 1,
        size: 25
      }
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
  async getPermissions(@Query('page') page?: string, @Query('size') size?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(size || '25', 10) || 25));
    return this.permissionService.findAll(pageNumber, pageSize);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Get permission by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Permission UUID',
    example: '7ca8c920-9dad-11d1-80b4-00c04fd430c8'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Permission retrieved successfully.',
    schema: {
      example: {
        id: '7ca8c920-9dad-11d1-80b4-00c04fd430c8',
        name: 'read:employee',
        description: 'Can read employees'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Permission not found' 
  })
  async getPermissionById(@Param('id') id: string) {
    return this.permissionService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Create a new permission (Admin only)' })
  @ApiBody({ type: CreatePermissionDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Permission created successfully.',
    schema: {
      example: {
        id: '7ca8c920-9dad-11d1-80b4-00c04fd430c8',
        name: 'write:employee',
        description: 'Can create and update employees'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Invalid permission data' 
  })
  async createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Update permission by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Permission UUID',
    example: '7ca8c920-9dad-11d1-80b4-00c04fd430c8'
  })
  @ApiBody({ type: UpdatePermissionDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Permission updated successfully.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Permission not found' 
  })
  async updatePermission(@Param('id') id: string, @Body() updatePermissionDto: UpdatePermissionDto) {
    return this.permissionService.update(id, updatePermissionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Delete permission by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Permission UUID',
    example: '7ca8c920-9dad-11d1-80b4-00c04fd430c8'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Permission deleted successfully.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Permission not found' 
  })
  async deletePermission(@Param('id') id: string) {
    return this.permissionService.remove(id);
  }
} 