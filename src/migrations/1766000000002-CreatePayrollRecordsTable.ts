import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayrollRecordsTable1766000000002 implements MigrationInterface {
  name = 'CreatePayrollRecordsTable1766000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create payroll_records table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "month" integer NOT NULL,
        "year" integer NOT NULL,
        "grossSalary" numeric(12,2) NOT NULL,
        "salaryBreakdown" jsonb,
        "totalDeductions" numeric(12,2) NOT NULL DEFAULT 0,
        "deductionsBreakdown" jsonb,
        "bonuses" numeric(12,2) NOT NULL DEFAULT 0,
        "bonusesBreakdown" jsonb,
        "netSalary" numeric(12,2) NOT NULL,
        "workingDays" integer,
        "daysPresent" integer,
        "daysAbsent" integer,
        "paidLeaves" integer,
        "unpaidLeaves" integer,
        "overtimeHours" numeric(8,2),
        "generated_by" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "approved_by" uuid,
        "approved_at" TIMESTAMP,
        "paid_at" TIMESTAMP,
        "remarks" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_payroll_records" PRIMARY KEY ("id")
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_records_tenant_id" ON "payroll_records" ("tenant_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_records_employee_id" ON "payroll_records" ("employee_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payroll_records_month_year" ON "payroll_records" ("month", "year");
    `);

    // Foreign key to tenants
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_payroll_records_tenant_id'
        ) THEN
          ALTER TABLE "payroll_records"
          ADD CONSTRAINT "FK_payroll_records_tenant_id"
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
          WHERE constraint_name = 'FK_payroll_records_employee_id'
        ) THEN
          ALTER TABLE "payroll_records"
          ADD CONSTRAINT "FK_payroll_records_employee_id"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") 
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // Foreign key to users (generated_by)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_payroll_records_generated_by'
        ) THEN
          ALTER TABLE "payroll_records"
          ADD CONSTRAINT "FK_payroll_records_generated_by"
          FOREIGN KEY ("generated_by") REFERENCES "users"("id") 
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // Foreign key to users (approved_by)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_payroll_records_approved_by'
        ) THEN
          ALTER TABLE "payroll_records"
          ADD CONSTRAINT "FK_payroll_records_approved_by"
          FOREIGN KEY ("approved_by") REFERENCES "users"("id") 
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
          WHERE constraint_name = 'FK_payroll_records_approved_by'
        ) THEN
          ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_payroll_records_approved_by";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_payroll_records_generated_by'
        ) THEN
          ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_payroll_records_generated_by";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_payroll_records_employee_id'
        ) THEN
          ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_payroll_records_employee_id";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_payroll_records_tenant_id'
        ) THEN
          ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_payroll_records_tenant_id";
        END IF;
      END $$;
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payroll_records_month_year";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payroll_records_employee_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payroll_records_tenant_id";
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_records";`);
  }
}

