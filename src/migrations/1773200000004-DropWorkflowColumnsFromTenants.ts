import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropWorkflowColumnsFromTenants1773200000004
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.tenants
        DROP COLUMN IF EXISTS leave_workflow_enabled,
        DROP COLUMN IF EXISTS wfh_workflow_enabled,
        DROP COLUMN IF EXISTS overtime_workflow_enabled
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.tenants
        ADD COLUMN IF NOT EXISTS leave_workflow_enabled   BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS wfh_workflow_enabled     BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS overtime_workflow_enabled BOOLEAN NOT NULL DEFAULT false
    `);

    // Back-fill from tenant_settings so the columns are consistent on rollback
    await queryRunner.query(`
      UPDATE public.tenants t
      SET
        leave_workflow_enabled   = COALESCE((
          SELECT (value = 'true')
          FROM public.tenant_settings
          WHERE tenant_id = t.id AND key = 'leave_workflow_enabled'
          LIMIT 1
        ), false),
        wfh_workflow_enabled     = COALESCE((
          SELECT (value = 'true')
          FROM public.tenant_settings
          WHERE tenant_id = t.id AND key = 'wfh_workflow_enabled'
          LIMIT 1
        ), false),
        overtime_workflow_enabled = COALESCE((
          SELECT (value = 'true')
          FROM public.tenant_settings
          WHERE tenant_id = t.id AND key = 'overtime_workflow_enabled'
          LIMIT 1
        ), false)
    `);
  }
}
