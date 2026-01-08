import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/company.deorator';
import { SearchService } from './search.service';
import { GlobalSearchDto, GlobalSearchResponseDto, SearchModule } from './dto/search.dto';
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

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin', 'manager', 'employee', 'user', 'network-admin')
  @ApiOperation({
    summary: 'Global search across all HRMS modules',
    description: 'Search across employees, leaves, assets, asset requests, teams, attendance, benefits, and payroll with role-based and tenant-based filtering. System-admin can search across all tenants or filter by specific tenant using tenantId parameter.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query string (optional - if not provided, returns all results. Minimum 2 characters if provided)',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Specific module to search in. Default: all',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results per module. Default: 10',
    example: 10,
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description: 'Tenant ID to filter by (System Admin only - if not provided, searches all tenants). Regular users cannot override their tenant.',
    example: 'uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by module',
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
              metadata: {
                email: 'john.doe@example.com',
                phone: '+1234567890',
                designation: 'Software Engineer',
                team: 'Development Team',
                status: 'active',
              },
            },
          ],
          leaves: [
            {
              id: 'uuid-456',
              title: 'John Doe - Annual Leave',
              description: 'Vacation | Status: approved | 5 days',
              module: 'leaves',
              metadata: {
                employeeName: 'John Doe',
                leaveType: 'Annual Leave',
                startDate: '2024-01-15',
                endDate: '2024-01-19',
                totalDays: 5,
                status: 'approved',
              },
            },
          ],
          assets: [],
          assetRequests: [],
          teams: [],
          attendance: [],
          benefits: [],
          payroll: [],
        },
        counts: {
          employees: 1,
          leaves: 1,
          assets: 0,
          assetRequests: 0,
          teams: 0,
          attendance: 0,
          benefits: 0,
          payroll: 0,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search query (too short)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async globalSearch(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: any,
  ): Promise<GlobalSearchResponseDto> {
    const userRole = req.user?.role || 'user';
    const isSystemAdmin = userRole === 'system-admin';
    const limit = dto.limit || 10;
    const module = dto.module || SearchModule.ALL;

    // If query is provided, validate it has at least 2 characters
    if (dto.query && dto.query.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters long');
    }

    // Regular users cannot override their tenant
    if (!isSystemAdmin && dto.tenantId) {
      throw new BadRequestException('Only system-admin can specify tenantId parameter');
    }

    // System admin can override tenant with query parameter, regular users use their tenant
    // If system admin doesn't provide tenantId, use GLOBAL_SYSTEM_TENANT_ID to search all tenants
    const effectiveTenantId = isSystemAdmin && dto.tenantId 
      ? dto.tenantId 
      : isSystemAdmin 
        ? GLOBAL_SYSTEM_TENANT_ID 
        : userTenantId;

    const currentUserId = req.user?.id;
    const currentUserEmail = req.user?.email;
    return this.searchService.globalSearch(
      dto.query,
      effectiveTenantId,
      userRole,
      module,
      limit,
      currentUserId,
      currentUserEmail,
    );
  }

  @Get('network-admin')
  @Roles('network-admin')
  @ApiOperation({
    summary: 'Global search for Network Admin',
    description: 'Search across all HRMS modules for Network Admin role. Can search across all tenants or filter by specific tenant using tenantId parameter.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query string (optional - if not provided, returns all results. Minimum 2 characters if provided)',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Specific module to search in. Default: all',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results per module. Default: 10',
    example: 10,
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description: 'Tenant ID to filter by (if not provided, searches all tenants)',
    example: 'uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by module',
    type: GlobalSearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search query (too short)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or role',
  })
  async searchNetworkAdmin(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: any,
  ): Promise<GlobalSearchResponseDto> {
    return this.performSearch(dto, userTenantId, req, 'network-admin');
  }

  @Get('system-admin')
  @Roles('system-admin')
  @ApiOperation({
    summary: 'Global search for System Admin',
    description: 'Search across all HRMS modules for System Admin role. Can search across all tenants or filter by specific tenant using tenantId parameter.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query string (optional - if not provided, returns all results. Minimum 2 characters if provided)',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Specific module to search in. Default: all',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results per module. Default: 10',
    example: 10,
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description: 'Tenant ID to filter by (if not provided, searches all tenants)',
    example: 'uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by module',
    type: GlobalSearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search query (too short)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or role',
  })
  async searchSystemAdmin(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: any,
  ): Promise<GlobalSearchResponseDto> {
    return this.performSearch(dto, userTenantId, req, 'system-admin');
  }

  @Get('admin')
  @Roles('admin')
  @ApiOperation({
    summary: 'Global search for Admin',
    description: 'Search across all HRMS modules for Admin role within their tenant.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query string (optional - if not provided, returns all results. Minimum 2 characters if provided)',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Specific module to search in. Default: all',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results per module. Default: 10',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by module',
    type: GlobalSearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search query (too short)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or role',
  })
  async searchAdmin(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: any,
  ): Promise<GlobalSearchResponseDto> {
    return this.performSearch(dto, userTenantId, req, 'admin');
  }

  @Get('manager')
  @Roles('manager')
  @ApiOperation({
    summary: 'Global search for Manager',
    description: 'Search across all HRMS modules for Manager role within their tenant.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query string (optional - if not provided, returns all results. Minimum 2 characters if provided)',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Specific module to search in. Default: all',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results per module. Default: 10',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by module',
    type: GlobalSearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search query (too short)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or role',
  })
  async searchManager(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: any,
  ): Promise<GlobalSearchResponseDto> {
    return this.performSearch(dto, userTenantId, req, 'manager', true);
  }

  @Get('employee')
  @Roles('employee', 'admin', 'system-admin', 'hr-admin', 'manager')
  @ApiOperation({
    summary: 'Global search for Employee',
    description: 'Search across all HRMS modules for Employee role within their tenant.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query string (optional - if not provided, returns all results. Minimum 2 characters if provided)',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Specific module to search in. Default: all',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results per module. Default: 10',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by module',
    type: GlobalSearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search query (too short)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or role',
  })
  async searchEmployee(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: any,
  ): Promise<GlobalSearchResponseDto> {
    return this.performSearch(dto, userTenantId, req, 'employee');
  }

  @Get('hr-admin')
  @Roles('hr-admin')
  @ApiOperation({
    summary: 'Global search for HR Admin',
    description: 'Search across all HRMS modules for HR Admin role within their tenant.',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query string (optional - if not provided, returns all results. Minimum 2 characters if provided)',
    example: 'John Doe',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: SearchModule,
    description: 'Specific module to search in. Default: all',
    example: SearchModule.ALL,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results per module. Default: 10',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results grouped by module',
    type: GlobalSearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search query (too short)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or role',
  })
  async searchHrAdmin(
    @Query() dto: GlobalSearchDto,
    @TenantId() userTenantId: string,
    @Request() req: any,
  ): Promise<GlobalSearchResponseDto> {
    return this.performSearch(dto, userTenantId, req, 'hr-admin');
  }

  /**
   * Helper method to perform search with role-specific logic
   */
  private async performSearch(
    dto: GlobalSearchDto,
    userTenantId: string,
    req: any,
    role: string,
    isManager: boolean = false,
  ): Promise<GlobalSearchResponseDto> {
    const isSystemAdmin = role === 'system-admin';
    const isNetworkAdmin = role === 'network-admin';
    const isAdminRole = isSystemAdmin || isNetworkAdmin;
    const limit = dto.limit || 10;
    const module = dto.module || SearchModule.ALL;

    // If query is provided, validate it has at least 2 characters
    if (dto.query && dto.query.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters long');
    }

    // Only system-admin and network-admin can override their tenant
    if (!isAdminRole && dto.tenantId) {
      throw new BadRequestException(`Only system-admin and network-admin can specify tenantId parameter`);
    }

    // System admin and network admin can override tenant with query parameter, regular users use their tenant
    // If admin role doesn't provide tenantId, use GLOBAL_SYSTEM_TENANT_ID to search all tenants
    const effectiveTenantId = isAdminRole && dto.tenantId 
      ? dto.tenantId 
      : isAdminRole 
        ? GLOBAL_SYSTEM_TENANT_ID 
        : userTenantId;

    const currentUserId = req.user?.id;
    const currentUserEmail = req.user?.email;
    
    // For manager role, get team IDs that the manager manages
    let teamIds: string[] | undefined;
    if (isManager && currentUserId) {
      const managedTeams = await this.teamRepository.find({
        where: { manager_id: currentUserId },
        select: ['id'],
      });
      teamIds = managedTeams.map(team => team.id);
      
      // If manager has no teams, return empty results
      if (teamIds.length === 0) {
        return {
          query: dto.query || '',
          totalResults: 0,
          results: {
            employees: [],
            leaves: [],
            assets: [],
            assetRequests: [],
            teams: [],
            attendance: [],
            benefits: [],
            payroll: [],
          },
          counts: {
            employees: 0,
            leaves: 0,
            assets: 0,
            assetRequests: 0,
            teams: 0,
            attendance: 0,
            benefits: 0,
            payroll: 0,
          },
        };
      }
    }
    
    return this.searchService.globalSearch(
      dto.query,
      effectiveTenantId,
      role,
      module,
      limit,
      currentUserId,
      currentUserEmail,
      teamIds,
    );
  }
}
