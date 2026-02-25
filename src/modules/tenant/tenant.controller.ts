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
  TENANT_API,
  TENANT_SWAGGER,
  TENANT_OPERATIONS,
  TENANT_API_RESPONSES,
  PARSE_INT_RADIX,
} from './constants/tenant.constants';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

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

@ApiTags(TENANT_API.TAG)
@ApiBearerAuth()
@Controller(TENANT_API.ROUTE_PREFIX)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: TENANT_OPERATIONS.GET_ALL })
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
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: TENANT_API_RESPONSES.UNAUTHORIZED })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: TENANT_API_RESPONSES.FORBIDDEN })
  async getTenants(@Query('page') page?: string, @Query('limit') limit?: string): Promise<TenantListResponse> {
    try {
      const { pageNumber, limitNumber } = this.parsePagination(page, limit);
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

  @Get(`:${TENANT_API.ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: TENANT_OPERATIONS.GET_BY_ID })
  @ApiParam({
    name: TENANT_API.ID_PARAM,
    description: TENANT_SWAGGER.PARAM_UUID_DESCRIPTION,
    example: TENANT_SWAGGER.EXAMPLE_UUID,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: TENANT_MESSAGES.GET_SUCCESS,
    schema: {
      example: {
        id: TENANT_SWAGGER.EXAMPLE_UUID,
        name: TENANT_SWAGGER.EXAMPLE_NAME,
        createdAt: TENANT_SWAGGER.EXAMPLE_CREATED_AT,
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: TENANT_MESSAGES.FETCH_ONE_FAILED })
  async getTenantById(@Param(TENANT_API.ID_PARAM) id: string): Promise<TenantSingleResponse> {
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
  @ApiOperation({ summary: TENANT_OPERATIONS.CREATE })
  @ApiBody({ type: CreateTenantDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: TENANT_MESSAGES.CREATE_SUCCESS,
    schema: {
      example: {
        id: TENANT_SWAGGER.EXAMPLE_UUID,
        name: TENANT_SWAGGER.EXAMPLE_NAME_NEW,
        createdAt: TENANT_SWAGGER.EXAMPLE_CREATED_AT,
      },
    },
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: TENANT_API_RESPONSES.BAD_REQUEST_INVALID_DATA })
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

  @Put(`:${TENANT_API.ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: TENANT_OPERATIONS.UPDATE })
  @ApiParam({
    name: TENANT_API.ID_PARAM,
    description: TENANT_SWAGGER.PARAM_UUID_DESCRIPTION,
    example: TENANT_SWAGGER.EXAMPLE_UUID,
  })
  @ApiBody({ type: UpdateTenantDto })
  @ApiResponse({ status: HttpStatus.OK, description: TENANT_MESSAGES.UPDATE_SUCCESS })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: TENANT_MESSAGES.FETCH_ONE_FAILED })
  async updateTenant(
    @Param(TENANT_API.ID_PARAM) id: string,
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

  @Delete(`:${TENANT_API.ID_PARAM}`)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @ApiOperation({ summary: TENANT_OPERATIONS.DELETE })
  @ApiParam({
    name: TENANT_API.ID_PARAM,
    description: TENANT_SWAGGER.PARAM_UUID_DESCRIPTION,
    example: TENANT_SWAGGER.EXAMPLE_UUID,
  })
  @ApiResponse({ status: HttpStatus.OK, description: TENANT_MESSAGES.DELETE_SUCCESS })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: TENANT_MESSAGES.FETCH_ONE_FAILED })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: TENANT_API_RESPONSES.BAD_REQUEST_ALREADY_DELETED })
  async deleteTenant(@Param(TENANT_API.ID_PARAM) id: string): Promise<TenantDeleteResponse> {
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

  @Post(`:${TENANT_API.ID_PARAM}/${TENANT_API.RESTORE_PATH}`)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(TENANT_MANAGE_PERMISSION)
  @ApiOperation({ summary: TENANT_OPERATIONS.RESTORE })
  @ApiParam({
    name: TENANT_API.ID_PARAM,
    description: TENANT_SWAGGER.PARAM_UUID_DESCRIPTION,
    example: TENANT_SWAGGER.EXAMPLE_UUID,
  })
  @ApiResponse({ status: HttpStatus.OK, description: TENANT_MESSAGES.RESTORE_SUCCESS })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: TENANT_MESSAGES.FETCH_ONE_FAILED })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: TENANT_API_RESPONSES.BAD_REQUEST_NOT_DELETED })
  async restoreTenant(@Param(TENANT_API.ID_PARAM) id: string): Promise<TenantSingleResponse> {
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

  private parsePagination(page?: string, limit?: string): { pageNumber: number; limitNumber: number } {
    const rawPage = parseInt(page ?? String(TENANT_PAGINATION.DEFAULT_PAGE), PARSE_INT_RADIX);
    const rawLimit = parseInt(limit ?? String(TENANT_PAGINATION.DEFAULT_LIMIT), PARSE_INT_RADIX);
    const pageNumber = Math.max(
      TENANT_PAGINATION.DEFAULT_PAGE,
      Number.isNaN(rawPage) ? TENANT_PAGINATION.DEFAULT_PAGE : rawPage,
    );
    const limitNumber = Math.min(
      TENANT_PAGINATION.MAX_LIMIT,
      Math.max(TENANT_PAGINATION.DEFAULT_LIMIT, Number.isNaN(rawLimit) ? TENANT_PAGINATION.DEFAULT_LIMIT : rawLimit),
    );
    return { pageNumber, limitNumber };
  }
}
