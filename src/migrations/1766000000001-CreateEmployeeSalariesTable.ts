import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeeSalariesTable1766000000001 implements MigrationInterface {
  name = 'CreateEmployeeSalariesTable1766000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create employee_salaries table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_salaries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "baseSalary" numeric(12,2) NOT NULL,
        "allowances" jsonb,
        "deductions" jsonb,
        "effectiveDate" date NOT NULL,
        "endDate" date,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "notes" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_employee_salaries" PRIMARY KEY ("id")
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_employee_salaries_tenant_id" ON "employee_salaries" ("tenant_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_employee_salaries_employee_id" ON "employee_salaries" ("employee_id");
    `);

    // Foreign key to tenants
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_employee_salaries_tenant_id'
        ) THEN
          ALTER TABLE "employee_salaries"
          ADD CONSTRAINT "FK_employee_salaries_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // Foreign key to employees
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_employee_salaries_employee_id'
        ) THEN
          ALTER TABLE "employee_salaries"
          ADD CONSTRAINT "FK_employee_salaries_employee_id"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") 
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_employee_salaries_employee_id'
        ) THEN
          ALTER TABLE "employee_salaries" DROP CONSTRAINT "FK_employee_salaries_employee_id";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_employee_salaries_tenant_id'
        ) THEN
          ALTER TABLE "employee_salaries" DROP CONSTRAINT "FK_employee_salaries_tenant_id";
        END IF;
      END $$;
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_employee_salaries_employee_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_employee_salaries_tenant_id";
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_salaries";`);
  }
}

