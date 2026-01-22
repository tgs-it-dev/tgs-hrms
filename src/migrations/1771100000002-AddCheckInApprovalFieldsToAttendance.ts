import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckInApprovalFieldsToAttendance1771100000002
  implements MigrationInterface
{
  name = 'AddCheckInApprovalFieldsToAttendance1771100000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add approval_status column
    await queryRunner.query(
      `ALTER TABLE "attendance" 
       ADD COLUMN "approval_status" character varying(20) NULL 
       DEFAULT 'pending'`,
    );

    // Add approved_by column
    await queryRunner.query(
      `ALTER TABLE "attendance" 
       ADD COLUMN "approved_by" uuid NULL`,
    );

    // Add approved_at column
    await queryRunner.query(
      `ALTER TABLE "attendance" 
       ADD COLUMN "approved_at" TIMESTAMP WITH TIME ZONE NULL`,
    );

    // Add approval_remarks column
    await queryRunner.query(
      `ALTER TABLE "attendance" 
       ADD COLUMN "approval_remarks" text NULL`,
    );

    // Add updated_at column
    await queryRunner.query(
      `ALTER TABLE "attendance" 
       ADD COLUMN "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );

    // Add foreign key constraint for approved_by
    await queryRunner.query(
      `ALTER TABLE "attendance" 
       ADD CONSTRAINT "FK_attendance_approved_by" 
       FOREIGN KEY ("approved_by") REFERENCES "users"("id") 
       ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create index on approval_status for better query performance
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_approval_status" 
       ON "attendance" ("approval_status")`,
    );

    // Set approval_status to NULL for non-check-in records
    await queryRunner.query(
      `UPDATE "attendance" 
       SET "approval_status" = NULL 
       WHERE "type" != 'check-in'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_attendance_approval_status"`,
    );

    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "attendance" 
       DROP CONSTRAINT IF EXISTS "FK_attendance_approved_by"`,
    );

    // Drop columns
    await queryRunner.query(
      `ALTER TABLE "attendance" DROP COLUMN IF EXISTS "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance" DROP COLUMN IF EXISTS "approval_remarks"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance" DROP COLUMN IF EXISTS "approved_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance" DROP COLUMN IF EXISTS "approved_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance" DROP COLUMN IF EXISTS "approval_status"`,
    );
  }
}