import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MinLength, ValidateIf, IsUUID } from 'class-validator';

export enum SearchModule {
  ALL = 'all',
  EMPLOYEES = 'employees',
  LEAVES = 'leaves',
  ASSETS = 'assets',
  ASSET_REQUESTS = 'asset-requests',
  TEAMS = 'teams',
  ATTENDANCE = 'attendance',
  BENEFITS = 'benefits',
  PAYROLL = 'payroll',
}

export class GlobalSearchDto {
  @ApiPropertyOptional({
    description: 'Search query string (optional - if not provided, returns all results)',
    example: 'John Doe',
    minLength: 2,
  })
  @IsOptional()
  @ValidateIf((o) => o.query !== undefined && o.query !== null && o.query !== '')
  @IsString()
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  query?: string;

  @ApiPropertyOptional({
    description: 'Specific module to search in. If not provided, searches all modules',
    enum: SearchModule,
    default: SearchModule.ALL,
  })
  @IsOptional()
  @IsEnum(SearchModule)
  module?: SearchModule = SearchModule.ALL;

  @ApiPropertyOptional({
    description: 'Limit number of results per module',
    example: 10,
    default: 10,
  })
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Tenant ID to filter by (System Admin only - if not provided, searches all tenants). Regular users cannot override their tenant.',
    example: 'uuid-123',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class SearchResultItem {
  @ApiProperty({ description: 'Item ID' })
  id: string;

  @ApiProperty({ description: 'Item title/name' })
  title: string;

  @ApiProperty({ description: 'Item description or additional info' })
  description?: string;

  @ApiProperty({ description: 'Module type this result belongs to' })
  module: string;

  @ApiProperty({ description: 'Additional metadata' })
  metadata?: Record<string, any>;
}

export class GlobalSearchResponseDto {
  @ApiProperty({ description: 'Search query used' })
  query: string;

  @ApiProperty({ description: 'Total number of results across all modules' })
  totalResults: number;

  @ApiProperty({
    description: 'Search results grouped by module',
    type: [SearchResultItem],
  })
  results: {
    employees?: SearchResultItem[];
    leaves?: SearchResultItem[];
    assets?: SearchResultItem[];
    assetRequests?: SearchResultItem[];
    teams?: SearchResultItem[];
    attendance?: SearchResultItem[];
    benefits?: SearchResultItem[];
    payroll?: SearchResultItem[];
  };

  @ApiProperty({ description: 'Result counts per module' })
  counts: {
    employees: number;
    leaves: number;
    assets: number;
    assetRequests: number;
    teams: number;
    attendance: number;
    benefits: number;
    payroll: number;
  };
}

