import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/company.deorator';
import { SearchService } from './search.service';
import { GlobalSearchDto, GlobalSearchResponseDto, SearchModule } from './dto/search.dto';
import {
  DEFAULT_SEARCH_LIMIT,
  GLOBAL_SYSTEM_TENANT_ID,
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_MESSAGES,
  UserRole,
} from '../../common/constants';
import type { AuthenticatedRequest } from '../auth/interfaces';
import { createEmptySearchResponse } from './helpers/search-response.helper';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../../entities/team.entity';

@ApiTags('Global Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  /**
   * Single global search endpoint. All authenticated roles hit this API.
   * Results are filtered by RBAC: tenant, role (system/network admin cross-tenant), and manager's teams.
   */
  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.SYSTEM_ADMIN,
    UserRole.HR_ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
    UserRole.USER,
    UserRole.NETWORK_ADMIN,
  )
  @ApiOperation({
    summary: 'Global search (RBAC applied)',
    description:
      'Single search API for all roles. Results are automatically scoped by role: tenant for most roles, optional cross-tenant for system-admin/network-admin (via tenantId), and by manager’s teams for manager role. Same query params for everyone.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search term (min 2 characters when provided). Optional – omit to get all.',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Scope to one module or all. Default: all',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results per module. Default: 10',
    example: DEFAULT_SEARCH_LIMIT,
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description:
      'Optional tenant filter. Only system-admin and network-admin may pass this; others are scoped to their tenant.',
    example: 'uuid-123',
  })
  @ApiResponse({ status: 200, description: 'Search results grouped by module', type: GlobalSearchResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query (e.g. too short)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async globalSearch(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<GlobalSearchResponseDto> {
    const userRole = req.user?.role ?? UserRole.USER;
    const isSystemAdmin = userRole === UserRole.SYSTEM_ADMIN;
    const isNetworkAdmin = userRole === UserRole.NETWORK_ADMIN;
    const isAdminRole = isSystemAdmin || isNetworkAdmin;
    const isManager = userRole === UserRole.MANAGER;

    const limit = dto.limit ?? DEFAULT_SEARCH_LIMIT;
    const module = dto.module ?? SearchModule.ALL;

    if (
      dto.query != null &&
      dto.query.length > 0 &&
      dto.query.length < MIN_SEARCH_QUERY_LENGTH
    ) {
      throw new BadRequestException(SEARCH_MESSAGES.QUERY_MIN_LENGTH);
    }

    if (!isAdminRole && dto.tenantId) {
      throw new BadRequestException(SEARCH_MESSAGES.TENANT_ID_ADMIN_ONLY);
    }

    const effectiveTenantId =
      isAdminRole && dto.tenantId ? dto.tenantId : isAdminRole ? GLOBAL_SYSTEM_TENANT_ID : userTenantId;

    const currentUserId: string | undefined = req.user?.id;
    const currentUserEmail: string | undefined = req.user?.email;

    let teamIds: string[] | undefined;
    if (isManager && currentUserId) {
      const managedTeams = await this.teamRepository.find({
        where: { manager_id: currentUserId },
        select: ['id'],
      });
      teamIds = managedTeams.map((team) => team.id);
      if (teamIds.length === 0) {
        return createEmptySearchResponse(dto.query ?? '');
      }
    }

    return this.searchService.globalSearch(
      dto.query,
      effectiveTenantId,
      userRole,
      module,
      limit,
      currentUserId,
      currentUserEmail,
      teamIds,
    );
  }
}
