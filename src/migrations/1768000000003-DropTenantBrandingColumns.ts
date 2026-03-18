import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTenantBrandingColumns1768000000003
  implements MigrationInterface
{
  name = "DropTenantBrandingColumns1768000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "logo_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "domain"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD "logo_url" varchar`);
    await queryRunner.query(`ALTER TABLE "tenants" ADD "domain" varchar`);
  }
}
