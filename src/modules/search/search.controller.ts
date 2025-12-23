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

@ApiTags('Global Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin', 'manager', 'employee', 'user')
  @Permissions('view_employees', 'view_leaves', 'view_assets', 'view_asset_requests')
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

    return this.searchService.globalSearch(
      dto.query,
      effectiveTenantId,
      userRole,
      module,
      limit,
    );
  }
}
