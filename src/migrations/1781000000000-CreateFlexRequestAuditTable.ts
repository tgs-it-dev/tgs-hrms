import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFlexRequestAuditTable1781000000000
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
      CREATE TABLE IF NOT EXISTS "${schema}"."flex_request_audit" (
        id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
        workflow_request_id UUID        NOT NULL,
        tenant_id           UUID        NOT NULL,
        actor_id            UUID        NOT NULL,
        from_status         VARCHAR(32) NOT NULL,
        to_status           VARCHAR(32) NOT NULL,
        note                TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_flex_audit_${schema}" PRIMARY KEY (id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_flex_audit_wfr_${schema}"
        ON "${schema}"."flex_request_audit" (workflow_request_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_flex_audit_tenant_actor_${schema}"
        ON "${schema}"."flex_request_audit" (tenant_id, actor_id)
    `);
  }

  private async dropTableInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_flex_audit_tenant_actor_${schema}"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_flex_audit_wfr_${schema}"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "${schema}"."flex_request_audit"`,
    );
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createTableInSchema(queryRunner, 'public');

    const provisionedRows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as Array<{ id: string }>;

    for (const tenant of provisionedRows) {
      await this.createTableInSchema(
        queryRunner,
        this.getSchemaName(tenant.id),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const provisionedRows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as Array<{ id: string }>;

    for (const tenant of provisionedRows) {
      await this.dropTableInSchema(queryRunner, this.getSchemaName(tenant.id));
    }

    await this.dropTableInSchema(queryRunner, 'public');
  }
}
