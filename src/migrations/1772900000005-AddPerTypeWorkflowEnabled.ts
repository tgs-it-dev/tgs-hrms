import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerTypeWorkflowEnabled1772900000005
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.tenants
        ADD COLUMN IF NOT EXISTS leave_workflow_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS wfh_workflow_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS overtime_workflow_enabled BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Seed existing rows: if the global flag was already on, carry it to all three types
    await queryRunner.query(`
      UPDATE public.tenants
      SET
        leave_workflow_enabled    = workflow_enabled,
        wfh_workflow_enabled      = workflow_enabled,
        overtime_workflow_enabled = workflow_enabled
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.tenants
        DROP COLUMN IF EXISTS leave_workflow_enabled,
        DROP COLUMN IF EXISTS wfh_workflow_enabled,
        DROP COLUMN IF EXISTS overtime_workflow_enabled
    `);
  }
}
