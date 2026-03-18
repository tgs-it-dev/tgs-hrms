import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBenefitReimbursementRequestsTable1771000000000
  implements MigrationInterface
{
  name = 'CreateBenefitReimbursementRequestsTable1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create benefit_reimbursement_requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "benefit_reimbursement_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employee_id" uuid NOT NULL,
        "employee_benefit_id" uuid NOT NULL,
        "amount" decimal(10,2) NOT NULL,
        "details" text NOT NULL,
        "proof_documents" text[] DEFAULT '{}',
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP,
        "review_remarks" text,
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_benefit_reimbursement_requests" PRIMARY KEY ("id")
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_benefit_reimbursement_employee_id" 
      ON "benefit_reimbursement_requests" ("employee_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_benefit_reimbursement_employee_benefit_id" 
      ON "benefit_reimbursement_requests" ("employee_benefit_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_benefit_reimbursement_status" 
      ON "benefit_reimbursement_requests" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_benefit_reimbursement_tenant_id" 
      ON "benefit_reimbursement_requests" ("tenant_id");
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_benefit_reimbursement_employee'
        ) THEN
          ALTER TABLE "benefit_reimbursement_requests"
          ADD CONSTRAINT "FK_benefit_reimbursement_employee"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") 
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_benefit_reimbursement_employee_benefit'
        ) THEN
          ALTER TABLE "benefit_reimbursement_requests"
          ADD CONSTRAINT "FK_benefit_reimbursement_employee_benefit"
          FOREIGN KEY ("employee_benefit_id") REFERENCES "employee_benefits"("id") 
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_benefit_reimbursement_reviewer'
        ) THEN
          ALTER TABLE "benefit_reimbursement_requests"
          ADD CONSTRAINT "FK_benefit_reimbursement_reviewer"
          FOREIGN KEY ("reviewed_by") REFERENCES "employees"("id") 
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_benefit_reimbursement_tenant'
        ) THEN
          ALTER TABLE "benefit_reimbursement_requests"
          ADD CONSTRAINT "FK_benefit_reimbursement_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    const constraints = [
      'FK_benefit_reimbursement_tenant',
      'FK_benefit_reimbursement_reviewer',
      'FK_benefit_reimbursement_employee_benefit',
      'FK_benefit_reimbursement_employee',
    ];

    for (const constraint of constraints) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = '${constraint}'
          ) THEN
            ALTER TABLE "benefit_reimbursement_requests" 
            DROP CONSTRAINT IF EXISTS "${constraint}";
          END IF;
        END $$;
      `);
    }

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_benefit_reimbursement_tenant_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_benefit_reimbursement_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_benefit_reimbursement_employee_benefit_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_benefit_reimbursement_employee_id";
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "benefit_reimbursement_requests";
    `);
  }
}
