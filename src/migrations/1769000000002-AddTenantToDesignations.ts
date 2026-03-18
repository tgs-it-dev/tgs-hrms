import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenantToDesignations1769000000002
  implements MigrationInterface
{
  name = "AddTenantToDesignations1769000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add nullable tenant_id column to designations
    await queryRunner.query(`
      ALTER TABLE "designations"
      ADD COLUMN IF NOT EXISTS "tenant_id" uuid
    `);

    // 2) Backfill tenant_id from related departments
    await queryRunner.query(`
      UPDATE "designations" d
      SET "tenant_id" = dept."tenant_id"
      FROM "departments" dept
      WHERE d."department_id" = dept."id"
        AND d."tenant_id" IS NULL
    `);

    // 3) Make tenant_id NOT NULL
    await queryRunner.query(`
      ALTER TABLE "designations"
      ALTER COLUMN "tenant_id" SET NOT NULL
    `);

    // 4) Add / refresh foreign key constraint to tenants
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'designations' 
          AND kcu.column_name = 'tenant_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "designations" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "designations" 
      ADD CONSTRAINT "FK_designations_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "designations" DROP CONSTRAINT IF EXISTS "FK_designations_tenant"
    `);

    await queryRunner.query(`
      ALTER TABLE "designations"
      DROP COLUMN IF EXISTS "tenant_id"
    `);
  }
}


