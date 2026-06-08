import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeaveBalancesTable1773600000000
  implements MigrationInterface
{
  private getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async createTableInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."leave_balances" (
        "id"           UUID    NOT NULL DEFAULT gen_random_uuid(),
        "employeeId"   UUID    NOT NULL,
        "leaveTypeId"  UUID    NOT NULL,
        "year"         INTEGER NOT NULL,
        "allocated"    INTEGER NOT NULL DEFAULT 0,
        "used"         INTEGER NOT NULL DEFAULT 0,
        "tenantId"     UUID    NOT NULL,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_${schema}_lb" PRIMARY KEY ("id"),
        CONSTRAINT "uq_${schema}_lb_emp_lt_yr_tn"
          UNIQUE ("employeeId", "leaveTypeId", "year", "tenantId"),
        CONSTRAINT "fk_${schema}_lb_emp"
          FOREIGN KEY ("employeeId") REFERENCES "public"."users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_${schema}_lb_lt"
          FOREIGN KEY ("leaveTypeId") REFERENCES "${schema}"."leave_types" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_${schema}_lb_tn"
          FOREIGN KEY ("tenantId") REFERENCES "public"."tenants" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_lb_emp"
        ON "${schema}"."leave_balances" ("employeeId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_lb_lt"
        ON "${schema}"."leave_balances" ("leaveTypeId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_lb_tn_yr"
        ON "${schema}"."leave_balances" ("tenantId", "year")
    `);
  }

  private async dropTableInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_${schema}_lb_tn_yr"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_${schema}_lb_lt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_${schema}_lb_emp"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "${schema}"."leave_balances"`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createTableInSchema(queryRunner, 'public');

    const rows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as { id: string }[];

    for (const tenant of rows) {
      await this.createTableInSchema(
        queryRunner,
        this.getSchemaName(tenant.id),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as { id: string }[];

    for (const tenant of rows) {
      await this.dropTableInSchema(queryRunner, this.getSchemaName(tenant.id));
    }

    await this.dropTableInSchema(queryRunner, 'public');
  }
}
