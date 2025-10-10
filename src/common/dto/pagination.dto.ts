/**
 * Pagination DTOs and utilities
 */

import { IsOptional, IsNumber, Min, Max, IsString, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class PaginationDto {
  @ApiPropertyOptional({ 
    description: 'Page number (1-based)', 
    minimum: 1, 
    default: 1 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Number of items per page', 
    minimum: 1, 
    maximum: 100, 
    default: 10 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ 
    description: 'Field to sort by', 
    example: 'created_at' 
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ 
    description: 'Sort order', 
    enum: SortOrder, 
    default: SortOrder.DESC 
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ 
    description: 'Search term for filtering', 
    example: 'john' 
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ 
    description: 'Additional filters as JSON string', 
    example: '{"status":"active"}' 
  })
  @IsOptional()
  @IsString()
  filters?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export class PaginationService {
  /**
   * Calculate pagination metadata
   */
  static calculateMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Calculate offset for database queries
   */
  static calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Parse filters from JSON string
   */
  static parseFilters(filters?: string): Record<string, any> {
    if (!filters) return {};
    
    try {
      return JSON.parse(filters);
    } catch (error) {
      return {};
    }
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(page: number, limit: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (page < 1) {
      errors.push('Page must be greater than 0');
    }
    
    if (limit < 1 || limit > 100) {
      errors.push('Limit must be between 1 and 100');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create paginated response
   */
  static createPaginatedResponse<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): PaginatedResponse<T> {
    const meta = this.calculateMeta(page, limit, total);
    
    return {
      data,
      meta,
    };
  }
}


