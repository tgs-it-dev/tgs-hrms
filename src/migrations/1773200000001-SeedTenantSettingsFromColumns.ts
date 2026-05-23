import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills tenant_settings from existing tenants table columns.
 *
 * mobile_login_enabled  — hardcoded true (column is gone; default was always true)
 * leave/wfh/overtime    — read from the actual columns still on tenants
 *
 * ON CONFLICT DO NOTHING for mobile: preserves any row already written by the API.
 * ON CONFLICT DO UPDATE  for workflow: always syncs to the authoritative column value.
 */
export class SeedTenantSettingsFromColumns1773200000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // mobile_login_enabled — column no longer exists; all tenants default to true
    await queryRunner.query(`
      INSERT INTO tenant_settings (id, tenant_id, key, value, created_at, updated_at)
      SELECT gen_random_uuid(), id, 'mobile_login_enabled', 'true', now(), now()
      FROM tenants
      ON CONFLICT (tenant_id, key) DO NOTHING
    `);

    // leave_workflow_enabled
    await queryRunner.query(`
      INSERT INTO tenant_settings (id, tenant_id, key, value, created_at, updated_at)
      SELECT gen_random_uuid(), id, 'leave_workflow_enabled', leave_workflow_enabled::text, now(), now()
      FROM tenants
      ON CONFLICT (tenant_id, key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
    `);

    // wfh_workflow_enabled
    await queryRunner.query(`
      INSERT INTO tenant_settings (id, tenant_id, key, value, created_at, updated_at)
      SELECT gen_random_uuid(), id, 'wfh_workflow_enabled', wfh_workflow_enabled::text, now(), now()
      FROM tenants
      ON CONFLICT (tenant_id, key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
    `);

    // overtime_workflow_enabled
    await queryRunner.query(`
      INSERT INTO tenant_settings (id, tenant_id, key, value, created_at, updated_at)
      SELECT gen_random_uuid(), id, 'overtime_workflow_enabled', overtime_workflow_enabled::text, now(), now()
      FROM tenants
      ON CONFLICT (tenant_id, key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tenant_settings
      WHERE key IN (
        'mobile_login_enabled',
        'leave_workflow_enabled',
        'wfh_workflow_enabled',
        'overtime_workflow_enabled'
      )
    `);
  }
}
