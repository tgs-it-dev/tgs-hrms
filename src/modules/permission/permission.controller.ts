import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Roles } from 'src/common/guards/company.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionController {
  constructor() {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Get all permissions (Admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of permissions retrieved successfully.',
    schema: {
      example: [
        {
          id: '7ca8c920-9dad-11d1-80b4-00c04fd430c8',
          name: 'read:employee',
          description: 'Can read employees'
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
  getPermissions() {
    return { message: 'Get all permissions - Implementation pending' };
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
  getPermissionById(@Param('id') id: string) {
    return { message: `Get permission by ID: ${id} - Implementation pending` };
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
  createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return { message: 'Create permission - Implementation pending' };
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
  updatePermission(@Param('id') id: string, @Body() updatePermissionDto: UpdatePermissionDto) {
    return { message: `Update permission: ${id} - Implementation pending` };
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
  deletePermission(@Param('id') id: string) {
    return { message: `Delete permission: ${id} - Implementation pending` };
  }
} 