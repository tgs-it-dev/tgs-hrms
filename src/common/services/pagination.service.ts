import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

@Injectable()
export class PaginationService {
  async paginate<T extends ObjectLiteral>(
    repository: Repository<T>,
    page: number = 1,
    size: number = 25,
    where?: any,
    order?: any,
    relations?: string[]
  ): Promise<PaginatedResponse<T>> {
    const skip = (page - 1) * size;
    
    const [data, total] = await repository.findAndCount({
      where,
      order,
      relations,
      skip,
      take: size,
    });

    return {
      data,
      total,
      page,
      size,
    };
  }

  async paginateQueryBuilder<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    page: number = 1,
    size: number = 25
  ): Promise<PaginatedResponse<T>> {
    const skip = (page - 1) * size;
    
    const [data, total] = await queryBuilder
      .skip(skip)
      .take(size)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      size,
    };
  }
}
