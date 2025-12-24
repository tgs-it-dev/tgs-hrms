import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBillingTransactionsTable1766000000004 implements MigrationInterface {
  name = 'CreateBillingTransactionsTable1766000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create billing_transactions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "type" character varying(50) NOT NULL,
        "status" character varying(20) NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "stripe_charge_id" character varying,
        "stripe_customer_id" character varying,
        "employee_id" uuid,
        "description" text,
        "error_message" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_transactions" PRIMARY KEY ("id")
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_billing_transactions_tenant_id" ON "billing_transactions" ("tenant_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_billing_transactions_status" ON "billing_transactions" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_billing_transactions_created_at" ON "billing_transactions" ("created_at");
    `);

    // Foreign key to tenants
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_billing_transactions_tenant_id'
        ) THEN
          ALTER TABLE "billing_transactions"
          ADD CONSTRAINT "FK_billing_transactions_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // Foreign key to employees (optional, nullable)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_billing_transactions_employee_id'
        ) THEN
          ALTER TABLE "billing_transactions"
          ADD CONSTRAINT "FK_billing_transactions_employee_id"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") 
          ON DELETE SET NULL ON UPDATE NO ACTION;
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
          WHERE constraint_name = 'FK_billing_transactions_employee_id'
        ) THEN
          ALTER TABLE "billing_transactions" DROP CONSTRAINT "FK_billing_transactions_employee_id";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_billing_transactions_tenant_id'
        ) THEN
          ALTER TABLE "billing_transactions" DROP CONSTRAINT "FK_billing_transactions_tenant_id";
        END IF;
      END $$;
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_billing_transactions_created_at";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_billing_transactions_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_billing_transactions_tenant_id";
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_transactions";`);
  }
}

