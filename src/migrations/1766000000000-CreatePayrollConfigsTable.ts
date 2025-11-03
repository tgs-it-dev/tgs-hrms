import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayrollConfigsTable1766000000000 implements MigrationInterface {
  name = 'CreatePayrollConfigsTable1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create payroll_configs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "salaryCycle" character varying(20) NOT NULL DEFAULT 'monthly',
        "basePayComponents" jsonb,
        "allowances" jsonb,
        "deductions" jsonb,
        "overtimePolicy" jsonb,
        "leaveDeductionPolicy" jsonb,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_payroll_configs" PRIMARY KEY ("id")
      );
    `);

    // Create index on tenant_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_configs_tenant_id" ON "payroll_configs" ("tenant_id");
    `);

    // Foreign key to tenants
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_payroll_configs_tenant_id'
        ) THEN
          ALTER TABLE "payroll_configs"
          ADD CONSTRAINT "FK_payroll_configs_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_payroll_configs_tenant_id'
        ) THEN
          ALTER TABLE "payroll_configs" DROP CONSTRAINT "FK_payroll_configs_tenant_id";
        END IF;
      END $$;
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payroll_configs_tenant_id";
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_configs";`);
  }
}

