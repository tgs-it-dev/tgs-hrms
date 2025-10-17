import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleService } from './role.service';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('manage_roles')
  @ApiOperation({ summary: 'Get all roles (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of roles retrieved successfully.',
    schema: {
      example: [
        {
          
          name: 'admin',
         
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getRoles() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin' ,'hr-admin')
  @Permissions('manage_roles')
  @ApiOperation({ summary: 'Get role by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Role UUID',
    example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  })
  @ApiResponse({
    status: 200,
    description: 'Role retrieved successfully.',
    schema: {
      example: {
        name: 'admin',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  async getRoleById(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('manage_roles')
  @ApiOperation({ summary: 'Create a new role (Admin only)' })
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({
    status: 201,
    description: 'Role created successfully.',
    schema: {
      example: {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        name: 'manager',
        description: 'Manager with department access',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid role data',
  })
  createRole(@Body() createRoleDto: CreateRoleDto) {
    return { message: 'Create role - Implementation pending' };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('manage_roles')
  @ApiOperation({ summary: 'Update role by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Role UUID',
    example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({
    status: 200,
    description: 'Role updated successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return { message: `Update role: ${id} - Implementation pending` };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin', 'system-admin')
  @Permissions('manage_roles')
  @ApiOperation({ summary: 'Delete role by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Role UUID',
    example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  })
  @ApiResponse({
    status: 200,
    description: 'Role deleted successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  deleteRole(@Param('id') id: string) {
    return { message: `Delete role: ${id} - Implementation pending` };
  }
}
