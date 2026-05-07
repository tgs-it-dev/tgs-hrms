import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchemaProvisionedToTenants1772600000000 implements MigrationInterface {
  name = 'AddSchemaProvisionedToTenants1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "schema_provisioned" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "schema_provisioned"`,
    );
  }
}
