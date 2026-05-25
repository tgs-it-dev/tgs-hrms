import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantSettingsTable1773200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_settings (
        id          UUID        NOT NULL DEFAULT gen_random_uuid(),
        tenant_id   UUID        NOT NULL,
        key         VARCHAR(100) NOT NULL,
        value       TEXT        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT  pk_tenant_settings PRIMARY KEY (id),
        CONSTRAINT  uq_tenant_settings_tenant_key UNIQUE (tenant_id, key),
        CONSTRAINT  fk_tenant_settings_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_settings`);
  }
}
