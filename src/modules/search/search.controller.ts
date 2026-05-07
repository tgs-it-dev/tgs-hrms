import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantId } from '../../common/decorators/company.deorator';
import { SearchService } from './search.service';
import {
  GlobalSearchDto,
  GlobalSearchResponseDto,
  SearchModule,
} from './dto/search.dto';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../common/constants/enums';
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
   * Single Global Search API – tenant-scoped and RBAC-filtered.
   * One route for all roles; results are filtered by user's tenant and permissions.
   */
  @Get()
  @ApiOperation({
    summary: 'Global search (tenant-scoped, RBAC-filtered)',
    description:
      'Single search API for all roles. Results are always tenant-scoped (except system-admin can optionally pass tenantId or search all). Only modules the user has read permission for are searched and returned. System-admin may pass tenantId to filter by tenant or omit to search across all tenants.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description:
      'Search query (optional). If provided, minimum 2 characters.',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Limit search to a specific module. Default: all allowed modules',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results per module. Default: 10',
    example: 10,
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description:
      'Tenant filter (System Admin / Network Admin only). Omit to use current user tenant, or (admin only) to search all tenants.',
    example: 'uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by module (only modules user can access)',
    type: GlobalSearchResponseDto,
    schema: {
      example: {
        query: 'John Doe',
        totalResults: 15,
        results: {
          employees: [
            {
              id: 'uuid-123',
              title: 'John Doe',
              description: 'john.doe@example.com | Software Engineer | Development Team',
              module: 'employees',
              metadata: {},
            },
          ],
          leaves: [],
        },
        counts: { employees: 1, leaves: 0, teams: 0, attendance: 0 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query or tenantId (e.g. non-admin passing tenantId)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async globalSearch(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: any,
  ): Promise<GlobalSearchResponseDto> {
    const userRole = (req.user?.role || 'user').toLowerCase();
    const isSystemAdmin = userRole === 'system-admin';
    const isNetworkAdmin = userRole === 'network-admin';
    const canOverrideTenant = isSystemAdmin || isNetworkAdmin;
    const limit = dto.limit ?? 10;
    const module = dto.module ?? SearchModule.ALL;

    if (dto.query != null && dto.query.length > 0 && dto.query.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters long');
    }

    if (!canOverrideTenant && dto.tenantId) {
      throw new BadRequestException(
        'Only system-admin and network-admin can specify tenantId',
      );
    }

    const effectiveTenantId =
      canOverrideTenant && dto.tenantId
        ? dto.tenantId
        : canOverrideTenant
          ? GLOBAL_SYSTEM_TENANT_ID
          : userTenantId;

    const currentUserId = req.user?.id;
    const currentUserEmail = req.user?.email;

    let teamIds: string[] | undefined;
    if (userRole === 'manager' && currentUserId) {
      const managedTeams = await this.teamRepository.find({
        where: { manager_id: currentUserId },
        select: ['id'],
      });
      teamIds = managedTeams.map((t) => t.id);
      if (teamIds.length === 0) {
        return this.searchService.buildEmptyResponse(dto.query ?? '');
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
