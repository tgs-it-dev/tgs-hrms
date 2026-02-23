/**
 * Enhanced Database Utility with Pagination
 */

import {
  Repository,
  SelectQueryBuilder,
  ObjectLiteral,
  FindOptionsWhere,
} from 'typeorm';
import {
  PaginationDto,
  PaginationService,
  PaginatedResponse,
} from '../dto/pagination.dto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  VALIDATION_ERROR,
} from '../constants';

interface SoftDeletable {
  deletedAt: Date | null;
}

export class DatabaseUtil {
  /**
   * Create paginated query builder
   */
  static createPaginatedQuery<T extends ObjectLiteral>(
    repository: Repository<T>,
    paginationDto: PaginationDto,
    allowedSortFields: string[] = [],
  ): SelectQueryBuilder<T> {
    const query = repository.createQueryBuilder();

    // Apply pagination
    const offset = PaginationService.calculateOffset(
      paginationDto.page!,
      paginationDto.limit!,
    );
    query.skip(offset).take(paginationDto.limit);

    // Apply sorting
    if (
      paginationDto.sortBy &&
      allowedSortFields.includes(paginationDto.sortBy)
    ) {
      query.orderBy(paginationDto.sortBy, paginationDto.sortOrder);
    } else {
      query.orderBy('created_at', paginationDto.sortOrder);
    }

    return query;
  }

  /**
   * Execute paginated query
   */
  static async executePaginatedQuery<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<T>> {
    const [items, total] = await queryBuilder.getManyAndCount();

    return PaginationService.createPaginatedResponse(
      items,
      paginationDto.page!,
      paginationDto.limit!,
      total,
    );
  }

  /**
   * Build search query
   */
  static buildSearchQuery<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    searchTerm: string,
    searchFields: string[],
  ): SelectQueryBuilder<T> {
    if (!searchTerm || searchFields.length === 0) {
      return queryBuilder;
    }

    const searchConditions = searchFields
      .map((field) => `${field} ILIKE :searchTerm`)
      .join(' OR ');

    queryBuilder.andWhere(`(${searchConditions})`, {
      searchTerm: `%${searchTerm}%`,
    });

    return queryBuilder;
  }

  /**
   * Build filter query
   */
  static buildFilterQuery<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    filters: Record<string, unknown>,
  ): SelectQueryBuilder<T> {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          queryBuilder.andWhere(`${key} IN (:...${key})`, { [key]: value });
        } else if (typeof value === 'string' && value.includes('%')) {
          queryBuilder.andWhere(`${key} ILIKE :${key}`, { [key]: value });
        } else {
          queryBuilder.andWhere(`${key} = :${key}`, { [key]: value });
        }
      }
    });

    return queryBuilder;
  }

  /**
   * Build date range query
   */
  static buildDateRangeQuery<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    dateField: string,
    startDate?: Date,
    endDate?: Date,
  ): SelectQueryBuilder<T> {
    if (startDate) {
      queryBuilder.andWhere(`${dateField} >= :startDate`, { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere(`${dateField} <= :endDate`, { endDate });
    }

    return queryBuilder;
  }

  /**
   * Execute transaction
   */
  static async executeTransaction<T extends ObjectLiteral>(
    repository: Repository<T>,
    operations: (manager: any) => Promise<any>,
  ): Promise<any> {
    return repository.manager.transaction(operations);
  }

  /**
   * Soft delete entity
   */
  static async softDelete<T extends ObjectLiteral & SoftDeletable>(
    repository: Repository<T>,
    id: string | number,
  ): Promise<void> {
    const payload: QueryDeepPartialEntity<SoftDeletable> = {
      deletedAt: new Date(),
    };
    await repository.update(id, payload as QueryDeepPartialEntity<T>);
  }

  /**
   * Restore soft deleted entity
   */
  static async restore<T extends ObjectLiteral & SoftDeletable>(
    repository: Repository<T>,
    id: string | number,
  ): Promise<void> {
    const payload: QueryDeepPartialEntity<SoftDeletable> = {
      deletedAt: null,
    };
    await repository.update(id, payload as QueryDeepPartialEntity<T>);
  }

  /**
   * Check if entity exists
   */
  static async exists<T extends ObjectLiteral>(
    repository: Repository<T>,
    conditions: FindOptionsWhere<T>,
  ): Promise<boolean> {
    const count = await repository.count(conditions);
    return count > 0;
  }

  /**
   * Get entity or throw error
   */
  static async findOneOrFail<T extends ObjectLiteral>(
    repository: Repository<T>,
    conditions: FindOptionsWhere<T>,
    errorMessage: string = VALIDATION_ERROR.ENTITY_NOT_FOUND,
  ): Promise<T> {
    const entity = await repository.findOne(conditions);
    if (!entity) {
      throw new Error(errorMessage);
    }
    return entity;
  }

  /**
   * Bulk insert with conflict handling
   */
  static async bulkInsert<T extends ObjectLiteral>(
    repository: Repository<T>,
    entities: any[],
    conflictFields: string[] = [],
  ): Promise<void> {
    if (entities.length === 0) return;

    const queryBuilder = repository.createQueryBuilder().insert();

    if (conflictFields.length > 0) {
      queryBuilder.onConflict(`(${conflictFields.join(', ')}) DO NOTHING`);
    }

    await queryBuilder.values(entities).execute();
  }

  /**
   * Get query performance stats
   */
  static getQueryStats<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
  ): { sql: string; parameters: any[] } {
    const [sql, parameters] = queryBuilder.getQueryAndParameters();
    return { sql, parameters };
  }

  /**
   * Build complete paginated query with all filters
   */
  static buildCompletePaginatedQuery<T extends ObjectLiteral>(
    repository: Repository<T>,
    paginationDto: PaginationDto,
    options: {
      allowedSortFields?: string[];
      searchFields?: string[];
      defaultSortField?: string;
      tenantId?: string;
    } = {},
  ): SelectQueryBuilder<T> {
    const {
      allowedSortFields = [],
      searchFields = [],
      defaultSortField = 'created_at',
      tenantId,
    } = options;

    let query = repository.createQueryBuilder();

    // Apply tenant filter if provided
    if (tenantId) {
      query.andWhere('tenant_id = :tenantId', { tenantId });
    }

    // Apply search
    if (paginationDto.search && searchFields.length > 0) {
      query = this.buildSearchQuery(query, paginationDto.search, searchFields);
    }

    // Apply filters
    if (paginationDto.filters) {
      const filters = PaginationService.parseFilters(paginationDto.filters);
      query = this.buildFilterQuery(query, filters);
    }

    // Apply pagination
    const offset = PaginationService.calculateOffset(
      paginationDto.page!,
      paginationDto.limit!,
    );
    query.skip(offset).take(paginationDto.limit);

    // Apply sorting
    const sortField = allowedSortFields.includes(paginationDto.sortBy!)
      ? paginationDto.sortBy!
      : defaultSortField;

    query.orderBy(sortField, paginationDto.sortOrder);

    return query;
  }
}
