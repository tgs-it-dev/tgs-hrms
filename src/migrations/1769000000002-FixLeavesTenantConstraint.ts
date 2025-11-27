import { MigrationInterface, QueryRunner } from "typeorm";

export class FixLeavesTenantConstraint1769000000002 implements MigrationInterface {
  name = "FixLeavesTenantConstraint1769000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        drop_record RECORD;
      BEGIN
        FOR drop_record IN
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'leaves'
            AND LOWER(kcu.column_name) = 'tenantid'
            AND tc.constraint_type = 'FOREIGN KEY'
        LOOP
          EXECUTE format('ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS %I', drop_record.constraint_name);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "leaves"
      ADD CONSTRAINT "FK_leaves_tenant"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_tenant"
    `);

    await queryRunner.query(`
      ALTER TABLE "leaves"
      ADD CONSTRAINT "FK_leaves_tenant"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }
}

