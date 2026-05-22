import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkflowEnabledToTenants1772900000001
  implements MigrationInterface
{
  name = 'AddWorkflowEnabledToTenants1772900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "workflow_enabled" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "workflow_enabled"
    `);
  }
}
