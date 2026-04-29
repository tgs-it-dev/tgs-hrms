import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager } from "typeorm";

/**
 * Provides a safe, connection-pool-friendly way to execute queries against
 * a tenant's dedicated PostgreSQL schema.
 *
 * Internals
 * ---------
 * PostgreSQL's `SET LOCAL search_path` is *transaction-scoped*: the setting
 * reverts to the server default the moment the transaction ends (commit or
 * rollback), so each connection is returned to the pool in a clean state.
 * This makes the approach safe under any pool size or concurrency level.
 *
 * Usage
 * -----
 * ```typescript
 * const result = await this.tenantDbService.withTenantSchema(tenantId, async (em) => {
 *   const repo = em.getRepository(Employee);
 *   return repo.find({ where: { deleted_at: IsNull() } });
 * });
 * ```
 *
 * Table resolution inside the callback
 * -------------------------------------
 * With search_path = "<tenant_schema>", public:
 *   - tenant tables  (employees, departments …) → resolved from tenant_schema
 *   - shared tables  (users, tenants, roles …)  → not in tenant_schema, fall
 *     through to public automatically
 */
@Injectable()
export class TenantDatabaseService {
  private readonly logger = new Logger(TenantDatabaseService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Returns the PostgreSQL schema name for the given tenant UUID.
   * Matches the convention used by TenantSchemaProvisioningService.
   */
  getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, "")}`;
  }

  /**
   * Executes `work` inside a transaction whose search_path is set to the
   * tenant's schema first, then "public".
   *
   * The transaction is committed automatically on success and rolled back on
   * any thrown error.  The error is re-thrown after rollback.
   *
   * @param tenantId - The UUID of the tenant whose schema should be active.
   * @param work     - Async callback that receives a transaction-scoped EntityManager.
   * @returns        The value returned by `work`.
   */
  async withTenantSchema<T>(
    tenantId: string,
    work: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // SET LOCAL is transaction-scoped: automatically reverts on commit/rollback.
      await queryRunner.query(
        `SET LOCAL search_path TO "${schemaName}", public`,
      );

      const result = await work(queryRunner.manager);

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Transaction failed for tenant schema "${schemaName}": ${(error as Error).message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Convenience method for read-only operations that still need the correct
   * search_path.  Wraps the callback in a transaction (required for SET LOCAL)
   * but commits immediately without any write side-effects.
   */
  async withTenantSchemaReadOnly<T>(
    tenantId: string,
    work: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.withTenantSchema(tenantId, work);
  }
}
