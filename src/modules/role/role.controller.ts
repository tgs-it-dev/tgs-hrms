import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleService } from './role.service';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Get all roles (Admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of roles retrieved successfully.',
    schema: {
      example: {
        data: [
          {
            id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            name: 'admin',
            description: 'Administrator with full access'
          }
        ],
        total: 10,
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
  async getRoles(@Query('page') page?: string, @Query('size') size?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(size || '25', 10) || 25));
    return this.roleService.findAll(pageNumber, pageSize);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Get role by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Role UUID',
    example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Role retrieved successfully.',
    schema: {
      example: {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        name: 'admin',
        description: 'Administrator with full access'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Role not found' 
  })
  async getRoleById(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Create a new role (Admin only)' })
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Role created successfully.',
    schema: {
      example: {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        name: 'manager',
        description: 'Manager with department access'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Invalid role data' 
  })
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Update role by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Role UUID',
    example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Role updated successfully.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Role not found' 
  })
  async updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin',"system-admin")
  @ApiOperation({ summary: 'Delete role by ID (Admin only)' })
  @ApiParam({ 
    name: 'id', 
    description: 'Role UUID',
    example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Role deleted successfully.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Role not found' 
  })
  async deleteRole(@Param('id') id: string) {
    return this.roleService.remove(id);
  }
} 