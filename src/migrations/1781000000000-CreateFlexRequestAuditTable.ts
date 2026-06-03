import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFlexRequestAuditTable1781000000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS flex_request_audit (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_request_id UUID NOT NULL,
        tenant_id   UUID NOT NULL,
        actor_id    UUID NOT NULL,
        from_status VARCHAR(32) NOT NULL,
        to_status   VARCHAR(32) NOT NULL,
        note        TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_flex_audit_workflow_request
        ON flex_request_audit (workflow_request_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_flex_audit_tenant_actor
        ON flex_request_audit (tenant_id, actor_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS flex_request_audit`);
  }
}
