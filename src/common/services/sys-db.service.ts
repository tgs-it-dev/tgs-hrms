import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Wraps parameterised queries against the public (system) schema.
 * Use this for reading system-wide tables (tenants, users, subscription_plans, …)
 * rather than calling dataSource.query() directly in guards/services.
 */
@Injectable()
export class SysDbService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async sysQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.dataSource.query<T[]>(sql, params);
  }
}
