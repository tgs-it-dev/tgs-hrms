import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLogoToTenants1768000000000 implements MigrationInterface {
  name = "AddLogoToTenants1768000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'logo_url'
        ) THEN
          ALTER TABLE "tenants" ADD "logo_url" varchar;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "logo_url"`,
    );
  }
}
