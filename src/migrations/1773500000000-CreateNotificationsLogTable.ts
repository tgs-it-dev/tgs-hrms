import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsLogTable1773500000000
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
      CREATE TABLE IF NOT EXISTS "${schema}"."notifications_log" (
        id                 UUID         NOT NULL DEFAULT gen_random_uuid(),
        tenant_id          UUID,
        recipient_user_id  UUID,
        recipient_email    VARCHAR(320) NOT NULL,
        type               VARCHAR(64)  NOT NULL,
        status             VARCHAR(16)  NOT NULL,
        error_message      TEXT,
        metadata           JSONB,
        sent_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "pk_${schema}_notif_log" PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_nlog_tenant"
        ON "${schema}"."notifications_log" (tenant_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_nlog_recipient"
        ON "${schema}"."notifications_log" (recipient_user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_nlog_type"
        ON "${schema}"."notifications_log" (type)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_${schema}_nlog_status"
        ON "${schema}"."notifications_log" (status)
    `);
  }

  private async dropTableInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_${schema}_nlog_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_${schema}_nlog_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_${schema}_nlog_recipient"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."idx_${schema}_nlog_tenant"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "${schema}"."notifications_log"`,
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
