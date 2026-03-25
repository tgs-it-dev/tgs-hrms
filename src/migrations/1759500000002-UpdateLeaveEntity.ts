import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateLeaveEntity1759500000002 implements MigrationInterface {
  name = 'UpdateLeaveEntity1759500000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing foreign key constraints
    await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_user"`);
    
    // Add new columns
    await queryRunner.query(`ALTER TABLE "leaves" ADD "leaveTypeId" uuid`);
    await queryRunner.query(`ALTER TABLE "leaves" ADD "totalDays" integer`);
    await queryRunner.query(`ALTER TABLE "leaves" ADD "approvedBy" uuid`);
    await queryRunner.query(`ALTER TABLE "leaves" ADD "tenantId" uuid`);
    await queryRunner.query(`ALTER TABLE "leaves" ADD "approvedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "leaves" ADD "remarks" text`);

    // Rename columns
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "user_id" TO "employeeId"`);
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "from_date" TO "startDate"`);
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "to_date" TO "endDate"`);
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "updated_at" TO "updatedAt"`);

    // Drop old type column (will be replaced by relation)
    await queryRunner.query(`ALTER TABLE "leaves" DROP COLUMN IF EXISTS "type"`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "leaves" 
      ADD CONSTRAINT "FK_leaves_employee" 
      FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "leaves" 
      ADD CONSTRAINT "FK_leaves_leaveType" 
      FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "leaves" 
      ADD CONSTRAINT "FK_leaves_approver" 
      FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "leaves" 
      ADD CONSTRAINT "FK_leaves_tenant" 
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_leaves_employee" ON "leaves" ("employeeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_leaves_leaveType" ON "leaves" ("leaveTypeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_leaves_tenant" ON "leaves" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_leaves_status" ON "leaves" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new foreign key constraints
    await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_employee"`);
    await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_leaveType"`);
    await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_approver"`);
    await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_tenant"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leaves_employee"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leaves_leaveType"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leaves_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leaves_status"`);

    // Rename columns back
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "employeeId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "startDate" TO "from_date"`);
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "endDate" TO "to_date"`);
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "leaves" RENAME COLUMN "updatedAt" TO "updated_at"`);

    // Drop new columns
    await queryRunner.query(`ALTER TABLE "leaves" DROP COLUMN IF EXISTS "leaveTypeId"`);
    await queryRunner.query(`ALTER TABLE "leaves" DROP COLUMN IF EXISTS "totalDays"`);
    await queryRunner.query(`ALTER TABLE "leaves" DROP COLUMN IF EXISTS "approvedBy"`);
    await queryRunner.query(`ALTER TABLE "leaves" DROP COLUMN IF EXISTS "tenantId"`);
    await queryRunner.query(`ALTER TABLE "leaves" DROP COLUMN IF EXISTS "approvedAt"`);
    await queryRunner.query(`ALTER TABLE "leaves" DROP COLUMN IF EXISTS "remarks"`);

    // Add back old type column
    await queryRunner.query(`ALTER TABLE "leaves" ADD "type" character varying`);

    // Restore old foreign key
    await queryRunner.query(`
      ALTER TABLE "leaves" 
      ADD CONSTRAINT "FK_leaves_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }
}
