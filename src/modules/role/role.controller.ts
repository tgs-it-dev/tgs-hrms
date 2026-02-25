import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Role } from '../../entities/role.entity';
import {
  ROLE_MANAGE_ROLES,
  ROLE_MANAGE_ROLES_STRICT,
  ROLE_MANAGE_PERMISSION,
  ROLE_API,
  ROLE_SWAGGER,
  ROLE_OPERATIONS,
  ROLE_API_RESPONSES,
  ROLE_MESSAGES,
} from './constants/role.constants';
import { RoleService, RoleListItem } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

interface RoleListResponse {
  statusCode: number;
  message: string;
  data: RoleListItem[];
}

interface RoleSingleResponse {
  statusCode: number;
  message: string;
  data: Role;
}

interface RoleDeleteResponse {
  statusCode: number;
  message: string;
  id: string;
}

@ApiTags(ROLE_API.TAG)
@ApiBearerAuth()
@Controller(ROLE_API.ROUTE_PREFIX)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ROLE_MANAGE_ROLES)
  @Permissions(ROLE_MANAGE_PERMISSION)
  @ApiOperation({ summary: ROLE_OPERATIONS.GET_ALL })
  @ApiResponse({
    status: HttpStatus.OK,
    description: ROLE_MESSAGES.LIST_SUCCESS,
    schema: {
      example: [{ name: ROLE_SWAGGER.EXAMPLE_NAME }],
    },
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: ROLE_API_RESPONSES.UNAUTHORIZED })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: ROLE_API_RESPONSES.FORBIDDEN })
  async getRoles(): Promise<RoleListResponse> {
    try {
      const data = await this.roleService.findAll();
      return {
        statusCode: HttpStatus.OK,
        message: ROLE_MESSAGES.LIST_SUCCESS,
        data,
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(ROLE_MESSAGES.FETCH_FAILED);
    }
  }

  @Get(`:${ROLE_API.ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ROLE_MANAGE_ROLES)
  @Permissions(ROLE_MANAGE_PERMISSION)
  @ApiOperation({ summary: ROLE_OPERATIONS.GET_BY_ID })
  @ApiParam({
    name: ROLE_API.ID_PARAM,
    description: ROLE_SWAGGER.PARAM_UUID_DESCRIPTION,
    example: ROLE_SWAGGER.EXAMPLE_UUID,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: ROLE_MESSAGES.GET_SUCCESS,
    schema: {
      example: { name: ROLE_SWAGGER.EXAMPLE_NAME },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: ROLE_API_RESPONSES.NOT_FOUND })
  async getRoleById(@Param(ROLE_API.ID_PARAM) id: string): Promise<RoleSingleResponse> {
    try {
      const data = await this.roleService.findOne(id);
      return {
        statusCode: HttpStatus.OK,
        message: ROLE_MESSAGES.GET_SUCCESS,
        data,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException(ROLE_MESSAGES.FETCH_ONE_FAILED);
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ROLE_MANAGE_ROLES_STRICT)
  @Permissions(ROLE_MANAGE_PERMISSION)
  @ApiOperation({ summary: ROLE_OPERATIONS.CREATE })
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: ROLE_MESSAGES.CREATE_SUCCESS,
    schema: {
      example: {
        id: ROLE_SWAGGER.EXAMPLE_UUID,
        name: ROLE_SWAGGER.EXAMPLE_NAME_MANAGER,
        description: ROLE_SWAGGER.EXAMPLE_DESCRIPTION,
      },
    },
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: ROLE_API_RESPONSES.BAD_REQUEST_INVALID_DATA })
  async createRole(@Body() createRoleDto: CreateRoleDto): Promise<RoleSingleResponse> {
    try {
      const data = await this.roleService.create(createRoleDto);
      return {
        statusCode: HttpStatus.CREATED,
        message: ROLE_MESSAGES.CREATE_SUCCESS,
        data,
      };
    } catch {
      throw new BadRequestException(ROLE_MESSAGES.CREATE_FAILED);
    }
  }

  @Put(`:${ROLE_API.ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ROLE_MANAGE_ROLES_STRICT)
  @Permissions(ROLE_MANAGE_PERMISSION)
  @ApiOperation({ summary: ROLE_OPERATIONS.UPDATE })
  @ApiParam({
    name: ROLE_API.ID_PARAM,
    description: ROLE_SWAGGER.PARAM_UUID_DESCRIPTION,
    example: ROLE_SWAGGER.EXAMPLE_UUID,
  })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({ status: HttpStatus.OK, description: ROLE_MESSAGES.UPDATE_SUCCESS })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: ROLE_API_RESPONSES.NOT_FOUND })
  async updateRole(
    @Param(ROLE_API.ID_PARAM) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<RoleSingleResponse> {
    try {
      const data = await this.roleService.update(id, updateRoleDto);
      return {
        statusCode: HttpStatus.OK,
        message: ROLE_MESSAGES.UPDATE_SUCCESS,
        data,
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(ROLE_MESSAGES.UPDATE_FAILED);
    }
  }

  @Delete(`:${ROLE_API.ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(...ROLE_MANAGE_ROLES_STRICT)
  @Permissions(ROLE_MANAGE_PERMISSION)
  @ApiOperation({ summary: ROLE_OPERATIONS.DELETE })
  @ApiParam({
    name: ROLE_API.ID_PARAM,
    description: ROLE_SWAGGER.PARAM_UUID_DESCRIPTION,
    example: ROLE_SWAGGER.EXAMPLE_UUID,
  })
  @ApiResponse({ status: HttpStatus.OK, description: ROLE_MESSAGES.DELETE_SUCCESS })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: ROLE_API_RESPONSES.NOT_FOUND })
  async deleteRole(@Param(ROLE_API.ID_PARAM) id: string): Promise<RoleDeleteResponse> {
    try {
      await this.roleService.remove(id);
      return {
        statusCode: HttpStatus.OK,
        message: ROLE_MESSAGES.DELETE_SUCCESS,
        id,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException(ROLE_MESSAGES.DELETE_FAILED);
    }
  }
}
