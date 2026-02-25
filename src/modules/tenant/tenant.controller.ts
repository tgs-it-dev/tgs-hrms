import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';
import { Tenant } from '../../entities/tenant.entity';
import {
  TENANT_ADMIN_ROLE,
  TENANT_MANAGE_PERMISSION,
  TENANT_PAGINATION,
  TENANT_MESSAGES,
} from './constants/tenant.constants';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const API_TAG = 'Tenants';
const ROUTE_PREFIX = 'tenants';
const TENANT_ID_PARAM = 'id';
const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

interface TenantListResponse extends PaginationResponse<Tenant> {
  statusCode: number;
  message: string;
}

interface TenantSingleResponse {
  statusCode: number;
  message: string;
  data: Tenant;
}

interface TenantDeleteResponse {
  statusCode: number;
  message: string;
  id: string;
}

@ApiTags(API_TAG)
@ApiBearerAuth()
@Controller(ROUTE_PREFIX)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: 'Get all tenants (Admin only) - Paginated' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: `Page number (default: ${TENANT_PAGINATION.DEFAULT_PAGE})`,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `Items per page (default: ${TENANT_PAGINATION.DEFAULT_LIMIT}, max: ${TENANT_PAGINATION.MAX_LIMIT})`,
  })
  @ApiResponse({ status: HttpStatus.OK, description: TENANT_MESSAGES.LIST_SUCCESS })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden - Insufficient permissions' })
  async getTenants(@Query('page') page?: string, @Query('limit') limit?: string): Promise<TenantListResponse> {
    try {
      const pageNumber = Math.max(
        TENANT_PAGINATION.DEFAULT_PAGE,
        parseInt(page ?? String(TENANT_PAGINATION.DEFAULT_PAGE), 10) || TENANT_PAGINATION.DEFAULT_PAGE,
      );
      const limitNumber = Math.min(
        TENANT_PAGINATION.MAX_LIMIT,
        Math.max(
          TENANT_PAGINATION.DEFAULT_LIMIT,
          parseInt(limit ?? String(TENANT_PAGINATION.DEFAULT_LIMIT), 10) || TENANT_PAGINATION.DEFAULT_LIMIT,
        ),
      );
      const result = await this.tenantService.findAll(pageNumber, limitNumber);
      return {
        statusCode: HttpStatus.OK,
        message: TENANT_MESSAGES.LIST_SUCCESS,
        ...result,
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(TENANT_MESSAGES.FETCH_FAILED);
    }
  }

  @Get(`:${TENANT_ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: 'Get tenant by ID (Admin only)' })
  @ApiParam({ name: TENANT_ID_PARAM, description: 'Tenant UUID', example: EXAMPLE_UUID })
  @ApiResponse({
    status: HttpStatus.OK,
    description: TENANT_MESSAGES.GET_SUCCESS,
    schema: {
      example: {
        id: EXAMPLE_UUID,
        name: 'Default Company',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: TENANT_MESSAGES.FETCH_ONE_FAILED })
  async getTenantById(@Param(TENANT_ID_PARAM) id: string): Promise<TenantSingleResponse> {
    try {
      const tenant = await this.tenantService.findOne(id);
      return {
        statusCode: HttpStatus.OK,
        message: TENANT_MESSAGES.GET_SUCCESS,
        data: tenant,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException(TENANT_MESSAGES.FETCH_ONE_FAILED);
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: 'Create a new tenant (Admin only)' })
  @ApiBody({ type: CreateTenantDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: TENANT_MESSAGES.CREATE_SUCCESS,
    schema: {
      example: {
        id: EXAMPLE_UUID,
        name: 'New Company',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request - Invalid tenant data' })
  async createTenant(@Body() createTenantDto: CreateTenantDto): Promise<TenantSingleResponse> {
    try {
      const tenant = await this.tenantService.create(createTenantDto);
      return {
        statusCode: HttpStatus.CREATED,
        message: TENANT_MESSAGES.CREATE_SUCCESS,
        data: tenant,
      };
    } catch {
      throw new BadRequestException(TENANT_MESSAGES.CREATE_FAILED);
    }
  }

  @Put(`:${TENANT_ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: 'Update tenant by ID (Admin only)' })
  @ApiParam({ name: TENANT_ID_PARAM, description: 'Tenant UUID', example: EXAMPLE_UUID })
  @ApiBody({ type: UpdateTenantDto })
  @ApiResponse({ status: HttpStatus.OK, description: TENANT_MESSAGES.UPDATE_SUCCESS })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: TENANT_MESSAGES.FETCH_ONE_FAILED })
  async updateTenant(
    @Param(TENANT_ID_PARAM) id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ): Promise<TenantSingleResponse> {
    try {
      const tenant = await this.tenantService.update(id, updateTenantDto);
      return {
        statusCode: HttpStatus.OK,
        message: TENANT_MESSAGES.UPDATE_SUCCESS,
        data: tenant,
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(TENANT_MESSAGES.UPDATE_FAILED);
    }
  }

  @Delete(`:${TENANT_ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @ApiOperation({ summary: 'Delete tenant by ID (Admin only)' })
  @ApiParam({ name: TENANT_ID_PARAM, description: 'Tenant UUID', example: EXAMPLE_UUID })
  @ApiResponse({ status: HttpStatus.OK, description: TENANT_MESSAGES.DELETE_SUCCESS })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: TENANT_MESSAGES.FETCH_ONE_FAILED })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request - Tenant already deleted' })
  async deleteTenant(@Param(TENANT_ID_PARAM) id: string): Promise<TenantDeleteResponse> {
    try {
      await this.tenantService.remove(id);
      return {
        statusCode: HttpStatus.OK,
        message: TENANT_MESSAGES.DELETE_SUCCESS,
        id,
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(TENANT_MESSAGES.DELETE_FAILED);
    }
  }

  @Post(`:${TENANT_ID_PARAM}/restore`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: 'Restore a deleted tenant (Admin only)' })
  @ApiParam({ name: TENANT_ID_PARAM, description: 'Tenant UUID', example: EXAMPLE_UUID })
  @ApiResponse({ status: HttpStatus.OK, description: TENANT_MESSAGES.RESTORE_SUCCESS })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: TENANT_MESSAGES.FETCH_ONE_FAILED })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request - Tenant is not deleted' })
  async restoreTenant(@Param(TENANT_ID_PARAM) id: string): Promise<TenantSingleResponse> {
    try {
      const tenant = await this.tenantService.restore(id);
      return {
        statusCode: HttpStatus.OK,
        message: TENANT_MESSAGES.RESTORE_SUCCESS,
        data: tenant,
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(TENANT_MESSAGES.RESTORE_FAILED);
    }
  }
}
