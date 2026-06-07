import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantIpWhitelistTable1777000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ip_whitelists (
        id              UUID        NOT NULL DEFAULT gen_random_uuid(),
        tenant_id       UUID        NOT NULL,
        ip_address      VARCHAR(45) NOT NULL,
        description     VARCHAR(255),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at      TIMESTAMPTZ,
        CONSTRAINT      pk_tenant_ip_whitelists PRIMARY KEY (id),
        CONSTRAINT      uq_tenant_ip_whitelists_tenant_ip UNIQUE (tenant_id, ip_address),
        CONSTRAINT      fk_tenant_ip_whitelists_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_ip_whitelists_tenant_id
      ON tenant_ip_whitelists(tenant_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_ip_whitelists`);
  }
}
