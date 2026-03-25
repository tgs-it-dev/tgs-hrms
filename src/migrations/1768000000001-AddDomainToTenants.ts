import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDomainToTenants1768000000001 implements MigrationInterface {
  name = "AddDomainToTenants1768000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenants' AND column_name = 'domain'
        ) THEN
          ALTER TABLE "tenants" ADD "domain" varchar;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "domain"`,
    );
  }
}
