import { MigrationInterface, QueryRunner } from "typeorm";

export class TenantDeleted1761048855939 implements MigrationInterface {
  name = "TenantDeleted1761048855939";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isDeleted column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tenants' AND column_name = 'isDeleted'
        ) THEN
          ALTER TABLE "tenants" ADD "isDeleted" boolean NOT NULL DEFAULT false;
        END IF;
      END $$;
    `);

    // Add updated_at column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tenants' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE "tenants" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now();
        END IF;
      END $$;
    `);

    // Add deleted_at column if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tenants' AND column_name = 'deleted_at'
        ) THEN
          ALTER TABLE "tenants" ADD "deleted_at" TIMESTAMP;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "updated_at"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "isDeleted"`);
  }
}
