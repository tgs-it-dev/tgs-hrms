import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOvertimeRequestsTable1772900000002
  implements MigrationInterface
{
  name = 'CreateOvertimeRequestsTable1772900000002';

  private getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async createTableInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."overtime_requests" (
        "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"           UUID         NOT NULL,
        "employee_id"         UUID         NOT NULL,
        "start_date"          DATE         NOT NULL,
        "end_date"            DATE         NOT NULL,
        "hours"               DECIMAL(4,2) NOT NULL,
        "reason"              TEXT         NOT NULL,
        "status"              VARCHAR(32)  NOT NULL DEFAULT 'pending',
        "attachments"         JSONB        NOT NULL DEFAULT '[]',
        "workflow_request_id" UUID,
        "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMPTZ,
        CONSTRAINT "PK_overtime_requests_${schema}" PRIMARY KEY ("id"),
        CONSTRAINT "FK_overtime_requests_tenant_${schema}"
          FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_overtime_requests_employee_${schema}"
          FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_overtime_tenant_employee_${schema}"
        ON "${schema}"."overtime_requests" ("tenant_id", "employee_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_overtime_tenant_status_${schema}"
        ON "${schema}"."overtime_requests" ("tenant_id", "status")
    `);
  }

  private async dropTableInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_overtime_tenant_status_${schema}"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_overtime_tenant_employee_${schema}"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "${schema}"."overtime_requests"`,
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
